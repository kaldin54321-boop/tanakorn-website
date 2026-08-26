import Link from "next/link";

import {
  getPublicReleases,
} from "@/lib/releases";

import {
  getPublicNews,
} from "@/lib/news";

import {
  getPublicYoutubeVideos,
} from "@/lib/youtube";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatReleaseDate(
  date: string
) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

export default async function Home() {
  const [releases, news, youtubeVideos] =
    await Promise.all([
      getPublicReleases(),
      getPublicNews(),
      getPublicYoutubeVideos(),
    ]);

  const latestRelease =
    releases[0] ?? null;

  const latestNews =
    news.slice(0, 3);

  return (
    <main>

      <section className="hero">

        <div className="hero-glow" />

        <div className="hero-content">

          {latestRelease ? (
            <div className="release-badge">
              ✦ {latestRelease.name}{" "}
              v{latestRelease.version} ·{" "}
              {latestRelease.status}
            </div>
          ) : (
            <div className="release-badge">
              ✦ Winlator@Frost · Stay Frosty
            </div>
          )}

          <p className="hero-eyebrow">
            WINDOWS EXPERIENCE · ANDROID
          </p>

          <h1>
            WINLATOR
            <span>@FROST</span>
          </h1>

          <p className="hero-description">
            A customized Winlator experience built for
            performance, flexibility and advanced
            Windows application support on Android.
          </p>

          <div className="hero-actions">

            <Link
              href={
                latestRelease
                  ? `/downloads/${latestRelease.version}`
                  : "/downloads"
              }
              className="button-primary"
            >
              Download Latest
            </Link>

          </div>

          <div className="hero-support">
            <p>Support Frost</p>
            <div className="support-buttons">
              <a href="https://ko-fi.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button kofi">Ko-fi</a>
              <a href="https://buymeacoffee.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button bmc">Buy Me a Coffee</a>
              <a href="https://paypal.me/MUHAMMADINISMAIL" target="_blank" rel="noopener noreferrer" className="support-button paypal">PayPal</a>
            </div>
          </div>

        </div>

      </section>

      <section className="release-section">

        <div className="section-heading">
          <p>LATEST RELEASE</p>
          <h2>Experience Frost</h2>
        </div>

        {latestRelease ? (
          <div className="release-card">

            <div>
              <span className="release-label">
                {latestRelease.status.toUpperCase()}{" "}
                RELEASE
              </span>

              <h3>
                {latestRelease.name}
              </h3>

              <p>
                {latestRelease.architecture}
                {latestRelease.status
                  ? ` · ${latestRelease.status}`
                  : ""}
                {" · "}
                {formatReleaseDate(
                  latestRelease.release_date
                )}
                {latestRelease.version
                  ? ` · v${latestRelease.version}`
                  : ""}
              </p>

              {latestRelease.description && (
                <div
                  className="release-description-fixed"
                  style={{
                    marginTop: "10px",
                    maxWidth: "600px",
                    lineHeight: "1.7",
                    color: "var(--muted)",
                    whiteSpace: "pre-line",
                    wordBreak: "break-word",
                  }}
                >
                  {latestRelease.description}
                </div>
              )}
            </div>

            <Link
              href={`/downloads/${latestRelease.version}`}
              className="button-primary"
            >
              Download
            </Link>

          </div>
        ) : (
          <div className="release-card">
            <div>
              <span className="release-label">
                NO RELEASE YET
              </span>
              <h3>
                Stay Tuned
              </h3>
              <p>
                No public releases are available at
                the moment.
              </p>
            </div>
            <Link
              href="/downloads"
              className="button-primary"
            >
              View Downloads
            </Link>
          </div>
        )}

      </section>

      <section className="features-section">

  <div className="section-heading">
    <p>WHY FROST</p>
    <h2>Built Different</h2>
  </div>

  <div className="features-grid">

    <div className="feature-card">
      <div className="feature-icon">⚡</div>

      <h3>Performance</h3>

      <p>
        Optimized components and configurations
        designed for a smooth Windows experience
        on supported Android devices.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">🎮</div>

      <h3>Gaming</h3>

      <p>
        Run supported Windows applications and games
        through a customized Wine environment.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">⚙</div>

      <h3>Customization</h3>

      <p>
        Advanced configuration options give users
        more control over their Windows environment.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">❄</div>

      <h3>Frost Experience</h3>

      <p>
        A customized Winlator experience with
        additional features and improvements.
      </p>
    </div>

  </div>

</section>

<section className="news-section">

  <div className="section-heading news-heading">

    <div>
      <p>LATEST NEWS</p>
      <h2>From Frost</h2>
    </div>

    <Link
      href="/news"
      className="text-link"
    >
      View all news →
    </Link>

  </div>

  {latestNews.length === 0 ? (
    <div
      style={{
        marginTop: "30px",
        padding: "40px",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        background: "var(--card)",
        textAlign: "center",
        color: "var(--muted)",
      }}
    >
      <p
        style={{
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        No news yet
      </p>
      <p
        style={{
          marginBottom: "20px",
        }}
      >
        Latest announcements and development
        updates will appear here.
      </p>
      <Link
        href="/news"
        className="button-secondary"
        style={{
          width: "fit-content",
          margin: "0 auto",
        }}
      >
        Go to News
      </Link>
    </div>
  ) : (
    <div className="news-grid">

      {latestNews.map((article) => (
        <article
          key={article.id}
          className="news-card"
        >

          <div className="news-image">
            {(article.category || "NEWS")
              .toUpperCase()
              .slice(0, 12)}
          </div>

          <div className="news-content">

            <span>
              {(article.category || "GENERAL")
                .toUpperCase()}
            </span>

            <h3>
              {article.title}
            </h3>

            <p>
              {article.excerpt ||
                article.content
                  .slice(0, 120)
                  .trim() + "…"}
            </p>

            <Link href={`/news/${article.slug}`}>
              Read article →
            </Link>

          </div>

        </article>
      ))}

    </div>
  )}

</section>

<section className="youtube-section">

  <div className="section-heading">
    <p>FEATURED VIDEOS</p>
    <h2>See Frost in Action</h2>
  </div>

  {youtubeVideos.length === 0 ? (
    <div className="youtube-empty">
      <p>No featured videos yet.</p>
      <span>Selected YouTube videos will appear here. Manage in Admin → Videos.</span>
    </div>
  ) : (
    <div className="youtube-grid">
      {youtubeVideos.map((video) => {
        const id = video.youtube_id || (() => {
          try {
            const u = new URL(video.youtube_url);
            if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
            return u.searchParams.get("v") || "";
          } catch { return ""; }
        })();
        return (
          <div key={video.id} className="youtube-card">
            <div className="youtube-embed">
              <iframe
                src={`https://www.youtube.com/embed/${id}`}
                title={video.title || "Winlator Frost Video"}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {video.title && <h3>{video.title}</h3>}
          </div>
        );
      })}
    </div>
  )}

</section>

<section className="faq-section">

  <div className="section-heading">
    <p>FAQ</p>
    <h2>About Winlator@Frost</h2>
  </div>

  <div className="faq-grid">

    <details className="faq-card" open>
      <summary>What is Winlator@Frost?</summary>
      <p>Winlator@Frost is the most advanced Winlator mod based on the Winlator offical by brunodev85 that have many additional features that the Winlator offical doesn&apos;t have it</p>
    </details>

    <details className="faq-card">
      <summary>How the Winlator@Frost are working?</summary>
      <p>Winlator@Frost are work as a PC/Windows emulator and it&apos;s ready to letting you playing many of powerful PC games and even AAA games are playable too in this Winlator mod</p>
    </details>

    <details className="faq-card">
      <summary>Is Winlator@Frost free?</summary>
      <p>The Winlator@Frost are 100% free until forever and the downloads are through this website</p>
    </details>

    <details className="faq-card">
      <summary>Who developed the Winlator@Frost?</summary>
      <p>Winlator@Frost are being developed by a solo developer which is Tanakorn Phetsuan who are from Thailand, he is the only lead developer of the Winlator@Frost since 2024 after his cousin passed the project to him. Originally it was made by PhryaNik, from the initial release in late 2023 until mid 2024 and after that the project have been fully hold by Tanakorn until today</p>
    </details>

  </div>

</section>

<section className="cta-section">

  <div className="cta-card">

    <p>READY TO EXPERIENCE FROST?</p>

    <h2>
      Take Windows with you.
    </h2>

    <p>
      Download the latest Winlator@Frost
      release and explore the Frost experience.
    </p>

    <Link
      href={
        latestRelease
          ? `/downloads/${latestRelease.version}`
          : "/downloads"
      }
      className="button-primary"
    >
      Download Winlator@Frost
    </Link>

  </div>

</section>

    </main>
  );
}
