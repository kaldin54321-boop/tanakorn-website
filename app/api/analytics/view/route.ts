import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseUA(ua: string | null) {
  if (!ua) return { browser: "Unknown", os: "Unknown" };
  const l = ua.toLowerCase();
  let browser = "Other";
  if (l.includes("edg/")) browser = "Edge";
  else if (l.includes("chrome/") && !l.includes("edg/")) browser = "Chrome";
  else if (l.includes("safari/") && !l.includes("chrome")) browser = "Safari";
  else if (l.includes("firefox/")) browser = "Firefox";
  else if (l.includes("opera") || l.includes("opr/")) browser = "Opera";
  let os = "Other";
  if (l.includes("android")) os = "Android";
  else if (l.includes("iphone") || l.includes("ipad")) os = "iOS";
  else if (l.includes("windows")) os = "Windows";
  else if (l.includes("mac os")) os = "macOS";
  else if (l.includes("linux")) os = "Linux";
  return { browser, os };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const path = String(body.path ?? "/").slice(0, 200);
    const userAgent = request.headers.get("user-agent") ?? null;
    const country =
      (request.headers.get("x-vercel-ip-country") ??
        request.headers.get("cf-ipcountry") ??
        request.headers.get("x-country") ??
        null) as string | null;

    const { browser, os } = parseUA(userAgent);

    const supabase = await createClient();
    const { error } = await supabase.from("page_views").insert({
      path,
      user_agent: userAgent?.slice(0, 400) ?? null,
      country: country?.slice(0, 50) ?? "Unknown",
      browser,
      os,
    });

    if (error && error.code !== "42P01") {
      console.error("page_views insert error:", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("analytics view error", e);
    return NextResponse.json({ success: true });
  }
}
