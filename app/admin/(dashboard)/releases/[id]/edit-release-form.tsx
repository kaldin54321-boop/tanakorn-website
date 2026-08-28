"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  updateRelease,
} from "./actions";


type Release = {
  id: string;
  version: string;
  name: string;
  status: string;
  architecture: string;
  release_date: string;
  description: string | null;
  wine_version: string | null;
  android_version: string | null;
  external_url?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  file_size?: number | null;
};


type EditReleaseFormProps = {
  release: Release;
};


export default function EditReleaseForm({
  release,
}: EditReleaseFormProps) {

  const router =
    useRouter();


  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setLoading(true);
    setError("");


    const formData =
      new FormData(
        event.currentTarget
      );


    try {

      const result =
        await updateRelease(
          release.id,
          formData
        );


      if (!result.success) {

        setError(
          result.message ||
          "Failed to update release."
        );

        setLoading(false);

        return;
      }


      router.push(
        "/admin/releases"
      );

      router.refresh();

    } catch (error) {

      console.error(
        "Unexpected update error:",
        error
      );

      setError(
        "An unexpected error occurred while updating the release."
      );

      setLoading(false);
    }
  }


  return (
    <form
      onSubmit={handleSubmit}
      className="admin-form"
    >

      {/* -------------------------------- */}
      {/* Release Information              */}
      {/* -------------------------------- */}

      <div className="admin-form-section">

        <h2>
          Release Information
        </h2>


        <div className="form-grid">

          <label>
            Version

            <input
              name="version"
              type="text"
              defaultValue={
                release.version
              }
              required
            />
          </label>


          <label>
            Release Name

            <input
              name="name"
              type="text"
              defaultValue={
                release.name
              }
              required
            />
          </label>


          <label>
            Status

            <select
              name="status"
              defaultValue={
                release.status
              }
            >

              <option value="stable">
                Stable
              </option>

              <option value="beta">
                Beta
              </option>

              <option value="experimental">
                Experimental
              </option>

            </select>

          </label>


          <label>
            Architecture

            <input
              name="architecture"
              type="text"
              defaultValue={
                release.architecture
              }
              required
            />
          </label>


          <label>
            Release Date

            <input
              name="release_date"
              type="date"
              defaultValue={
                release.release_date
                  ? release.release_date.substring(
                      0,
                      10
                    )
                  : ""
              }
              required
            />
          </label>


          <label>
            Wine Version

            <input
              name="wine_version"
              type="text"
              defaultValue={
                release.wine_version ??
                ""
              }
              placeholder="Wine 10.x"
            />
          </label>


          <label>
            Android Version

            <input
              name="android_version"
              type="text"
              defaultValue={
                release.android_version ??
                ""
              }
              placeholder="Android 10+"
            />
          </label>

        </div>

      </div>


      {/* -------------------------------- */}
      {/* Description                      */}
      {/* -------------------------------- */}

      <div className="admin-form-section">

        <h2>
          Description
        </h2>


        <label>

          Release Description

          <textarea
            name="description"
            defaultValue={
              release.description ??
              ""
            }
            rows={8}
            placeholder="Describe the changes and improvements in this release..."
          />

        </label>

      </div>


      {/* -------------------------------- */}
      {/* External URL (visible in edit)   */}
      {/* -------------------------------- */}

      <div className="admin-form-section">
        <h2>APK Download Source</h2>
        <p className="admin-page-description" style={{ marginBottom: "16px" }}>
          Paste a direct external URL (Google Drive direct link, MediaFire direct, Mega, R2/S3, etc.)
          for 239 MB+ files. This will be used as the download source and proxied through the site
          so download happens inside the website (no new tab redirect). Leave empty to keep current file.
        </p>
        <label>
          External APK URL
          <input
            name="external_url"
            type="url"
            defaultValue={(release as any).external_url ?? ""}
            placeholder="https://drive.google.com/file/d/ID/view or https://s3.filebase.com/... or https://www.mediafire.com/file/.../direct"
          />
          <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Direct links work best. For Google Drive, paste the share link — system will resolve to direct download.
            For MediaFire/Mega, paste the direct download link if available; otherwise the proxy will attempt to resolve it.
            Clear this field to remove external URL.
          </span>
        </label>
        {(release as any).external_url && (
          <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(141,220,255,0.06)", border: "1px solid rgba(141,220,255,0.18)", borderRadius: "8px", fontSize: "12px", wordBreak: "break-all" }}>
            Current: {(release as any).external_url}
          </div>
        )}
        {(release as any).file_path && (
          <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
            Current file: {(release as any).file_name || (release as any).file_path} {(release as any).file_size ? `(${(release as any).file_size / 1024 / 1024} MB)` : ""}
          </div>
        )}
        <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(255,221,0,0.06)", border: "1px solid rgba(255,221,0,0.18)", borderRadius: "8px", fontSize: "11px", color: "var(--muted)" }}>
          Note: Setting an external URL will override local/S3 file. The download will be proxied through /api/downloads/[version] so it stays on-site.
        </div>
      </div>

      {/* -------------------------------- */}
      {/* Error                            */}
      {/* -------------------------------- */}

      {error && (
        <div
          className="admin-error"
          style={{
            whiteSpace:
              "pre-line",
          }}
        >
          {error}
        </div>
      )}


      {/* -------------------------------- */}
      {/* Buttons                          */}
      {/* -------------------------------- */}

      <div className="admin-form-actions">

        <button
          type="button"
          className="button-secondary"
          disabled={loading}
          onClick={() =>
            router.push(
              "/admin/releases"
            )
          }
        >
          Cancel
        </button>


        <button
          type="submit"
          className="button-primary"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Save Changes"}
        </button>

      </div>

    </form>
  );
}