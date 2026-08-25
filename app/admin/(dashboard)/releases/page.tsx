import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import type { Release } from "@/lib/types/database";

import DeleteReleaseButton from "./delete-release-button";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const supabase = await createClient();


  const {
    data: releases,
    error,
  } = await supabase
    .from("releases")
    .select("*")
    .order(
      "release_date",
      {
        ascending: false,
      }
    );


  if (error) {
    return (
      <div className="admin-page">

        <div className="admin-page-header">
          <div>
            <p className="admin-eyebrow">
              WINLATOR@FROST
            </p>

            <h1>
              Releases
            </h1>
          </div>
        </div>


        <div className="admin-error">
          Failed to load releases:
          {" "}
          {error.message}
        </div>

      </div>
    );
  }


  const releaseList =
    (releases ?? []) as Release[];


  return (
    <div className="admin-page">

      <div className="admin-page-header">

        <div>
          <p className="admin-eyebrow">
            WINLATOR@FROST
          </p>

          <h1>
            Releases
          </h1>

          <p className="admin-page-description">
            Manage Winlator@Frost releases.
          </p>
        </div>


        <Link
          href="/admin/releases/new"
          className="button-primary"
        >
          + Create Release
        </Link>

      </div>


      {releaseList.length === 0 ? (

        <div className="admin-empty-state">

          <div className="admin-empty-icon">
            ◇
          </div>

          <h2>
            No releases yet
          </h2>

          <p>
            Create your first Winlator@Frost
            release.
          </p>

          <Link
            href="/admin/releases/new"
            className="button-primary"
          >
            Create First Release
          </Link>

        </div>

      ) : (

        <div className="release-table">

          <div className="release-table-header">

            <span>
              Release
            </span>

            <span>
              Status
            </span>

            <span>
              Architecture
            </span>

            <span>
              Date
            </span>

            <span>
              Actions
            </span>

          </div>


          {releaseList.map(
            (release) => (

              <div
                key={release.id}
                className="release-table-row"
              >

                <div className="release-name">

                  <strong>
                    {release.name}
                  </strong>

                  <span>
                    v{release.version}
                  </span>

                </div>


                <div>

                  <span
                    className={`status-badge status-${release.status}`}
                  >
                    {release.status}
                  </span>

                </div>


                <div>
                  {release.architecture}
                </div>


                <div>
                  {release.release_date}
                </div>


                <div className="release-actions">

  <Link
    href={`/admin/releases/${release.id}`}
    className="button-secondary"
  >
    Edit
  </Link>

  <DeleteReleaseButton
    id={release.id}
    name={release.name}
  />

</div>

              </div>

            )
          )}

        </div>

      )}

    </div>
  );
}