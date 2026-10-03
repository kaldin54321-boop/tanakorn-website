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

async function redirectToExternalUrl(externalUrl: string) {
  // Cloudflare-safe external download: 302 redirect, zero proxy bandwidth.
  //
  // Why redirect instead of proxy-streaming:
  // - Cloudflare Workers/Pages cannot reliably proxy multi-hundred-MB APKs
  //   (CPU/memory/time limits, error 1102 on double-stream).
  // - MediaFire/Google Drive frequently block Workers datacenter IPs, so a
  //   server-side fetch returns an HTML/challenge page instead of the APK.
  // - A 302 redirect costs ~0 bandwidth on Cloudflare (no paid bandwidth
  //   like Render) and lets the *user's browser* (residential IP) fetch the
  //   file directly with native resume/progress. No Render server needed.
  const trimmed = externalUrl.trim();
  let directUrl = trimmed;
  try {
    const resolved = await resolveExternalUrl(trimmed);
    if (resolved.provider === "mega") {
      throw new Error(
        "Mega.nz links require opening externally (mega requires decryption in browser). Please open the Mega link directly, or use a direct host like Google Drive (share link), MediaFire, R2/S3, or GitHub Releases."
      );
    }
    if (
      resolved.directUrl &&
      resolved.directUrl.startsWith("http") &&
      resolved.provider !== "mediafire_unresolved"
    ) {
      directUrl = resolved.directUrl;
    }
    // If MediaFire share link could not be resolved to a direct
    // download*.mediafire.com URL (e.g. Workers IP blocked), fall back to
    // redirecting to the original share page itself. The user's browser can
    // render it and click Download — this works where a server fetch fails.
  } catch (err) {
    if (err instanceof Error && err.message.includes("Mega.nz")) throw err;
    // Any other resolver failure: redirect to the original URL as-is.
    directUrl = trimmed;
  }

  return NextResponse.redirect(directUrl, 302);
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
        } catch {
          // Never fail info on Cloudflare (resolver fetches can be blocked
          // on Workers IPs) — fall back to DB values so the button still
          // renders and the redirect download still works.
          return NextResponse.json({
            success: true,
            version: release.version,
            file_name: release.file_name || `Winlator@Frost-${release.version}.apk`,
            file_size: release.file_size,
            content_type: release.file_type || "application/vnd.android.package-archive",
            external_url: release.external_url,
            resolved_url: release.external_url,
            provider: "external",
            fallback: true,
          });
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

    // External URL - 302 redirect to the resolved direct link (Cloudflare-safe).
    // No proxy streaming (avoids Workers bandwidth/CPU limits and IP blocks),
    // no Render dependency. The browser downloads directly with native
    // resume/progress. Download count is recorded client-side via /increment.
    if (release.external_url) {
      try {
        return await redirectToExternalUrl(release.external_url);
      } catch (err) {
        console.error("External URL redirect error:", err);
        return NextResponse.json(
          {
            success: false,
            message: `Failed to resolve external download URL: ${err instanceof Error ? err.message : "Unknown error"}.`,
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
              "APK file not found on this host. Re-upload via Admin → Releases to S3-compatible storage (persistent), or set an External APK URL (MediaFire / Google Drive share link works — downloads redirect directly, no server bandwidth).",
            file_path: release.file_path,
            hint: "Set S3 env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY), then re-upload the APK. Or use the External APK URL field.",
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
