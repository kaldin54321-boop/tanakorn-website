import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ version: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { version: rawVersion } = await context.params;
  const version = decodeURIComponent(rawVersion);
  if (!version) {
    return NextResponse.json({ success: false, message: "Version required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Get current count
  const { data: release, error: fetchError } = await supabase
    .from("releases")
    .select("id, download_count")
    .eq("version", version)
    .maybeSingle();

  if (fetchError || !release) {
    return NextResponse.json({ success: false, message: "Release not found" }, { status: 404 });
  }

  const newCount = (release.download_count ?? 0) + 1;

  const { error: updateError } = await supabase
    .from("releases")
    .update({ download_count: newCount })
    .eq("id", release.id);

  if (updateError) {
    // If column missing, don't fail hard
    if (updateError.code === "42703" || updateError.message.includes("download_count")) {
      return NextResponse.json({ success: true, download_count: newCount, warning: "download_count column missing, create it via SQL" });
    }
    return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, download_count: newCount });
}
