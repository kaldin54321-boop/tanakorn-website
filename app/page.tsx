import Link from "next/link";

import {
  getPublicReleases,
} from "@/lib/releases";

import {
  getPublicNews,
} from "@/lib/news";

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
  const [releases, news] =
    await Promise.all([
      getPublicReleases(),
      getPublicNews(),
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

            <Link
              href="/about"
              className="button-secondary"
            >
              Explore Frost
            </Link>

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
                <p
                  style={{
                    marginTop: "10px",
                    maxWidth: "600px",
                    lineHeight: "1.6",
                  }}
                >
                  {latestRelease.description}
                </p>
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

<section className="showcase-section">

  <div className="section-heading">
    <p>THE FROST EXPERIENCE</p>
    <h2>See Frost in Action</h2>
  </div>

  <div className="showcase-grid">

    <div className="showcase-large">
      Screenshot 01
    </div>

    <div className="showcase-small">
      Screenshot 02
    </div>

    <div className="showcase-small">
      Screenshot 03
    </div>

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
