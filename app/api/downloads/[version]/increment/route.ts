import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ version: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { version: rawVersion } = await context.params;
  const version = decodeURIComponent(rawVersion);
  if (!version) return NextResponse.json({ success: false, message: "Version required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("releases").select("download_count").eq("version", version).maybeSingle();
  if (error || !data) return NextResponse.json({ success: false, message: "Release not found" }, { status: 404 });
  return NextResponse.json(
    { success: true, download_count: (data as any).download_count ?? 0 },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { version: rawVersion } = await context.params;
  const version = decodeURIComponent(rawVersion);
  if (!version) {
    return NextResponse.json({ success: false, message: "Version required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Try atomic increment via RPC if exists, else fallback to read+update
  // RPC: increment_download_count(p_version text) returns integer
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc("increment_download_count", { p_version: version });
  if (!rpcError && rpcData !== null && rpcData !== undefined) {
    const count = typeof rpcData === "number" ? rpcData : (rpcData as any).download_count ?? (rpcData as any);
    const numeric = typeof count === "number" ? count : parseInt(String(count), 10);
    if (!isNaN(numeric)) return NextResponse.json({ success: true, download_count: numeric });
  }

  // Fallback: read+update (not perfectly atomic but works)
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
    if (updateError.code === "42703" || updateError.message.includes("download_count")) {
      return NextResponse.json({ success: true, download_count: newCount, warning: "download_count column missing, create it via SQL" });
    }
    return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, download_count: newCount });
}
