import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicReleases } from "@/lib/releases";
import DownloadButton from "./download-button";
import ShareButtons from "@/app/components/ShareButtons";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";

export async function generateStaticParams() {
  try {
    const { getPublicReleases } = await import("@/lib/releases");
    const releases = await getPublicReleases();
    return locales.flatMap((locale) => releases.slice(0, 10).map((r: any) => ({ locale, version: r.version })));
  } catch {
    return locales.map((locale) => ({ locale, version: "placeholder" }));
  }
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatFileSize(bytes: number | null, dict: any) {
  if (bytes === null || !Number.isFinite(bytes)) return dict.common.unknownSize;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function formatReleaseDate(date: string, locale: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const map: Record<string,string> = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES", ru:"ru-RU", tr:"tr-TR", ko:"ko-KR", ja:"ja-JP", zh:"zh-CN", vi:"vi-VN", th:"th-TH", id:"id-ID", pt:"pt-BR", ar:"ar-SA" };
  return parsedDate.toLocaleDateString(map[locale]||"en-US", { year:"numeric", month:"long", day:"numeric"});
}

export default async function ReleasePage({ params }: { params: Promise<{ locale: string; version: string }> }) {
  const { locale, version: rawVersion } = await params;
  const dict = getDictionary(locale);
  const version = decodeURIComponent(rawVersion);
  const releases = await getPublicReleases();
  const release = releases.find((item) => item.version === version);
  if (!release) notFound();
  return (
    <main className="downloads-page">
      <section className="downloads-hero">
        <p className="downloads-eyebrow">{dict.common.winlatorFrost}</p>
        <h1>{release.name}</h1>
        <ShareButtons url={`/${locale}/downloads/${release.version}`} title={release.name} text={`${release.name} v${release.version}`} />
        <p className="downloads-subtitle">{dict.releaseDetail.releaseVersion}{release.version}</p>
      </section>
      <section className="latest-release">
        <div className="section-heading"><span>{dict.releaseDetail.releaseInformation}</span></div>
        <article className="latest-release-card">
          <div className="release-card-top">
            <div><span className="release-version">v{release.version}</span><h2>{release.name}</h2></div>
            <span className={`release-status status-${release.status}`}>{release.status}</span>
          </div>
          <div className="release-meta">
            <span>{release.architecture}</span>
            {release.android_version && <span>{release.android_version}</span>}
            {release.wine_version && <span>{release.wine_version}</span>}
            {release.file_size !== null && <span>{formatFileSize(release.file_size, dict)}</span>}
            <span>{dict.releaseDetail.releasedOn} {formatReleaseDate(release.release_date, locale)}</span>
          </div>
          {release.description && <div className="release-description" style={{ whiteSpace:"pre-line", wordBreak:"break-word", lineHeight:"1.7", color:"var(--muted)"}}>{release.description}</div>}
          <div className="release-download-area">
            {release.file_path || (release as any).external_url ? (
              <>
                <div>
                  <strong>{release.file_name || `Winlator@Frost ${release.version}.apk`}</strong>
                  <p>APK • {release.architecture}{release.file_size !== null ? ` • ${formatFileSize(release.file_size, dict)}` : ""}</p>
                </div>
                <DownloadButton version={release.version} fileName={release.file_name || `Winlator@Frost-${release.version}.apk`} fileSize={release.file_size} isExternal={!!(release as any).external_url} externalUrl={(release as any).external_url || undefined} initialDownloadCount={(release as any).download_count ?? 0} locale={locale} />
                <div className="view-release-support donation-card">
                  <p className="donation-card-title">{dict.releaseDetail.supportHelp}</p>
                  <p className="donation-card-text">{dict.common.donationText}</p>
                  <div className="support-buttons">
                    <a href="https://ko-fi.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button kofi">Ko-fi</a>
                    <a href="https://buymeacoffee.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button bmc">Buy Me a Coffee</a>
                    <a href="https://paypal.me/MUHAMMADINISMAIL" target="_blank" rel="noopener noreferrer" className="support-button paypal">PayPal</a>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button className="download-button" disabled>{dict.releaseDetail.apkUnavailable}</button>
                <p>{dict.releaseDetail.apkNotAvailable}</p>
              </>
            )}
          </div>
        </article>
      </section>
      <section className="previous-releases">
        <div className="section-heading"><span>{dict.releaseDetail.navigation}</span></div>
        <div className="release-download-area">
          <Link href={`/${locale}/downloads`} className="download-secondary-button">{dict.releaseDetail.backToDownloads}</Link>
        </div>
      </section>
    </main>
  );
}
