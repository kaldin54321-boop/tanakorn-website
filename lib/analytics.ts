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

  // Try to fetch page_views
  const { data: views, error } = await supabase
    .from("page_views")
    .select("id, path, user_agent, country, browser, os, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

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

  const totalViews = enriched.length;

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

  const byBrowser = countBy("browser");
  const byOS = countBy("os");
  const byCountry = countBy("country");
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
