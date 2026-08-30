import { NextResponse } from "next/server";
import { resolveExternalUrl } from "@/lib/external-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public resolver for share links (MediaFire, Google Drive, Dropbox)
// Used as fallback for Cloudflare Workers when direct fetch of share page is blocked by bot protection
// Cloudflare Worker can call this on Render (Node) which is not blocked by MediaFire/Google Drive
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ success: false, message: "Missing url param" }, { status: 400 });
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      decoded = url;
    }
    // Basic validation
    try {
      const u = new URL(decoded);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return NextResponse.json({ success: false, message: "URL must be http/https" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, message: "Invalid URL" }, { status: 400 });
    }

    const resolved = await resolveExternalUrl(decoded);

    return NextResponse.json(
      {
        success: true,
        original: decoded,
        directUrl: resolved.directUrl,
        provider: resolved.provider,
        needsProxy: resolved.needsProxy,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Resolve failed" },
      { status: 500 }
    );
  }
}
