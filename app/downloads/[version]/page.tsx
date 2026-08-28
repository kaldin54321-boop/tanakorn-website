import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPublicReleases,
} from "@/lib/releases";

import DownloadButton from "./download-button";

export async function generateStaticParams() {
  try {
    const { getPublicReleases } = await import("@/lib/releases");
    const releases = await getPublicReleases();
    return releases.slice(0, 10).map((r: any) => ({ version: r.version }));
  } catch {
    return [{ version: "placeholder" }];
  }
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    version: string;
  }>;
};


function formatFileSize(
  bytes: number | null
) {
  if (
    bytes === null ||
    !Number.isFinite(bytes)
  ) {
    return "Unknown size";
  }


  if (
    bytes < 1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }


  if (
    bytes < 1024 * 1024 * 1024
  ) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }


  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}


function formatReleaseDate(
  date: string
) {
  const parsedDate =
    new Date(date);


  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return date;
  }


  return parsedDate.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}


export default async function ReleasePage({
  params,
}: PageProps) {

  const resolvedParams =
    await params;


  const version =
    decodeURIComponent(
      resolvedParams.version
    );


  const releases =
    await getPublicReleases();


  const release =
    releases.find(
      (item) =>
        item.version === version
    );


  if (!release) {
    notFound();
  }


  return (
    <main className="downloads-page">

      {/* ====================================== */}
      {/* HEADER                                 */}
      {/* ====================================== */}

      <section className="downloads-hero">

        <p className="downloads-eyebrow">
          WINLATOR@FROST
        </p>


        <h1>
          {release.name}
        </h1>


        <p className="downloads-subtitle">
          Release v{release.version}
        </p>

      </section>


      {/* ====================================== */}
      {/* RELEASE INFORMATION                    */}
      {/* ====================================== */}

      <section className="latest-release">

        <div className="section-heading">

          <span>
            Release Information
          </span>

        </div>


        <article className="latest-release-card">

          <div className="release-card-top">

            <div>

              <span className="release-version">
                v{release.version}
              </span>


              <h2>
                {release.name}
              </h2>

            </div>


            <span
              className={
                `release-status status-${release.status}`
              }
            >
              {release.status}
            </span>

          </div>


          {/* ================================== */}
          {/* RELEASE META                       */}
          {/* ================================== */}

          <div className="release-meta">

            <span>
              {release.architecture}
            </span>


            {release.android_version && (

              <span>
                {release.android_version}
              </span>

            )}


            {release.wine_version && (

              <span>
                {release.wine_version}
              </span>

            )}


            {release.file_size !== null && (

              <span>
                {formatFileSize(
                  release.file_size
                )}
              </span>

            )}


            <span>
              Released{" "}
              {formatReleaseDate(
                release.release_date
              )}
            </span>

          </div>


          {/* ================================== */}
          {/* DESCRIPTION                        */}
          {/* ================================== */}

          {release.description && (

            <div className="release-description" style={{ whiteSpace: "pre-line", wordBreak: "break-word", lineHeight: "1.7", color: "var(--muted)" }}>

              {release.description}

            </div>

          )}


          {/* ================================== */}
          {/* APK INFORMATION                    */}
          {/* ================================== */}

          <div className="release-download-area">

            {release.file_path ||
            (release as any).external_url ? (
              <>
                <div>

                  <strong>
                    {release.file_name ||
                      `Winlator@Frost ${release.version}.apk`}
                  </strong>

                  <p>
                    APK •{" "}
                    {release.architecture}
                    {" • "}
                    {formatFileSize(
                      release.file_size
                    )}
                    {(release as any).external_url
                      ? " • External"
                      : ""}
                  </p>

                  {(release as any)
                    .external_url && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--muted)",
                        wordBreak: "break-all",
                        marginTop: "6px",
                      }}
                    >
                      External:{" "}
                      {(release as any).external_url}
                    </p>
                  )}
                </div>

                <DownloadButton
                  version={release.version}
                  fileName={
                    release.file_name ||
                    `Winlator@Frost-${release.version}.apk`
                  }
                  fileSize={release.file_size}
                  isExternal={!!(release as any).external_url}
                  externalUrl={(release as any).external_url || undefined}
                  initialDownloadCount={(release as any).download_count ?? 0}
                />

                <div className="view-release-support">
                  <p>Support Frost — Help keep it free</p>
                  <div className="support-buttons">
                    <a href="https://ko-fi.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button kofi">Ko-fi</a>
                    <a href="https://buymeacoffee.com/haikalmanheem" target="_blank" rel="noopener noreferrer" className="support-button bmc">Buy Me a Coffee</a>
                    <a href="https://paypal.me/MUHAMMADINISMAIL" target="_blank" rel="noopener noreferrer" className="support-button paypal">PayPal</a>
                  </div>
                </div>

              </>
            ) : (

              <>

                <button
                  className="download-button"
                  disabled
                >
                  APK UNAVAILABLE
                </button>


                <p>
                  The APK file is not
                  available for this release.
                </p>

              </>

            )}

          </div>

        </article>

      </section>


      {/* ====================================== */}
      {/* NAVIGATION                             */}
      {/* ====================================== */}

      <section className="previous-releases">

        <div className="section-heading">

          <span>
            Navigation
          </span>

        </div>


        <div className="release-download-area">

          <Link
            href="/downloads"
            className="download-secondary-button"
          >
            ← BACK TO DOWNLOADS
          </Link>

        </div>

      </section>

    </main>
  );
}