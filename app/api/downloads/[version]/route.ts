import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import fs from "fs";
import path from "path";

import { getS3SignedUrl } from "@/lib/storage-s3";
import { resolveExternalUrl, parseFileNameFromHeaders } from "@/lib/external-resolver";

type RouteContext = {
  params: Promise<{
    version: string;
  }>;
};

function isLocalPath(p: string): boolean {
  return (
    p.startsWith("uploads/") ||
    p.startsWith("uploads\\") ||
    p.includes("uploads/releases")
  );
}

function getLocalFilePath(dbPath: string): string {
  // Check all possible local locations: HF /data, Render /tmp, and local ./uploads
  // Upload saves to /tmp on Render, /data on HF, ./uploads locally
  const candidates = [
    path.join(/*turbopackIgnore: true*/ "/data", dbPath),
    path.join(/*turbopackIgnore: true*/ "/tmp", dbPath),
    path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath),
    path.join(/*turbopackIgnore: true*/ "/app", dbPath),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Default to /tmp on Render, /data on HF, or cwd
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return path.join(/*turbopackIgnore: true*/ "/tmp", dbPath);
  }
  if (fs.existsSync("/data")) {
    return path.join(/*turbopackIgnore: true*/ "/data", dbPath);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath);
}

async function proxyExternalUrl(
  externalUrl: string,
  request: Request,
  fileName: string,
  fileSize: number | null,
  fileType: string | null
) {
  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "*/*",
  };

  if (range) {
    headers["Range"] = range;
  }

  const isCloudflare = !!process.env.CF_PAGES || !!process.env.CLOUDFLARE_PAGES || request.headers.get("cf-ray") || (globalThis as any).caches !== undefined;
  // On Cloudflare, MediaFire share links (www.mediafire.com/file/...) are blocked and return HTML
  // Instead of trying to fetch share page on Cloudflare (blocked), directly stream via Render proxy-file (Node, not blocked)
  // This keeps download on-site with progress bar and uses fresh direct link (not expired), without exposing direct link
  const isMediaFireShare = externalUrl.includes("mediafire.com/file/") || externalUrl.includes("mediafire.com/view/");
  if (isCloudflare && isMediaFireShare) {
    try {
      const renderProxyUrl = `https://winlator-frost.onrender.com/api/proxy-file?url=${encodeURIComponent(externalUrl)}&filename=${encodeURIComponent(fileName)}`;
      const rController = new AbortController();
      // Render free tier may sleep and need 30-50s to wake — give 45s
      const rTid = setTimeout(() => rController.abort(), 45000);
      const rHeaders: Record<string, string> = {};
      if (range) rHeaders["Range"] = range;
      const rRes = await fetch(renderProxyUrl, {
        headers: rHeaders,
        signal: rController.signal,
      } as any);
      clearTimeout(rTid);
      if (rRes.ok || rRes.status === 206) {
        const contentLength = rRes.headers.get("Content-Length");
        const contentRange = rRes.headers.get("Content-Range");
        const contentType = rRes.headers.get("Content-Type") || fileType || "application/vnd.android.package-archive";
        const responseHeaders: Record<string, string> = {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
          "X-Proxied-Via": "render-mediafire-share",
        };
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        if (contentRange) responseHeaders["Content-Range"] = contentRange;
        const reader = rRes.body?.getReader();
        if (!reader) throw new Error("No readable stream from Render proxy");
        const webStream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) controller.enqueue(value);
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
          cancel() {
            reader.cancel();
          },
        });
        return new Response(webStream, {
          status: rRes.status === 206 ? 206 : 200,
          headers: responseHeaders,
        });
      }
    } catch (e) {
      console.warn("Render proxy-file for MediaFire share failed, falling back to normal resolve:", e);
      // Fall through to normal resolve below
    }
  }

  // Resolve third-party URL to direct link (Google Drive, MediaFire, Dropbox, etc.)
  let resolved = await resolveExternalUrl(externalUrl);
  let directUrl = resolved.directUrl;
  if (resolved.provider === "mediafire_unresolved" && isCloudflare) {
    try {
      const renderResolver = `https://winlator-frost.onrender.com/api/resolve-external?url=${encodeURIComponent(externalUrl)}`;
      const rController = new AbortController();
      const rTid = setTimeout(() => rController.abort(), 30000);
      const rRes = await fetch(renderResolver, { headers: { "User-Agent": "Mozilla/5.0" }, signal: rController.signal } as any);
      clearTimeout(rTid);
      if (rRes.ok) {
        const j = await rRes.json().catch(() => null);
        if (j && j.success && j.directUrl && j.directUrl !== externalUrl && j.directUrl.includes("mediafire.com")) {
          directUrl = j.directUrl;
          (resolved as any).provider = j.provider || "mediafire";
        }
      }
    } catch {}
  }

  // Mega.nz cannot be proxied server-side reliably
  if (resolved.provider === "mega") {
    throw new Error(
      "Mega.nz links require opening externally (mega requires decryption in browser). Please use a direct host like Google Drive (share link), MediaFire direct, R2/S3, or GitHub Releases."
    );
  }

  // For Google Drive large files, drive may return HTML with confirm token instead of file.
  // On Cloudflare, MediaFire/Google Drive may block Workers IP and return HTML - fallback to Render proxy for actual file
  const fetchDirect = async (url: string, attempt = 0): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const fetchHeaders: Record<string, string> = { ...headers };
      // Add Cloudflare bypass headers for MediaFire/Google Drive
      if (isCloudflare && (url.includes("mediafire.com") || url.includes("drive.google.com"))) {
        fetchHeaders["Accept-Language"] = "en-US,en;q=0.9";
        fetchHeaders["Referer"] = url.includes("mediafire.com") ? "https://www.mediafire.com/" : "https://drive.google.com/";
      }
      const res = await fetch(url, {
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: "follow",
        cf: { cacheTtl: 0, cacheEverything: false },
      } as any);
      clearTimeout(timeoutId);

      // Handle Google Drive confirm token page (large file virus scan warning)
      const ct = res.headers.get("Content-Type") || "";
      if (resolved.provider === "google_drive" && ct.includes("text/html") && attempt === 0) {
        const html = await res.text();
        // Look for export=download&confirm=... or uuid
        const m = html.match(/href="([^"]*export=download[^"]*confirm=[^"]*)"/i);
        if (m) {
          const confirmUrl = m[1].replace(/&amp;/g, "&");
          // Make absolute if relative
          const abs = confirmUrl.startsWith("http") ? confirmUrl : `https://drive.google.com${confirmUrl}`;
          return fetchDirect(abs, 1);
        }
        // Alternative pattern: confirm token in anchor
        const m2 = html.match(/confirm=([0-9A-Za-z_-]+)/);
        const mId = html.match(/id=([0-9A-Za-z_-]+)/);
        // If html contains download link, try extraction
        const dl = html.match(/https:\/\/drive\.google\.com\/uc\?export=download[^"'\s<>]+/i);
        if (dl) return fetchDirect(dl[0].replace(/&amp;/g, "&"), 1);
      }

      // If MediaFire/Google Drive returned HTML (share page or virus scan) - try to extract direct link or fallback to Render for on-site proxy
      if (ct.includes("text/html") && !ct.includes("application/vnd.android") && attempt === 0) {
        const cd = res.headers.get("Content-Disposition") || "";
        if (!cd.includes("attachment") && !url.match(/\.(apk|zip|rar)(\?|$)/i)) {
          const htmlForCheck = await res.clone().text().catch(() => "");
          if (htmlLooksLikeFileHostPage(htmlForCheck)) {
            // Try to extract MediaFire direct link from HTML (Cloudflare may need extra headers)
            if (url.includes("mediafire.com") || htmlForCheck.toLowerCase().includes("mediafire")) {
              const mMedia = htmlForCheck.match(/href="(https:\/\/download[^"]+)"/i) || htmlForCheck.match(/https:\/\/download\d*\.mediafire\.com[^"'\s<>]+/i);
              if (mMedia) {
                const direct = (mMedia[1] || mMedia[0]).replace(/&amp;/g, "&");
                try {
                  const directRes = await fetch(direct, {
                    headers: { ...headers, Referer: "https://www.mediafire.com/", Accept: "*/*" },
                    signal: controller.signal,
                    redirect: "follow",
                    cf: { cacheTtl: 0, cacheEverything: false },
                  } as any);
                  const ct2 = directRes.headers.get("Content-Type") || "";
                  const cd2 = directRes.headers.get("Content-Disposition") || "";
                  if (!ct2.includes("text/html") || cd2.includes("attachment") || directRes.headers.get("Content-Length")) {
                    clearTimeout(timeoutId);
                    return directRes;
                  }
                } catch {}
              }
            }
            // Cloudflare fallback: for any HTML on Cloudflare (MediaFire/Google Drive share pages blocked), try Render proxy for on-site download
            // This keeps download inside website with progress bar, no new-tab redirect, prevents direct link sharing
            if (isCloudflare) {
              // First try Render resolver to get fresh direct link (for share links)
              try {
                const renderResolver = `https://winlator-frost.onrender.com/api/resolve-external?url=${encodeURIComponent(externalUrl)}`;
                const rCtrl = new AbortController();
                const rTid = setTimeout(() => rCtrl.abort(), 10000);
                const rRes = await fetch(renderResolver, { headers: { "User-Agent": "Mozilla/5.0" }, signal: rCtrl.signal } as any);
                clearTimeout(rTid);
                if (rRes.ok) {
                  const rJson = await rRes.json().catch(() => null);
                  if (rJson && rJson.success && rJson.directUrl && rJson.directUrl !== url) {
                    // Try to fetch the resolved direct link on-site via Cloudflare (with Render-fetched direct link)
                    const rDirectRes = await fetch(rJson.directUrl, {
                      headers: { ...headers, Referer: "https://www.mediafire.com/", Accept: "*/*" },
                      signal: controller.signal,
                      redirect: "follow",
                      cf: { cacheTtl: 0, cacheEverything: false },
                    } as any);
                    const rCt = rDirectRes.headers.get("Content-Type") || "";
                    const rCd = rDirectRes.headers.get("Content-Disposition") || "";
                    if (!rCt.includes("text/html") || rCd.includes("attachment") || rDirectRes.headers.get("Content-Length")) {
                      clearTimeout(timeoutId);
                      return rDirectRes;
                    }
                    // If still HTML on Cloudflare (direct link also blocked), fallback to Render proxy-file for on-site streaming
                    const renderProxy = `https://winlator-frost.onrender.com/api/proxy-file?url=${encodeURIComponent(rJson.directUrl)}&filename=${encodeURIComponent(fileName)}`;
                    const pRes = await fetch(renderProxy, {
                      headers: range ? { Range: range } : {},
                      signal: controller.signal,
                    } as any);
                    if (pRes.ok || pRes.status === 206) {
                      clearTimeout(timeoutId);
                      return pRes;
                    }
                  }
                }
              } catch {}
              // Generic fallback for any HTML on Cloudflare: proxy file via Render (keeps on-site with progress bar)
              try {
                const renderProxy = `https://winlator-frost.onrender.com/api/proxy-file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`;
                const pRes = await fetch(renderProxy, {
                  headers: range ? { Range: range } : {},
                  signal: controller.signal,
                } as any);
                if (pRes.ok || pRes.status === 206) {
                  clearTimeout(timeoutId);
                  return pRes;
                }
                // Also try with original externalUrl if url is already direct
                if (url !== externalUrl) {
                  const renderProxy2 = `https://winlator-frost.onrender.com/api/proxy-file?url=${encodeURIComponent(externalUrl)}&filename=${encodeURIComponent(fileName)}`;
                  const pRes2 = await fetch(renderProxy2, {
                    headers: range ? { Range: range } : {},
                    signal: controller.signal,
                  } as any);
                  if (pRes2.ok || pRes2.status === 206) {
                    clearTimeout(timeoutId);
                    return pRes2;
                  }
                }
              } catch {}
            }
            throw new Error(
              "External URL returned an HTML page instead of the APK file. Please use a direct download link. For MediaFire: open the share link, click download, copy the direct link (download*.mediafire.com). For Google Drive: ensure share link is correct and file is not restricted."
            );
          }
        }
      }
      // Generic Cloudflare fallback for any HTML file response (e.g., direct link blocked on Workers IP) - proxy via Render for on-site
      if (isCloudflare && ct.includes("text/html") && attempt === 0) {
        const cd = res.headers.get("Content-Disposition") || "";
        if (!cd.includes("attachment") && url.match(/\.(apk|zip|rar)/i)) {
          try {
            const renderProxy = `https://winlator-frost.onrender.com/api/proxy-file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`;
            const pRes = await fetch(renderProxy, {
              headers: range ? { Range: range } : {},
              signal: controller.signal,
            } as any);
            if (pRes.ok || pRes.status === 206) {
              clearTimeout(timeoutId);
              return pRes;
            }
          } catch {}
        }
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  function htmlLooksLikeFileHostPage(html: string): boolean {
    if (!html) return false;
    const lower = html.toLowerCase();
    return lower.includes("mediafire") || lower.includes("drive.google.com") || lower.includes("<html");
  }

  const res = await fetchDirect(directUrl);

  if (!res.ok && res.status !== 206) {
    throw new Error(`External download failed: ${res.status} ${res.statusText}`);
  }

  // Get content info from external response
  const contentLength = res.headers.get("Content-Length");
  const contentRange = res.headers.get("Content-Range");
  const contentDisposition = res.headers.get("Content-Disposition");
  let contentType = res.headers.get("Content-Type") || fileType || "application/vnd.android.package-archive";
  // If external returned HTML but we expected APK, clean content-type
  if (contentType.includes("text/html")) {
    contentType = fileType || "application/vnd.android.package-archive";
  }
  // Try to get better filename from headers or resolved hint
  const resolvedFileName = parseFileNameFromHeaders(contentDisposition, contentType, directUrl, fileName);
  const finalFileName = resolvedFileName || fileName;

  let totalSize = fileSize;
  if (contentRange) {
    const m = contentRange.match(/bytes \d+-\d+\/(\d+)/);
    if (m) totalSize = parseInt(m[1], 10);
  } else if (contentLength && !range) {
    totalSize = parseInt(contentLength, 10);
  } else if (contentLength && range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    totalSize = parseInt(contentLength, 10) + start;
  }

  // Create response headers - force download on-site (no redirect)
  const responseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${finalFileName}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "X-External-Provider": resolved.provider,
  };

  if (totalSize && !range && contentLength) {
    responseHeaders["Content-Length"] = totalSize.toString();
  } else if (totalSize && !range) {
    // if we have totalSize but no contentLength, still set
    responseHeaders["Content-Length"] = totalSize.toString();
  }

  if (res.status === 206 && contentRange) {
    responseHeaders["Content-Range"] = contentRange;
  }
  // If we have content-length from upstream and we are not ranged, set it
  if (!range && contentLength && !responseHeaders["Content-Length"]) {
    responseHeaders["Content-Length"] = contentLength;
  }

  // Stream the response body - stay on-site, no redirect to external
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No readable stream from external URL");
  }

  const webStream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(webStream, {
    status: range ? 206 : 200,
    headers: responseHeaders,
  });
}

