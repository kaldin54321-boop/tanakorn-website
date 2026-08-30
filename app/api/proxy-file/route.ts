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

    // If URL is a share link (MediaFire/Google Drive), resolve to direct link first (on Render, not blocked)
    let fetchUrl = decoded;
    try {
      const resolved = await resolveExternalUrl(decoded);
      // If resolved to a different direct URL (e.g., share -> download*.mediafire.com or drive uc?export=download), use it
      // For MediaFire, the direct link is temporary but fresh at request time, so not expired
      if (resolved.directUrl && resolved.directUrl !== decoded && resolved.provider !== "generic") {
        fetchUrl = resolved.directUrl;
      } else if (resolved.provider === "generic" && decoded.includes("mediafire.com/file/")) {
        // Fallback: if generic but still a share link, keep original and let fetch handle HTML extraction below
        fetchUrl = decoded;
      }
    } catch {}

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
    // For MediaFire share HTML that wasn't resolved (fallback), try to extract direct link from HTML and fetch
    if (ct.includes("text/html") && fetchUrl.includes("mediafire.com/file/")) {
      const html = await res.clone().text().catch(() => "");
      const m = html.match(/href="(https:\/\/download[^"]+)"/i) || html.match(/https:\/\/download\d*\.mediafire\.com[^"'\s<>]+/i);
      if (m) {
        const direct = (m[1] || m[0]).replace(/&amp;/g, "&");
        const r2 = await fetch(direct, { headers: { ...headers, Referer: "https://www.mediafire.com/" }, redirect: "follow" });
        if (r2.ok || r2.status === 206) res = r2;
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
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Proxy failed" }, { status: 500 });
  }
}
