import { NextResponse } from "next/server";
import { resolveExternalUrl } from "@/lib/external-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy for external file download via Render (Node) - bypasses Cloudflare Workers IP block on MediaFire/Google Drive
// Cloudflare Worker calls this when direct fetch of external URL returns HTML (blocked)
// This runs on Render (Node) which is not blocked, so it can fetch and stream the file
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const fileName = searchParams.get("filename") || "download.apk";

    if (!url) {
      return NextResponse.json({ success: false, message: "Missing url param" }, { status: 400 });
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      decoded = url;
    }

    try {
      const u = new URL(decoded);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return NextResponse.json({ success: false, message: "URL must be http/https" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, message: "Invalid URL" }, { status: 400 });
    }

    // If URL is a share link (MediaFire/Google Drive), resolve to direct link first (on Render, not blocked, fresh at request time)
    let fetchUrl = decoded;
    let resolvedProvider: string | null = null;
    try {
      const resolved = await resolveExternalUrl(decoded);
      if (resolved.directUrl && resolved.directUrl !== decoded && resolved.provider !== "generic") {
        fetchUrl = resolved.directUrl;
        resolvedProvider = resolved.provider;
      } else if (resolved.provider === "generic" && decoded.includes("mediafire.com/file/")) {
        fetchUrl = decoded;
      } else if (resolved.directUrl) {
        fetchUrl = resolved.directUrl;
        resolvedProvider = resolved.provider;
      }
    } catch {}
    // If still a MediaFire share link and not resolved to direct, try to keep original for HTML extraction below
    // The HTML extraction below will handle share links that weren't resolved

    const range = request.headers.get("range") || undefined;
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: fetchUrl.includes("mediafire.com") ? "https://www.mediafire.com/" : fetchUrl.includes("drive.google.com") ? "https://drive.google.com/" : undefined as any,
    };
    // Remove undefined Referer
    if (!headers["Referer"]) delete (headers as any)["Referer"];
    if (range) headers["Range"] = range;

    let res = await fetch(fetchUrl, {
      headers,
      redirect: "follow",
    });

    // Handle Google Drive virus scan warning or MediaFire HTML on Render (should not happen often, but handle)
    const ct = res.headers.get("Content-Type") || "";
    if (ct.includes("text/html") && fetchUrl.includes("drive.google.com")) {
      const html = await res.clone().text().catch(() => "");
      const m = html.match(/href="([^"]*export=download[^"]*confirm=[^"]*)"/i);
      if (m) {
        const confirmUrl = m[1].replace(/&amp;/g, "&");
        const abs = confirmUrl.startsWith("http") ? confirmUrl : `https://drive.google.com${confirmUrl}`;
        const r2 = await fetch(abs, { headers, redirect: "follow" });
        if (r2.ok || r2.status === 206) res = r2;
      }
    }
    // For MediaFire share HTML that wasn't resolved (fallback), try to extract direct link from HTML and fetch - robust for current MediaFire structure + API
    if (ct.includes("text/html") && (fetchUrl.includes("mediafire.com/file/") || fetchUrl.includes("mediafire.com/view/"))) {
      const html = await res.clone().text().catch(() => "");
      let m: RegExpMatchArray | null = null;
      m = html.match(/aria-label="Download[^"]*"\s*href="(https:\/\/download[^"]+)"/i);
      if (!m) m = html.match(/id="downloadButton"[^>]*href="(https:\/\/[^"]+)"/i);
      if (!m) m = html.match(/class="input[^"]*"\s*href="(https:\/\/download[^"]+)"/i);
      if (!m) m = html.match(/href="(https:\/\/download[^\"]*\.mediafire\.com[^\"]*)"/i);
      if (!m) m = html.match(/data-url="(https:\/\/download[^"]+)"/i);
      if (!m) m = html.match(/window\.location\s*=\s*"(https:\/\/download[^"]+)"/i);
      if (!m) m = html.match(/href='(https:\/\/download[^']+)'/i);
      // Markdown style in some Render HTML
      if (!m) {
        const mdM = html.match(/\[Download[^\]]*\]\(https:\/\/download[^\)]+\)/i) as any;
        if (mdM) {
          const mdUrl = (mdM[0] as string).match(/https:\/\/download[^\)]+/i);
          if (mdUrl) m = [mdUrl[0], mdUrl[0]] as any;
        }
      }
      if (!m) {
        const all = [...html.matchAll(/https:\/\/download\d*\.mediafire\.com[^"'\s<>\)\]]+/gi)];
        if (all.length > 0) m = [all[0][0], all[0][0]] as any;
      }
      // Try MediaFire API with quick_key from URL if HTML patterns fail (most reliable for share links)
      if (!m) {
        const qkMatch = fetchUrl.match(/\/file\/([a-zA-Z0-9]+)\//) || html.match(/\/file\/([a-zA-Z0-9]+)\//);
        if (qkMatch) {
          const quickKey = qkMatch[1];
          for (const apiUrl of [
            `https://www.mediafire.com/api/1.4/file/get_info.php?quick_key=${quickKey}&response_format=json`,
            `https://www.mediafire.com/api/1.5/file/get_info.php?quick_key=${quickKey}&response_format=json`,
          ]) {
            try {
              const apiRes = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
              if (apiRes.ok) {
                const j = await apiRes.json().catch(() => null);
                const cand = j?.response?.file_info?.links?.normal_download || j?.response?.file_info?.links?.direct_download;
                if (cand && typeof cand === "string" && cand.includes("mediafire.com")) {
                  m = [cand, cand] as any;
                  break;
                }
              }
            } catch {}
          }
        }
      }
      if (m) {
        const direct = (m[1] || m[0]).replace(/&amp;/g, "&").replace(/[\)\]]+$/, "");
        const r2 = await fetch(direct, { headers: { ...headers, Referer: "https://www.mediafire.com/" }, redirect: "follow" });
        if (r2.ok || r2.status === 206) {
          const ct2 = r2.headers.get("Content-Type") || "";
          const cd2 = r2.headers.get("Content-Disposition") || "";
          if (!ct2.includes("text/html") || cd2.includes("attachment") || r2.headers.get("Content-Length")) {
            res = r2;
          } else {
            const html2 = await r2.clone().text().catch(() => "");
            const m2 = html2.match(/href="(https:\/\/download[^"]+)"/i) || html2.match(/https:\/\/download\d*\.mediafire\.com[^"'\s<>]+/i);
            if (m2) {
              const direct2 = (m2[1] || m2[0]).replace(/&amp;/g, "&");
              const r3 = await fetch(direct2, { headers: { ...headers, Referer: "https://www.mediafire.com/" }, redirect: "follow" });
              if (r3.ok || r3.status === 206) res = r3;
            }
          }
        }
      }
    }

    if (!res.ok && res.status !== 206) {
      return NextResponse.json({ success: false, message: `Failed to fetch external file: ${res.status} ${res.statusText}` }, { status: 502 });
    }

    const contentLength = res.headers.get("Content-Length");
    const contentRange = res.headers.get("Content-Range");
    const contentType = res.headers.get("Content-Type") || "application/vnd.android.package-archive";
    const contentDisposition = res.headers.get("Content-Disposition") || `attachment; filename="${fileName}"`;

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Accept-Language, Referer, User-Agent",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Disposition, Accept-Ranges",
    };
    if (contentLength) responseHeaders["Content-Length"] = contentLength;
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json({ success: false, message: "No readable stream" }, { status: 502 });
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
      status: res.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Proxy failed" }, { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "*" } });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Accept-Language, Referer, User-Agent, *",
      "Access-Control-Max-Age": "86400",
    },
  });
}
