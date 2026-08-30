import { NextResponse } from "next/server";

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

    const range = request.headers.get("range") || undefined;
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    };
    if (range) headers["Range"] = range;

    const res = await fetch(decoded, {
      headers,
      redirect: "follow",
    });

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
