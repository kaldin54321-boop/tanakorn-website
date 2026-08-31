import { createClient } from "@/lib/supabase/server";

export type PageView = {
  id: string;
  path: string;
  user_agent: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
};

function parseUA(ua: string | null) {
  if (!ua) return { browser: "Unknown", os: "Unknown" };
  const uaLower = ua.toLowerCase();
  let browser = "Other";
  if (uaLower.includes("edg/")) browser = "Edge";
  else if (uaLower.includes("chrome/") && !uaLower.includes("edg/")) browser = "Chrome";
  else if (uaLower.includes("safari/") && !uaLower.includes("chrome")) browser = "Safari";
  else if (uaLower.includes("firefox/")) browser = "Firefox";
  else if (uaLower.includes("opera") || uaLower.includes("opr/")) browser = "Opera";

  let os = "Other";
  if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "iOS";
  else if (uaLower.includes("windows")) os = "Windows";
  else if (uaLower.includes("mac os")) os = "macOS";
  else if (uaLower.includes("linux")) os = "Linux";

  return { browser, os };
}

export async function getAnalyticsStats() {
  const supabase = await createClient();

  // Try server-side aggregated RPC first (supports 1M+ efficiently, no 1000 row cap)
  try {
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc("get_analytics_stats");
    if (!rpcError && rpcData) {
      const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
      if (parsed && typeof parsed.totalViews === "number") {
        const toFullCountryName = (code: string): string => {
          if (!code || code === "Unknown") return "Unknown";
          const t = code.trim().toUpperCase();
          if (t.length !== 2) return code;
          try {
            const dn = new (Intl as any).DisplayNames(["en"], { type: "region" });
            return dn.of(t) || code;
          } catch { return code; }
        };
        const byCountryFull = (parsed.byCountry || []).map((c: any) => ({ name: toFullCountryName(c.name), count: c.count }));
        return {
          totalViews: parsed.totalViews ?? 0,
          byBrowser: parsed.byBrowser || [],
          byOS: parsed.byOS || [],
          byCountry: byCountryFull,
          topCountries: byCountryFull.slice(0, 20),
          exists: true,
        };
      }
    }
  } catch {}

  // Try exact count for totalViews (no row fetch, supports 1M)
  let totalViewsExact: number | null = null;
  try {
    const { count, error: countErr } = await supabase.from("page_views").select("id", { count: "exact", head: true });
    if (!countErr && typeof count === "number") totalViewsExact = count;
  } catch {}

  // Fallback: fetch with pagination to support up to 1M (previous limit 5000 capped at 1000 by PostgREST)
  const pageSize = 1000;
  const maxRows = 1000000;
  let allViews: PageView[] = [];
  let from = 0;
  let hasMore = true;
  let firstError: any = null;
  while (hasMore && allViews.length < maxRows) {
    const { data: views, error } = await supabase
      .from("page_views")
      .select("id, path, user_agent, country, browser, os, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      if (!firstError) firstError = error;
      break;
    }
    const batch = (views ?? []) as PageView[];
    allViews = allViews.concat(batch);
    if (batch.length < pageSize) hasMore = false;
    else from += pageSize;
    // Safety: if we fetched maxRows, stop
    if (allViews.length >= maxRows) hasMore = false;
  }

  if (firstError && allViews.length === 0) {
    const error = firstError;
    // Table may not exist yet
    if (error.code === "42P01" || error.message.includes("page_views")) {
      return {
        totalViews: 0,
        byBrowser: [] as { name: string; count: number }[],
        byOS: [] as { name: string; count: number }[],
        byCountry: [] as { name: string; count: number }[],
        topCountries: [] as { name: string; count: number }[],
        exists: false,
      };
    }
    console.error("Analytics error:", error.message);
    return {
      totalViews: 0,
      byBrowser: [],
      byOS: [],
      byCountry: [],
      topCountries: [],
      exists: false,
    };
  }

  const views: PageView[] | null = allViews.length ? allViews : null;
  const error: any = null;

  if (error) {
    // Table may not exist yet
    if (error.code === "42P01" || error.message.includes("page_views")) {
      return {
        totalViews: 0,
        byBrowser: [] as { name: string; count: number }[],
        byOS: [] as { name: string; count: number }[],
        byCountry: [] as { name: string; count: number }[],
        topCountries: [] as { name: string; count: number }[],
        exists: false,
      };
    }
    console.error("Analytics error:", error.message);
    return {
      totalViews: 0,
      byBrowser: [],
      byOS: [],
      byCountry: [],
      topCountries: [],
      exists: false,
    };
  }

  const list = (views ?? []) as PageView[];

  // Enrich missing browser/os from user_agent if needed
  const enriched = list.map((v) => {
    if (!v.browser || !v.os) {
      const p = parseUA(v.user_agent);
      return { ...v, browser: v.browser || p.browser, os: v.os || p.os };
    }
    return v;
  });

  // Use exact count from head query if available (supports 1M without fetching all rows)
  const totalViews = totalViewsExact ?? enriched.length;

  const countBy = (key: "browser" | "os" | "country") => {
    const map = new Map<string, number>();
    for (const v of enriched) {
      const k = (v as any)[key] || "Unknown";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Map country codes (e.g., US, TH) to full names via Intl.DisplayNames
  function toFullCountryName(code: string): string {
    if (!code || code === "Unknown") return "Unknown";
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 2) return code; // already full? keep as is
    try {
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
      const full = dn.of(trimmed);
      return full || code;
    } catch {
      return code;
    }
  }

  const byBrowser = countBy("browser");
  const byOS = countBy("os");
  const byCountryRaw = countBy("country");
  const byCountry = byCountryRaw.map(({ name, count }) => ({ name: toFullCountryName(name), count }));
  const topCountries = byCountry.slice(0, 20);

  return {
    totalViews,
    byBrowser,
    byOS,
    byCountry,
    topCountries,
    exists: true,
  };
}