export async function HEAD(
  request: Request,
  context: RouteContext
) {
  // Allow HEAD for size detection - reuse GET logic with info mode
  return GET(request, context);
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { version: rawVersion } =
      await context.params;

    const version =
      decodeURIComponent(rawVersion);

    const urlObj = new URL(request.url);
    const wantsInfo = urlObj.searchParams.get("info") === "1" || urlObj.searchParams.get("info") === "true";

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          message: "Release version is required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: release,
      error: releaseError,
    } = (await supabase
      .from("releases")
      .select(
        `
            id,
            version,
            file_name,
            file_path,
            file_type,
            file_size,
            external_url
          `
      )
      .eq("version", version)
      .maybeSingle()) as {
      data: {
        id: string;
        version: string;
        file_name: string | null;
        file_path: string | null;
        file_type: string | null;
        file_size: number | null;
        external_url: string | null;
      } | null;
      error: any;
    };

    if (releaseError) {
      console.error(
        "Release lookup error:",
        releaseError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Unable to find the requested release.",
        },
        { status: 500 }
      );
    }

    if (!release) {
      return NextResponse.json(
        {
          success: false,
          message: "Release not found.",
        },
        { status: 404 }
      );
    }

    // Info request: return metadata without downloading (for file name/size detection)
    if (wantsInfo) {
      if (release.external_url) {
        try {
          const resolved = await resolveExternalUrl(release.external_url);
          let fileName = release.file_name || `Winlator@Frost-${release.version}.apk`;
          let fileSize: number | null = release.file_size;

          // Helper to extract size from response headers
          const extractSize = (res: Response | null): number | null => {
            if (!res) return null;
            const cr = res.headers.get("Content-Range");
            if (cr) {
              const m = cr.match(/\/(\d+)\s*$/);
              if (m) return parseInt(m[1], 10);
            }
            const cl = res.headers.get("Content-Length");
            if (cl) {
              // For Range 0-0, cl is 1, but total is in Content-Range; already handled
              // For HEAD, cl is total
              const parsed = parseInt(cl, 10);
              if (!isNaN(parsed) && parsed > 1) return parsed;
              // If cl is 1 and we have no cr, keep null (will try other method)
              if (parsed > 0) return parsed;
            }
            return null;
          };

          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 12000);

            let headRes: Response | null = null;
            let headTextForConfirm: string | null = null;

            try {
              headRes = await fetch(resolved.directUrl, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
              // Google Drive large files return HTML on HEAD - detect and need to fetch confirm page
              const ct = headRes.headers.get("Content-Type") || "";
              const cd = headRes.headers.get("Content-Disposition") || "";
              if (ct.includes("text/html") && !cd.includes("attachment") && resolved.provider === "google_drive") {
                // Need to fetch HTML to get confirm token - do GET for confirm
                try {
                  const htmlRes = await fetch(resolved.directUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
                  const html = await htmlRes.text();
                  headTextForConfirm = html;
                  const m = html.match(/href="([^"]*export=download[^"]*confirm=[^"]*)"/i);
                  if (m) {
                    const confirmUrl = m[1].replace(/&amp;/g, "&");
                    const abs = confirmUrl.startsWith("http") ? confirmUrl : `https://drive.google.com${confirmUrl}`;
                    const cr = await fetch(abs, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
                    if (cr && (cr.ok || cr.status === 206)) headRes = cr;
                    else {
                      const rangeRes = await fetch(abs, { headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
                      if (rangeRes && (rangeRes.ok || rangeRes.status === 206)) headRes = rangeRes;
                    }
                  } else {
                    // Try direct Range on original for size even if HTML
                    const rangeRes = await fetch(resolved.directUrl, { headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
                    if (rangeRes && (rangeRes.ok || rangeRes.status === 206)) headRes = rangeRes;
                  }
                } catch {}
              }
            } catch {}

            // Fallback to Range 0-0 if HEAD failed or returned HTML without size
            let needRangeFallback = !headRes || !headRes.ok;
            if (headRes) {
              const ct = headRes.headers.get("Content-Type") || "";
              const cd = headRes.headers.get("Content-Disposition") || "";
              const hasSize = extractSize(headRes) !== null;
              if (ct.includes("text/html") && !cd.includes("attachment") && !hasSize) needRangeFallback = true;
            }
            if (needRangeFallback) {
              try {
                const rangeRes = await fetch(resolved.directUrl, { headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal, redirect: "follow" });
                if (rangeRes && (rangeRes.ok || rangeRes.status === 206)) headRes = rangeRes;
              } catch {}
            }

            clearTimeout(tid);

            if (headRes && (headRes.ok || headRes.status === 206)) {
              const cd = headRes.headers.get("Content-Disposition");
              const ct = headRes.headers.get("Content-Type") || "";
              // Only use if not HTML or has attachment (real file)
              const isHtml = ct.includes("text/html") && !(cd && cd.includes("attachment"));
              if (!isHtml) {
                fileName = parseFileNameFromHeaders(cd, ct, resolved.directUrl, fileName);
                const sz = extractSize(headRes);
                if (sz !== null && sz > 0) fileSize = sz;
              } else if (headTextForConfirm) {
                // For Google Drive HTML case where we didn't get size, try to parse size from HTML if available
                // Keep fileSize as is (null) - download will still provide size via proxy
              }
            }
          } catch {}
          return NextResponse.json({
            success: true,
            version: release.version,
            file_name: fileName,
            file_size: fileSize,
            content_type: release.file_type || "application/vnd.android.package-archive",
            external_url: release.external_url,
            resolved_url: resolved.directUrl,
            provider: resolved.provider,
          });
        } catch (e) {
          return NextResponse.json({ success: false, message: e instanceof Error ? e.message : "Info failed" }, { status: 500 });
        }
      } else if (release.file_path) {
        // Local/S3 file info
        return NextResponse.json({
          success: true,
          version: release.version,
          file_name: release.file_name || `Winlator@Frost-${release.version}.apk`,
          file_size: release.file_size,
          content_type: release.file_type || "application/vnd.android.package-archive",
          file_path: release.file_path,
        });
      }
      return NextResponse.json({ success: false, message: "No file" }, { status: 404 });
    }

    // External URL - proxy the download on-site (no redirect, progress bar in release page)
    // Keeps download inside website to prevent direct link sharing, as requested
    if (release.external_url) {
      const fileName = release.file_name || `Winlator@Frost-${release.version}.apk`;
      try {
        return await proxyExternalUrl(
          release.external_url,
          request,
          fileName,
          release.file_size,
          release.file_type
        );
      } catch (err) {
        console.error("External URL proxy error (on-site):", err);
        return NextResponse.json(
          {
            success: false,
            message: `Failed to download from external URL: ${err instanceof Error ? err.message : "Unknown error"}. Please ensure the external URL is a direct download link (download*.mediafire.com for MediaFire, uc?export=download for Google Drive, or R2/S3/GitHub direct). For MediaFire share links, open the share link, click Download, and copy the direct link.`,
          },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (!release.file_path) {
      return NextResponse.json(
        {
          success: false,
          message: "APK file is not available for this release.",
        },
        { status: 404 }
      );
    }

    // S3-compatible own host (Storj/Filebase/R2) - persistent, 5GB, not PC-dependent, not Supabase 50MB
    // file_path like s3://11.10/app.apk
    if (release.file_path.startsWith("s3://")) {
      const s3Key = release.file_path.slice(5);
      const signedUrl = await getS3SignedUrl(s3Key, 600);
      if (signedUrl) {
        return NextResponse.redirect(signedUrl);
      }
      return NextResponse.json(
        { success: false, message: "Unable to prepare S3 download URL. Check S3_* env." },
        { status: 500 }
      );
    }

    // Check if local file host (self-hosted, separate from Supabase)
    // On Render Free, /app/uploads is ephemeral (lost on redeploy) - old 11.10 file was on your PC's uploads/ and not migrated
    if (isLocalPath(release.file_path)) {
      const absPath = getLocalFilePath(
        release.file_path
      );

      if (!fs.existsSync(absPath)) {
        console.error(
          "Local file not found (Render ephemeral or not yet uploaded to Filebase):",
          absPath,
          "file_path:", release.file_path
        );

        // For Filebase/S3 host, file_path is s3:// - already handled above, this is only for uploads/ local path
        // Try Supabase legacy only if file_path looks like Supabase path (no uploads/ prefix) - but per user request, APKs should NOT use Supabase bucket
        // So do NOT fallback to Supabase for APKs - only for legacy if needed, otherwise 404 with Filebase hint

        // Fallback: HF persistent /data (if file was ever on HF)
        const hfPath = path.join("/data", release.file_path);
        if (fs.existsSync(hfPath)) {
          console.log("Fallback to HF /data found:", hfPath);
          const stat = fs.statSync(hfPath);
          const fileSize = stat.size;
          const fileName = release.file_name || path.basename(hfPath);
          const contentType = release.file_type || "application/vnd.android.package-archive";
          const stream = fs.createReadStream(hfPath);
          const webStream = new ReadableStream({
            start(controller) {
              stream.on("data", (chunk) => controller.enqueue(chunk));
              stream.on("end", () => controller.close());
              stream.on("error", (err) => controller.error(err));
            },
            cancel() { stream.destroy(); },
          });
          return new Response(webStream as any, {
            headers: {
              "Content-Length": fileSize.toString(),
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${fileName}"`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }

        return NextResponse.json(
          {
            success: false,
            message:
              "APK file not found. File was on previous local host (PC uploads/ lost on Render redeploy). Re-upload via Admin → Releases on https://winlator-frost.onrender.com - now goes to Filebase S3 5GB (persistent, not Supabase 50MB, not PC-dependent). For 239MB+, ensure Filebase env is set on Render.",
            file_path: release.file_path,
            hint: "Set Filebase S3 env on Render: S3_ENDPOINT=https://s3.filebase.com, S3_BUCKET=winlator-releases, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, then re-upload APK. Or use External APK URL field.",
          },
          { status: 404 }
        );
      }

      const stat = fs.statSync(absPath);
      const fileSize = stat.size;
      const fileName =
        release.file_name ||
        path.basename(absPath);
      const contentType =
        release.file_type ||
        "application/vnd.android.package-archive";

      const range = request.headers.get("range");

      if (range) {
        // Parse Range: bytes=0-1023 or bytes=1024-
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1]
          ? parseInt(parts[1], 10)
          : fileSize - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(
          absPath,
          { start, end }
        );

        // Convert Node stream to Web stream
        const webStream = new ReadableStream({
          start(controller) {
            stream.on("data", (chunk) =>
              controller.enqueue(chunk)
            );
            stream.on("end", () =>
              controller.close()
            );
            stream.on("error", (err) =>
              controller.error(err)
            );
          },
          cancel() {
            stream.destroy();
          },
        });

        return new Response(webStream as any, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      // No Range - full file
      const stream = fs.createReadStream(absPath);
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) =>
            controller.enqueue(chunk)
          );
          stream.on("end", () => controller.close());
          stream.on("error", (err) =>
            controller.error(err)
          );
        },
        cancel() {
          stream.destroy();
        },
      });

      return new Response(webStream as any, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // No local and no S3 and no external_url - file not found
    // Do NOT fallback to Supabase for APKs per user request (Supabase 50MB limit, kept only for news)
    // This is likely a legacy Supabase path like "11.10/file.apk" from before Filebase migration
    // User should re-upload to Filebase via Admin
    return NextResponse.json(
      {
        success: false,
        message: `APK file not found: ${release.file_path}. Supabase bucket is no longer used for APKs (50MB limit). Re-upload via Admin → Releases → Filebase S3 5GB (persistent). Ensure Render env has S3_* for Filebase bucket winlator-releases (https://s3.filebase.com).`,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error(
      "Unexpected APK download error:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
