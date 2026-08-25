"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import APKUpload from "./apk-upload";

import {
  createRelease,
} from "./actions";


export default function NewReleasePage() {
  const router = useRouter();

  const [version, setVersion] =
    useState("");

  const [name, setName] =
    useState("");

  const [status, setStatus] =
    useState("stable");

  const [visibility, setVisibility] =
    useState("published");

  const [architecture, setArchitecture] =
    useState("ARM64");

  const [releaseDate, setReleaseDate] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [wineVersion, setWineVersion] =
    useState("");

  const [androidVersion, setAndroidVersion] =
    useState("");

  const [externalUrl, setExternalUrl] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ==========================================
  // APK UPLOAD STATE
  // ==========================================

  const [uploadedFile, setUploadedFile] =
    useState<{
      name: string;
      path: string;
      size: number;
      type: string;
    } | null>(null);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");


    const formData =
      new FormData(event.currentTarget);


    // ========================================
    // Add uploaded APK information or external URL
    // ========================================

    if (uploadedFile) {
      formData.append(
        "file_name",
        uploadedFile.name
      );
      formData.append(
        "file_path",
        uploadedFile.path
      );
      formData.append(
        "file_size",
        String(uploadedFile.size)
      );
      formData.append(
        "file_type",
        uploadedFile.type
      );
    }

    if (externalUrl.trim()) {
      formData.append(
        "external_url",
        externalUrl.trim()
      );
      // For external URL, also try to infer file info if not uploaded
      if (!uploadedFile) {
        try {
          const url = new URL(
            externalUrl.trim()
          );
          const name =
            url.pathname
              .split("/")
              .pop() || "download.apk";
          // Use external URL as file_path fallback for size display
          // file_size stays null unless user uploaded
        } catch {}
      }
    }


    try {
      const result =
        await createRelease(
          formData
        );


      if (!result.success) {
        setError(
          result.message ||
          "Unable to create release."
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
        "Unexpected release creation error:",
        error
      );

      setError(
        "An unexpected error occurred while creating the release."
      );

      setLoading(false);
    }
  }


  return (
    <div className="admin-page">

      <div className="admin-page-header">

        <div>

          <p className="admin-eyebrow">
            WINLATOR@FROST
          </p>

          <h1>
            Create Release
          </h1>

          <p className="admin-page-description">
            Add a new Winlator@Frost release
            to the database.
          </p>

        </div>

      </div>


      <form
        onSubmit={handleSubmit}
        className="admin-form"
      >

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
                value={version}
                onChange={(event) =>
                  setVersion(
                    event.target.value
                  )
                }
                placeholder="11.1"
                required
              />
            </label>


            <label>
              Release Name

              <input
                name="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="Winlator@Frost 11.1"
                required
              />
            </label>


            <label>
              Status

              <select
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value
                  )
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
              Visibility

              <select
                name="visibility"
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value
                  )
                }
              >

                <option value="published">
                  Published — visible to public
                </option>

                <option value="draft">
                  Draft — hidden from public
                </option>

              </select>

            </label>


            <label>
              Architecture

              <input
                name="architecture"
                type="text"
                value={architecture}
                onChange={(event) =>
                  setArchitecture(
                    event.target.value
                  )
                }
                placeholder="ARM64"
                required
              />
            </label>


            <label>
              Release Date

              <input
                name="release_date"
                type="date"
                value={releaseDate}
                onChange={(event) =>
                  setReleaseDate(
                    event.target.value
                  )
                }
                required
              />
            </label>


            <label>
              Wine Version

              <input
                name="wine_version"
                type="text"
                value={wineVersion}
                onChange={(event) =>
                  setWineVersion(
                    event.target.value
                  )
                }
                placeholder="Wine 10.0"
              />
            </label>


            <label>
              Android Version

              <input
                name="android_version"
                type="text"
                value={androidVersion}
                onChange={(event) =>
                  setAndroidVersion(
                    event.target.value
                  )
                }
                placeholder="Android 10+"
              />
            </label>

          </div>

        </div>


        <div className="admin-form-section">

          <h2>
            Description
          </h2>

          <label>

            Release Description

            <textarea
              name="description"
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Describe the changes and improvements in this release..."
              rows={8}
            />

          </label>

        </div>


        {/* ======================================
            APK UPLOAD
            ====================================== */}

        <div className="admin-form-section">

          <h2>
            Release APK
          </h2>

          <p className="admin-page-description">
            Upload the APK file for this release
            (supports up to 5 GB via TUS
            resumable). For 239 MB+ files if
            bucket still shows 413, use External
            URL below as immediate workaround.
          </p>


          <APKUpload
            version={version}
            onUploaded={(file) => {
              setUploadedFile(file);
              // Clear external URL if uploaded succeeds
              if (file) setExternalUrl("");
            }}
          />


          {uploadedFile && (

            <div className="uploaded-file-info">

              <strong>
                ✓ APK uploaded
              </strong>

              <span>
                {uploadedFile.name}
              </span>

              <span>
                {(
                  uploadedFile.size /
                  1024 /
                  1024
                ).toFixed(2)} MB
              </span>

            </div>

          )}

          <div
            style={{
              margin: "20px 0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "var(--muted)",
              fontSize: "12px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--border)",
              }}
            />
            <span>OR</span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--border)",
              }}
            />
          </div>

          <label>
            <span>
              External APK URL (for 239 MB+
              when bucket 50 MB not yet fixed)
            </span>
            <input
              name="external_url"
              type="url"
              value={externalUrl}
              onChange={(e) => {
                setExternalUrl(
                  e.target.value
                );
                if (e.target.value.trim()) {
                  // Clear uploaded file if using external
                  setUploadedFile(null);
                }
              }}
              placeholder="https://example.com/Winlator-Frost-11.4.apk or https://drive.google.com/... or R2/S3 URL"
            />
            <span
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                marginTop: "4px",
                display: "block",
              }}
            >
              Use if Supabase upload still 413.
              Paste direct download link (Google
              Drive with direct link, R2, S3,
              GitHub Releases). Will be used as
              download button fallback. Ensure
              CORS allows direct download or use
              redirect.
            </span>
          </label>

          {externalUrl.trim() && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                background:
                  "rgba(121,230,164,0.08)",
                border:
                  "1px solid rgba(121,230,164,0.2)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#79e6a4",
              }}
            >
              ✓ Will publish with external URL:{" "}
              {externalUrl.trim().slice(0, 60)}
              {externalUrl.trim().length > 60
                ? "…"
                : ""}
            </div>
          )}
        </div>


        {error && (
          <div
            className="admin-error"
            style={{
              whiteSpace: "pre-line",
            }}
          >
            {error}
          </div>
        )}


        <div className="admin-form-actions">

          <button
            type="button"
            className="button-secondary"
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
              ? "Creating..."
              : "Create Release"}
          </button>

        </div>

      </form>

    </div>
  );
}