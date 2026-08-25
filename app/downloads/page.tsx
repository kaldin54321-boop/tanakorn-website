import Link from "next/link";

import {
  getPublicReleases,
} from "@/lib/releases";

export const revalidate = 0;
export const dynamic = "force-dynamic";


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


export default async function DownloadsPage() {

  // ------------------------------------------
  // Load releases from the centralized
  // release data function.
  // ------------------------------------------

  const releases =
    await getPublicReleases();


  const allReleases =
    releases ?? [];


  const latestRelease =
    allReleases[0] ?? null;


  const previousReleases =
    allReleases.slice(1);


  return (
    <main className="downloads-page">

      {/* ====================================== */}
      {/* HERO                                   */}
      {/* ====================================== */}

      <section className="downloads-hero">

        <p className="downloads-eyebrow">
          WINLATOR@FROST
        </p>


        <h1>
          Downloads
        </h1>


        <p className="downloads-subtitle">
          Download the latest
          Winlator@Frost releases
          for Android.
        </p>

      </section>


      {/* ====================================== */}
      {/* NO RELEASE                             */}
      {/* ====================================== */}

      {!latestRelease && (

        <section className="downloads-empty">

          <h2>
            No releases available
          </h2>


          <p>
            There are currently no public
            Winlator@Frost releases.
          </p>

        </section>

      )}


      {/* ====================================== */}
      {/* LATEST RELEASE                         */}
      {/* ====================================== */}

      {latestRelease && (

        <section className="latest-release">

          <div className="section-heading">

            <span>
              Latest Release
            </span>

          </div>


          <article className="latest-release-card">

            <div className="release-card-top">

              <div>

                <span className="release-version">
                  v{latestRelease.version}
                </span>


                <h2>
                  {latestRelease.name}
                </h2>

              </div>


              <span
                className={
                  `release-status status-${latestRelease.status}`
                }
              >
                {latestRelease.status}
              </span>

            </div>


            <div className="release-meta">

              <span>
                {latestRelease.architecture}
              </span>


              {latestRelease.android_version && (

                <span>
                  {latestRelease.android_version}
                </span>

              )}


              {latestRelease.wine_version && (

                <span>
                  {latestRelease.wine_version}
                </span>

              )}


              {latestRelease.file_size && (

                <span>
                  {formatFileSize(
                    latestRelease.file_size
                  )}
                </span>

              )}


              <span>
                Released{" "}
                {formatReleaseDate(
                  latestRelease.release_date
                )}
              </span>

            </div>


            {latestRelease.description && (

              <p className="release-description">
                {latestRelease.description}
              </p>

            )}


            <div className="release-download-area">

              {latestRelease.file_path ? (

                <Link
                  href={
                    `/downloads/${latestRelease.version}`
                  }
                  className="download-button"
                >
                  VIEW RELEASE
                </Link>

              ) : (

                <button
                  className="download-button"
                  disabled
                >
                  APK UNAVAILABLE
                </button>

              )}


              {latestRelease.file_path ? (

                <p>
                  View release information
                  and download the APK.
                </p>

              ) : (

                <p>
                  The APK file is not
                  available yet.
                </p>

              )}

            </div>

          </article>

        </section>

      )}


      {/* ====================================== */}
      {/* PREVIOUS RELEASES                      */}
      {/* ====================================== */}

      {previousReleases.length > 0 && (

        <section className="previous-releases">

          <div className="section-heading">

            <span>
              Previous Releases
            </span>

          </div>


          <div className="release-grid">

            {previousReleases.map(
              (release) => (

                <article
                  key={release.id}
                  className="release-small-card"
                >

                  <div className="release-small-header">

                    <span className="release-version">
                      v{release.version}
                    </span>


                    <span
                      className={
                        `release-status status-${release.status}`
                      }
                    >
                      {release.status}
                    </span>

                  </div>


                  <h3>
                    {release.name}
                  </h3>


                  <div className="release-small-meta">

                    <span>
                      {release.architecture}
                    </span>


                    {release.file_size && (

                      <span>
                        {formatFileSize(
                          release.file_size
                        )}
                      </span>

                    )}


                    <span>
                      {new Date(
                        release.release_date
                      ).toLocaleDateString(
                        "en-US"
                      )}
                    </span>

                  </div>


                  {release.file_path ? (

                    <Link
                      href={
                        `/downloads/${release.version}`
                      }
                      className="download-secondary-button"
                    >
                      VIEW RELEASE
                    </Link>

                  ) : (

                    <button
                      className="download-secondary-button"
                      disabled
                    >
                      APK UNAVAILABLE
                    </button>

                  )}

                </article>

              )
            )}

          </div>

        </section>

      )}

    </main>
  );
}
