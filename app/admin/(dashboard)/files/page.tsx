import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatFileSize(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminFilesPage() {
  const supabase = await createClient();

  const { data: releases, error } = await supabase
    .from("releases")
    .select(
      "id, version, name, file_name, file_path, file_size, file_type, release_date"
    )
    .not("file_path", "is", null)
    .order("release_date", { ascending: false });

  const files = releases ?? [];

  const totalBytes = files.reduce(
    (sum, r) => sum + (r.file_size ?? 0),
    0
  );

  return (
    <div className="admin-dashboard">

      <header className="admin-header">

        <div>
          <p>
            STORAGE MANAGEMENT
          </p>

          <h1>
            Files
          </h1>
          <p
            style={{
              marginTop: "8px",
              color: "var(--muted)",
              fontSize: "13px",
            }}
          >
            {files.length} file
            {files.length !== 1 ? "s" : ""} ·{" "}
            {totalBytes > 0
              ? formatFileSize(totalBytes) + " used"
              : "0 MB used"}{" "}
            · Synced with releases
          </p>
        </div>

      </header>

      <section className="admin-panel">

        <div className="admin-panel-header">

          <div>
            <span>
              FILE STORAGE
            </span>

            <h2>
              Release Files
            </h2>
          </div>

          <Link
            href="/admin/releases"
            className="admin-link"
          >
            View Releases →
          </Link>

        </div>

        {error && (
          <div className="admin-error">
            Failed to load files: {error.message}
          </div>
        )}

        {!error && files.length === 0 && (
          <div className="file-empty-state">

            <div className="file-empty-icon">
              ↑
            </div>

            <h3>
              No files uploaded yet
            </h3>

            <p>
              Uploaded Winlator@Frost release files
              will appear here. Files are linked to
              releases and synced automatically.
            </p>

            <Link
              href="/admin/releases/new"
              className="button-primary"
            >
              Create Release with APK
            </Link>

          </div>
        )}

        {!error && files.length > 0 && (
          <div className="release-table">
            <div className="release-table-header">
              <span>File</span>
              <span>Release</span>
              <span>Size</span>
              <span>Type</span>
              <span>Path</span>
            </div>

            {files.map((file) => (
              <div
                key={file.id}
                className="release-table-row"
              >
                <div className="release-name">
                  <strong>
                    {file.file_name || "Unnamed APK"}
                  </strong>
                  <span>
                    v{file.version}
                  </span>
                </div>

                <div>
                  {file.name}
                </div>

                <div>
                  {formatFileSize(file.file_size)}
                </div>

                <div>
                  {file.file_type || "—"}
                </div>

                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    wordBreak: "break-all",
                  }}
                >
                  {file.file_path}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>

    </div>
  );
}
