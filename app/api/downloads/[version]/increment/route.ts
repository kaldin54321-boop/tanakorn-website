import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createSupabaseJs(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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

  const supabaseAnon = await createClient();
  const serviceSupabase = getServiceSupabase();

  // 1) Try atomic RPC via anon (SECURITY DEFINER allows anon if function exists)
  const { data: rpcData, error: rpcError } = await (supabaseAnon as any).rpc("increment_download_count", { p_version: version });
  if (!rpcError && rpcData !== null && rpcData !== undefined) {
    const count = typeof rpcData === "number" ? rpcData : (rpcData as any).download_count ?? (rpcData as any);
    const numeric = typeof count === "number" ? count : parseInt(String(count), 10);
    if (!isNaN(numeric)) return NextResponse.json({ success: true, download_count: numeric }, { headers: { "Cache-Control": "no-store" } });
  }
  // If RPC missing (42883) or permission error, try service_role RPC
  if (serviceSupabase) {
    const { data: rpcData2, error: rpcError2 } = await (serviceSupabase as any).rpc("increment_download_count", { p_version: version });
    if (!rpcError2 && rpcData2 !== null && rpcData2 !== undefined) {
      const count = typeof rpcData2 === "number" ? rpcData2 : (rpcData2 as any).download_count ?? (rpcData2 as any);
      const numeric = typeof count === "number" ? count : parseInt(String(count), 10);
      if (!isNaN(numeric)) return NextResponse.json({ success: true, download_count: numeric }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  // 2) Fallback: use service_role to bypass RLS for public increments (counts all users, not just admin)
  const supabaseForWrite = serviceSupabase || supabaseAnon;

  const { data: release, error: fetchError } = await supabaseForWrite
    .from("releases")
    .select("id, download_count")
    .eq("version", version)
    .maybeSingle();

  if (fetchError || !release) {
    // If anon read failed due to RLS, try service
    if (serviceSupabase && supabaseForWrite === supabaseAnon) {
      const { data: release2, error: fetchError2 } = await serviceSupabase.from("releases").select("id, download_count").eq("version", version).maybeSingle();
      if (!fetchError2 && release2) {
        const newCount = ((release2 as any).download_count ?? 0) + 1;
        const { error: updateError2 } = await serviceSupabase.from("releases").update({ download_count: newCount }).eq("id", (release2 as any).id);
        if (!updateError2) return NextResponse.json({ success: true, download_count: newCount }, { headers: { "Cache-Control": "no-store" } });
      }
    }
    return NextResponse.json({ success: false, message: "Release not found" }, { status: 404 });
  }

  const newCount = (release.download_count ?? 0) + 1;

  const { error: updateError } = await supabaseForWrite
    .from("releases")
    .update({ download_count: newCount })
    .eq("id", release.id);

  if (updateError) {
    // If anon update failed due to RLS, retry with service_role if available
    if (serviceSupabase && supabaseForWrite === supabaseAnon && (updateError.code === "42501" || updateError.message.toLowerCase().includes("policy") || updateError.message.toLowerCase().includes("permission"))) {
      const { error: updateError2 } = await serviceSupabase.from("releases").update({ download_count: newCount }).eq("id", release.id);
      if (!updateError2) return NextResponse.json({ success: true, download_count: newCount }, { headers: { "Cache-Control": "no-store" } });
    }
    if (updateError.code === "42703" || updateError.message.includes("download_count")) {
      return NextResponse.json({ success: true, download_count: newCount, warning: "download_count column missing, create it via SQL: run supabase-download-count.sql in Supabase SQL Editor" }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, download_count: newCount }, { headers: { "Cache-Control": "no-store" } });
}
