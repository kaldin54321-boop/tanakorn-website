import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { getAnalyticsStats } from "@/lib/analytics";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatDate(date: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(date: string | null) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { data: releases, error: releasesError },
    { data: news, error: newsError },
    analytics,
  ] = await Promise.all([
    supabase
      .from("releases")
      .select(
        "id, version, name, status, architecture, release_date, file_path, file_size, visibility, created_at, download_count"
      )
      .order("release_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("news")
      .select(
        "id, title, slug, category, published, published_at, created_at"
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getAnalyticsStats(),
  ]);

  const releaseList = releases ?? [];
  const newsList = (news ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    published: boolean;
    published_at: string | null;
    created_at: string;
  }>;

  const totalReleases = releaseList.length;
  const publishedReleases = releaseList.filter(
    (r) => r.visibility === "published"
  ).length;

  const totalNews = newsList.length;
  const publishedNews = newsList.filter(
    (n) => n.published
  ).length;

  const filesCount = releaseList.filter(
    (r) => Boolean(r.file_path)
  ).length;

  const totalBytes = releaseList.reduce(
    (sum, r) => sum + (r.file_size ?? 0),
    0
  );

  const storageLabel =
    totalBytes === 0
      ? "0 GB"
      : totalBytes < 1024 * 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  const latestRelease =
    releaseList[0] ?? null;

  // Build recent activity from latest releases + news
  type ActivityItem = {
    id: string;
    title: string;
    subtitle: string;
    date: string | null;
  };

  const activity: ActivityItem[] = [];

  // Add up to 2 latest releases
  for (const r of releaseList.slice(0, 2)) {
    activity.push({
      id: `release-${r.id}`,
      title: r.name,
      subtitle:
        r.visibility === "published"
          ? "Release published"
          : "Release draft",
      date: r.release_date || r.created_at,
    });
  }

  // Add up to 2 latest published news
  for (const n of newsList.slice(0, 2)) {
    activity.push({
      id: `news-${n.id}`,
      title: n.title,
      subtitle: n.published
        ? "News article published"
        : "News draft saved",
      date: n.published_at || n.created_at,
    });
  }

  // Sort activity by date desc and take 4
  activity.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const recentActivity = activity.slice(0, 4);

  return (
    <div className="admin-dashboard">

      <header className="admin-header">

        <div>
          <p>
            WINLATOR@FROST
          </p>

          <h1>
            Dashboard
          </h1>
        </div>

        <div className="admin-status">
          <span />
          SYSTEM ONLINE
        </div>

      </header>

      {(releasesError || newsError) && (
        <div className="admin-error" style={{ marginBottom: "16px" }}>
          {releasesError
            ? `Releases: ${releasesError.message}`
            : ""}
          {newsError
            ? ` News: ${newsError.message}`
            : ""}
        </div>
      )}

      <section className="admin-stats">

        <div className="admin-stat-card">

          <span>
            RELEASES
          </span>

          <strong>
            {totalReleases}
          </strong>

          <small>
            {publishedReleases} published
            {totalReleases - publishedReleases > 0
              ? ` · ${totalReleases - publishedReleases} drafts`
              : ""}
          </small>

        </div>

        <div className="admin-stat-card">

          <span>
            NEWS
          </span>

          <strong>
            {totalNews}
          </strong>

          <small>
            {publishedNews} published
            {totalNews - publishedNews > 0
              ? ` · ${totalNews - publishedNews} drafts`
              : " articles"}
          </small>

        </div>

        <div className="admin-stat-card">

          <span>
            FILES
          </span>

          <strong>
            {filesCount}
          </strong>

          <small>
            Stored release files
          </small>

        </div>

        <div className="admin-stat-card">

          <span>
            STORAGE
          </span>

          <strong>
            {storageLabel}
          </strong>

          <small>
            {totalBytes > 0
              ? formatFileSize(totalBytes) + " currently used"
              : "Currently used"}
          </small>

        </div>

      </section>

      <section className="admin-dashboard-grid">

        <div className="admin-panel">

          <div className="admin-panel-header">

            <div>
              <span>
                RELEASE MANAGEMENT
              </span>

              <h2>
                Latest Release
              </h2>
            </div>

            <Link
              href="/admin/releases"
              className="admin-link"
            >
              View All →
            </Link>

          </div>

          {latestRelease ? (
            <div className="admin-release-preview">

              <div className="admin-release-version">
                {latestRelease.version}
              </div>

              <div>

                <h3>
                  {latestRelease.name}
                </h3>

                <p>
                  {latestRelease.status} ·{" "}
                  {latestRelease.architecture} ·{" "}
                  {formatDate(
                    latestRelease.release_date
                  )}
                  {latestRelease.visibility !==
                    "published" && " · Draft"}
                </p>

              </div>

              <span className="admin-badge">
                {latestRelease.status.toUpperCase()}
              </span>

            </div>
          ) : (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "var(--muted)",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
              }}
            >
              <p
                style={{
                  marginBottom: "12px",
                  fontWeight: 700,
                }}
              >
                No releases yet
              </p>
              <Link
                href="/admin/releases/new"
                className="button-primary"
                style={{ width: "fit-content" }}
              >
                Create First Release
              </Link>
            </div>
          )}

        </div>

        <div className="admin-panel">

          <div className="admin-panel-header">

            <div>
              <span>
                QUICK ACTIONS
              </span>

              <h2>
                Management
              </h2>
            </div>

          </div>

          <div className="quick-actions">

            <Link href="/admin/releases/new">
              <span>+</span>
              Create Release
            </Link>

            <Link href="/admin/news/new">
              <span>+</span>
              Create News
            </Link>

            <Link href="/admin/files">
              <span>↑</span>
              Manage Files
            </Link>

          </div>

        </div>

      </section>

      <section className="admin-panel">

        <div className="admin-panel-header">

          <div>
            <span>
              SYSTEM
            </span>

            <h2>
              Activity
            </h2>
          </div>

        </div>

        <div className="activity-list">

          {recentActivity.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              No activity yet. Create a release or
              news article to see it here.
            </div>
          ) : (
            recentActivity.map((item) => (
              <div key={item.id}>
                <span className="activity-dot" />

                <div>
                  <strong>
                    {item.title}
                  </strong>

                  <p>
                    {item.subtitle}
                  </p>
                </div>

                <time>
                  {timeAgo(item.date)}
                </time>
              </div>
            ))
          )}

        </div>

      </section>

      <section className="admin-panel">

        <div className="admin-panel-header">
          <div>
            <span>ANALYTICS</span>
            <h2>Website Statistics</h2>
          </div>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>{analytics.totalViews.toLocaleString()} total views</span>
        </div>

        {!analytics.exists ? (
          <div style={{ padding: "20px", border: "1px dashed var(--border)", borderRadius: "10px", textAlign: "center", color: "var(--muted)" }}>
            <p style={{ fontWeight: 700, color: "var(--foreground)" }}>Analytics not yet set up</p>
            <p style={{ fontSize: "13px", marginTop: "8px" }}>Create Supabase table <code>page_views</code> to track views:</p>
            <pre style={{ textAlign: "left", marginTop: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", fontSize: "11px", overflowX: "auto" }}>{`create table page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  user_agent text,
  country text,
  browser text,
  os text,
  created_at timestamptz default now()
);
alter table page_views enable row level security;
create policy "allow all" on page_views for all using (true) with check (true);`}</pre>
            <p style={{ fontSize: "12px", marginTop: "12px" }}>Also ensure <code>releases.download_count</code> column exists for download counts.</p>
          </div>
        ) : (
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Total Views</h3>
              <strong>{analytics.totalViews.toLocaleString()}</strong>
              <small>All page views</small>
            </div>
            <div className="analytics-card">
              <h3>By Browser</h3>
              {analytics.byBrowser.length === 0 ? <small>No data</small> : analytics.byBrowser.slice(0, 5).map((b: { name: string; count: number }) => (
                <div key={b.name} className="analytics-row"><span>{b.name}</span><span>{b.count}</span></div>
              ))}
            </div>
            <div className="analytics-card">
              <h3>By OS</h3>
              {analytics.byOS.length === 0 ? <small>No data</small> : analytics.byOS.slice(0, 5).map((o: { name: string; count: number }) => (
                <div key={o.name} className="analytics-row"><span>{o.name}</span><span>{o.count}</span></div>
              ))}
            </div>
            <div className="analytics-card">
              <h3>Top Locations</h3>
              {analytics.topCountries.length === 0 ? <small>No data</small> : analytics.topCountries.slice(0, 10).map((c: { name: string; count: number }, i: number) => (
                <div key={c.name} className="analytics-row"><span>{i + 1}. {c.name}</span><span>{c.count}</span></div>
              ))}
            </div>
          </div>
        )}

        {analytics.exists && analytics.topCountries.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Top 20 Countries</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {analytics.topCountries.slice(0, 20).map((c: { name: string; count: number }, i: number) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}>
                  <span>{i + 1}. {c.name}</span>
                  <strong>{c.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

      </section>

    </div>
  );
}
