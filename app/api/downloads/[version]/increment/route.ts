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

const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" };

// Single canonical read used by both GET and POST, so a value returned by
// POST can never disagree with a later GET (the old cause of the visible
// "+1 then revert" bug).
async function getCanonicalCount(client: any, version: string): Promise<number | null> {
  // Preferred: atomic RPC that sums releases + download_events (for public fallback)
  try {
    const { data: rpcCount, error: rpcErr } = await client.rpc("get_public_download_count", { p_version: version });
    if (!rpcErr && typeof rpcCount === "number") return rpcCount;
  } catch {}
  const { data, error } = await client.from("releases").select("download_count").eq("version", version).maybeSingle();
  if (error || !data) return null;
  // Add fallback download_events count if the table exists (missing table -> 0)
  let extra = 0;
  try {
    const { count } = await client.from("download_events").select("id", { count: "exact", head: true }).eq("version", version);
    extra = count ?? 0;
  } catch {}
  return ((data as any).download_count ?? 0) + extra;
}

export async function GET(request: Request, context: RouteContext) {
  const { version: rawVersion } = await context.params;
  const version = decodeURIComponent(rawVersion);
  if (!version) return NextResponse.json({ success: false, message: "Version required" }, { status: 400 });
  const supabase = await createClient();
  const count = await getCanonicalCount(supabase, version);
  if (count === null) return NextResponse.json({ success: false, message: "Release not found" }, { status: 404 });
  return NextResponse.json({ success: true, download_count: count }, { headers: noStoreHeaders });
}

export async function POST(request: Request, context: RouteContext) {
  const { version: rawVersion } = await context.params;
  const version = decodeURIComponent(rawVersion);
  if (!version) {
    return NextResponse.json({ success: false, message: "Version required" }, { status: 400 });
  }

  const supabaseAnon = await createClient();
  const serviceSupabase = getServiceSupabase();

  const baseline = await getCanonicalCount(supabaseAnon, version);
  if (baseline === null) {
    return NextResponse.json({ success: false, message: "Release not found" }, { status: 404 });
  }

  // Verify helper: only trust an increment path if a fresh canonical
  // re-read proves the count actually grew. RLS can make an UPDATE
  // "succeed" with 0 rows affected, which previously produced a fake
  // +1 that the next poll reverted.
  const verify = async (): Promise<number | null> => {
    const fresh = await getCanonicalCount(supabaseAnon, version);
    if (fresh !== null && fresh >= baseline + 1) return fresh;
    return null;
  };

  // 1) Atomic RPC via anon (SECURITY DEFINER allows anon if function exists)
  try {
    const { data: rpcData, error: rpcError } = await (supabaseAnon as any).rpc("increment_download_count", { p_version: version });
    if (!rpcError && rpcData !== null && rpcData !== undefined) {
      const verified = await verify();
      if (verified !== null) return NextResponse.json({ success: true, download_count: verified }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {}
  // 1b) Same RPC via service_role if configured
  if (serviceSupabase) {
    try {
      const { data: rpcData2, error: rpcError2 } = await (serviceSupabase as any).rpc("increment_download_count", { p_version: version });
      if (!rpcError2 && rpcData2 !== null && rpcData2 !== undefined) {
        const verified = await verify();
        if (verified !== null) return NextResponse.json({ success: true, download_count: verified }, { headers: { "Cache-Control": "no-store" } });
      }
    } catch {}
  }

  // 2) Read + update with verification (works when RLS/policies allow it)
  const writer = serviceSupabase || supabaseAnon;
  try {
    const { data: release, error: fetchError } = await writer
      .from("releases")
      .select("id, download_count")
      .eq("version", version)
      .maybeSingle();
    if (!fetchError && release) {
      const newCount = ((release as any).download_count ?? 0) + 1;
      const { data: updated, error: updateError } = await writer
        .from("releases")
        .update({ download_count: newCount })
        .eq("id", (release as any).id)
        .select("download_count")
        .maybeSingle();
      // updateError null does NOT prove persistence (RLS can silently
      // affect 0 rows), so the re-read below is the real check.
      if (!updateError && updated) {
        const verified = await verify();
        if (verified !== null) return NextResponse.json({ success: true, download_count: verified }, { headers: { "Cache-Control": "no-store" } });
      }
    }
  } catch {}

  // 3) Fallback for public users when releases writes are blocked:
  // insert into download_events (public) — only if the table exists.
  try {
    const { error: insertErr } = await supabaseAnon.from("download_events").insert({ version });
    if (!insertErr) {
      const verified = await verify();
      if (verified !== null) return NextResponse.json({ success: true, download_count: verified }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {}

  // Nothing persisted: be honest instead of returning a fabricated +1
  // (a fake number is exactly what the UI later "reverted").
  // Durable fix: run supabase-download-count.sql in the Supabase SQL Editor
  // (creates the atomic RPC + public policies), then increments persist.
  return NextResponse.json(
    {
      success: false,
      needsSetup: true,
      download_count: baseline,
      message: "Download counter is not configured in the database. Run supabase-download-count.sql in the Supabase SQL Editor to enable persistent counts.",
    },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}
