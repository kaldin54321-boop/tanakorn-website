import Link from "next/link";
import { getPublicReleases } from "@/lib/releases";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function generateStaticParams(){ return locales.map((locale)=>({ locale })); }

function formatFileSize(bytes: number | null, dict: any) {
  if (bytes === null || !Number.isFinite(bytes)) return dict.common.unknownSize;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024*1024*1024) return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  return `${(bytes/(1024*1024*1024)).toFixed(2)} GB`;
}
function formatReleaseDate(date: string, locale: string){
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const map: Record<string,string> = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES", ru:"ru-RU", tr:"tr-TR", ko:"ko-KR", ja:"ja-JP", zh:"zh-CN", vi:"vi-VN", th:"th-TH", id:"id-ID", pt:"pt-BR", ar:"ar-SA" };
  return parsedDate.toLocaleDateString(map[locale]||"en-US", { year:"numeric", month:"long", day:"numeric"});
}

export default async function DownloadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const releases = await getPublicReleases();
  const allReleases = releases ?? [];
  const latestRelease = allReleases[0] ?? null;
  const previousReleases = allReleases.slice(1);
  return (
    <main className="downloads-page">
      <section className="downloads-hero">
        <p className="downloads-eyebrow">{dict.common.winlatorFrost}</p>
        <h1>{dict.downloads.title}</h1>
        <p className="downloads-subtitle">{dict.downloads.subtitle}</p>
      </section>
      {!latestRelease && (
        <section className="downloads-empty"><h2>{dict.downloads.noReleasesTitle}</h2><p>{dict.downloads.noReleasesDesc}</p></section>
      )}
      {latestRelease && (
        <section className="latest-release">
          <div className="section-heading"><span>{dict.downloads.latestRelease}</span></div>
          <article className="latest-release-card">
            <div className="release-card-top"><div><span className="release-version">v{latestRelease.version}</span><h2>{latestRelease.name}</h2></div><span className={`release-status status-${latestRelease.status}`}>{latestRelease.status}</span></div>
            <div className="release-meta">
              <span>{latestRelease.architecture}</span>
              {latestRelease.android_version && <span>{latestRelease.android_version}</span>}
              {latestRelease.wine_version && <span>{latestRelease.wine_version}</span>}
              {latestRelease.file_size && <span>{formatFileSize(latestRelease.file_size, dict)}</span>}
              <span>{dict.downloads.released} {formatReleaseDate(latestRelease.release_date, locale)}</span>
            </div>
            {latestRelease.description && <div className="release-description" style={{ whiteSpace:"pre-line", wordBreak:"break-word", lineHeight:"1.7"}}>{latestRelease.description}</div>}
            <div className="release-download-area">
              {(latestRelease.file_path || (latestRelease as any).external_url) ? (
                <Link href={`/${locale}/downloads/${latestRelease.version}`} className="download-button">{dict.downloads.viewRelease}</Link>
              ) : <button className="download-button" disabled>{dict.downloads.apkUnavailable}</button>}
              {(latestRelease.file_path || (latestRelease as any).external_url) ? (
                <p>{dict.downloads.viewInfo}{(latestRelease as any).download_count !== undefined && (latestRelease as any).download_count !== null ? ` • ⬇ ${(latestRelease as any).download_count.toLocaleString()} ${dict.downloads.downloads}` : ""}</p>
              ) : <p>{dict.downloads.notAvailableYet}</p>}
            </div>
          </article>
        </section>
      )}
      {previousReleases.length > 0 && (
        <section className="previous-releases">
          <div className="section-heading"><span>{dict.downloads.previousReleases}</span></div>
          <div className="release-grid">
            {previousReleases.map((release)=>(
              <article key={release.id} className="release-small-card">
                <div className="release-small-header"><span className="release-version">v{release.version}</span><span className={`release-status status-${release.status}`}>{release.status}</span></div>
                <h3>{release.name}</h3>
                <div className="release-small-meta">
                  <span>{release.architecture}</span>
                  {release.file_size && <span>{formatFileSize(release.file_size, dict)}</span>}
                  <span>{new Date(release.release_date).toLocaleDateString(locale)}</span>
                </div>
                {(release.file_path || (release as any).external_url) ? (
                  <Link href={`/${locale}/downloads/${release.version}`} className="download-secondary-button">{dict.downloads.viewRelease}</Link>
                ) : <button className="download-secondary-button" disabled>{dict.downloads.apkUnavailable}</button>}
                {(release as any).download_count !== undefined && (release as any).download_count !== null && (
                  <p style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)", textAlign:"center"}}>⬇ {(release as any).download_count.toLocaleString()} {dict.downloads.downloads}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
