import Link from "next/link";
import { getPublicReleases } from "@/lib/releases";
import { getPublicNews } from "@/lib/news";
import { getPublicYoutubeVideos } from "@/lib/youtube";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales, type Locale } from "@/lib/i18n/config";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

function formatReleaseDate(date: string, locale: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  const localeMap: Record<string,string> = {
    en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT", es: "es-ES", ru: "ru-RU", tr: "tr-TR", ko: "ko-KR", ja: "ja-JP", zh: "zh-CN", vi: "vi-VN", th: "th-TH", id: "id-ID", pt: "pt-BR", ar: "ar-SA"
  };
  return parsed.toLocaleDateString(localeMap[locale] || "en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const loc = locale as Locale;
  const [releases, news, youtubeVideos] = await Promise.all([
    getPublicReleases(),
    getPublicNews(),
    getPublicYoutubeVideos(),
  ]);

  const latestRelease = releases[0] ?? null;
  const latestNews = news.slice(0, 3);

  return (
    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          {latestRelease ? (
            <div className="release-badge">✦ {latestRelease.name} v{latestRelease.version} · {latestRelease.status}</div>
          ) : (
            <div className="release-badge">✦ Winlator@Frost · Stay Frosty</div>
          )}
          <p className="hero-eyebrow">{dict.hero.eyebrow}</p>
          <h1>{dict.hero.titleWinlator}<span>{dict.hero.titleFrost}</span></h1>
          <p className="hero-description">{dict.hero.description}</p>
          <div className="hero-actions">
            <Link href={latestRelease ? `/${loc}/downloads/${latestRelease.version}` : `/${loc}/downloads`} className="button-primary">{dict.hero.downloadLatest}</Link>
          </div>
          <div className="hero-support">
            <p>{dict.hero.supportFrost}</p>
            <div className="support-buttons">
              <a href="https://ko-fi.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button kofi">Ko-fi</a>
              <a href="https://buymeacoffee.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button bmc">Buy Me a Coffee</a>
              <a href="https://paypal.me/MUHAMMADINISMAIL" target="_blank" rel="noopener noreferrer" className="support-button paypal">PayPal</a>
            </div>
          </div>
        </div>
      </section>

      <section className="release-section">
        <div className="section-heading"><p>{dict.home.latestRelease}</p><h2>{dict.home.experienceFrost}</h2></div>
        {latestRelease ? (
          <div className="release-card">
            <div>
              <span className="release-label">{latestRelease.status.toUpperCase()} {dict.home.statusRelease}</span>
              <h3>{latestRelease.name}</h3>
              <p>{latestRelease.architecture}{latestRelease.status ? ` · ${latestRelease.status}` : ""} · {formatReleaseDate(latestRelease.release_date, locale)}{latestRelease.version ? ` · v${latestRelease.version}` : ""}</p>
              {latestRelease.description && (
                <div className="release-description-fixed" style={{ marginTop: "10px", maxWidth: "600px", lineHeight: "1.7", color: "var(--muted)", whiteSpace: "pre-line", wordBreak: "break-word" }}>{latestRelease.description}</div>
              )}
            </div>
            <Link href={`/${loc}/downloads/${latestRelease.version}`} className="button-primary">{dict.home.download}</Link>
          </div>
        ) : (
          <div className="release-card">
            <div><span className="release-label">{dict.home.noRelease}</span><h3>{dict.home.stayTuned}</h3><p>{dict.home.noReleasesDesc}</p></div>
            <Link href={`/${loc}/downloads`} className="button-primary">{dict.home.viewDownloads}</Link>
          </div>
        )}
      </section>

      <section className="features-section">
        <div className="section-heading"><p>{dict.home.whyFrost}</p><h2>{dict.home.builtDifferent}</h2></div>
        <div className="features-grid">
          <div className="feature-card"><div className="feature-icon">⚡</div><h3>{dict.home.performanceTitle}</h3><p>{dict.home.performanceDesc}</p></div>
          <div className="feature-card"><div className="feature-icon">🎮</div><h3>{dict.home.gamingTitle}</h3><p>{dict.home.gamingDesc}</p></div>
          <div className="feature-card"><div className="feature-icon">⚙</div><h3>{dict.home.customizationTitle}</h3><p>{dict.home.customizationDesc}</p></div>
          <div className="feature-card"><div className="feature-icon">❄</div><h3>{dict.home.frostExpTitle}</h3><p>{dict.home.frostExpDesc}</p></div>
        </div>
      </section>

      <section className="news-section">
        <div className="section-heading news-heading"><div><p>{dict.home.latestNews}</p><h2>{dict.home.fromFrost}</h2></div><Link href={`/${loc}/news`} className="text-link">{dict.home.viewAllNews}</Link></div>
        {latestNews.length === 0 ? (
          <div style={{ marginTop: "30px", padding: "40px", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--card)", textAlign: "center", color: "var(--muted)" }}>
            <p style={{ marginBottom: "16px", fontWeight: 700 }}>{dict.home.noNewsTitle}</p><p style={{ marginBottom: "20px" }}>{dict.home.noNewsDesc}</p>
            <Link href={`/${loc}/news`} className="button-secondary" style={{ width: "fit-content", margin: "0 auto" }}>{dict.home.goToNews}</Link>
          </div>
        ) : (
          <div className="news-grid">
            {latestNews.map((article) => (
              <article key={article.id} className="news-card">
                <div className="news-image">{(article.category || dict.news.general).toUpperCase().slice(0,12)}</div>
                <div className="news-content">
                  <span>{(article.category || dict.news.general).toUpperCase()}</span>
                  <h3>{article.title}</h3>
                  <p>{article.excerpt || article.content.slice(0,120).trim()+"…"}</p>
                  <Link href={`/${loc}/news/${article.slug}`}>{dict.news.readArticle} →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="youtube-section">
        <div className="section-heading"><p>{dict.home.featuredVideos}</p><h2>{dict.home.seeFrostInAction}</h2></div>
        {youtubeVideos.length === 0 ? (
          <div className="youtube-empty"><p>{dict.home.noVideosTitle}</p><span>{dict.home.noVideosDesc}</span></div>
        ) : (
          <div className="youtube-grid">
            {youtubeVideos.map((video) => {
              const id = video.youtube_id || (()=>{ try{ const u=new URL(video.youtube_url); if(u.hostname.includes("youtu.be")) return u.pathname.slice(1); return u.searchParams.get("v")||"";}catch{return ""}})();
              return (<div key={video.id} className="youtube-card"><div className="youtube-embed"><iframe src={`https://www.youtube.com/embed/${id}`} title={video.title || "Winlator Frost Video"} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>{video.title && <h3>{video.title}</h3>}</div>);
            })}
          </div>
        )}
      </section>

      <section className="faq-section">
        <div className="section-heading"><p>{dict.home.faqTitle}</p><h2>{dict.home.faqAbout}</h2></div>
        <div className="faq-grid">
          <details className="faq-card" open><summary>{dict.home.faqQ1}</summary><p>{dict.home.faqA1}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ2}</summary><p>{dict.home.faqA2}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ3}</summary><p>{dict.home.faqA3}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ4}</summary><p>{dict.home.faqA4}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ5}</summary><p>{dict.home.faqA5}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ6}</summary><p>{dict.home.faqA6}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ7}</summary><p>{dict.home.faqA7}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ8}</summary><p>{dict.home.faqA8}</p></details>
          <details className="faq-card"><summary>{dict.home.faqQ9}</summary><p>{dict.home.faqA9}</p></details>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <p>{dict.home.ctaReady}</p>
          <h2>{dict.home.ctaTitle}</h2>
          <p className="cta-subtitle">{dict.home.ctaSubtitle}</p>
          <p>{dict.home.ctaDesc}</p>
          <Link href={latestRelease ? `/${loc}/downloads/${latestRelease.version}` : `/${loc}/downloads`} className="button-primary">{dict.home.ctaDownload}</Link>
        </div>
      </section>
    </main>
  );
}
