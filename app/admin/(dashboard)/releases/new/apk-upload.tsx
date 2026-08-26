"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

type APKUploadProps = {
  version: string;
  onUploaded: (
    file: {
      name: string;
      path: string;
      size: number;
      type: string;
    }
  ) => void;
};

const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB - local host, no Supabase 50MB limit

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function APKUpload({
  version,
  onUploaded,
}: APKUploadProps) {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    setError("");
    setSuccess("");
    setProgress(0);
    setBytesUploaded(0);
    setBytesTotal(0);

    if (xhrRef.current) {
      try {
        xhrRef.current.abort();
      } catch {}
      xhrRef.current = null;
      setUploading(false);
    }

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      !file.name.toLowerCase().endsWith(".apk")
    ) {
      setError("Please select an APK file.");
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_SIZE) {
      setError(
        `File too large: ${formatBytes(file.size)} exceeds 5 GB limit.`
      );
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setError("Selected file is empty.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setBytesTotal(file.size);
  }

  function handleCancel() {
    if (xhrRef.current) {
      try {
        xhrRef.current.abort();
      } catch {}
      xhrRef.current = null;
    }
    if (tusRef.current) {
      try {
        tusRef.current.abort();
      } catch {}
      tusRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setBytesUploaded(0);
    setError("");
    setSuccess("");
  }

  // For Render/Vercel 502 on 235MB single POST, use TUS direct to Supabase for large files (bypasses gateway)
  const isLargeFile = selectedFile ? selectedFile.size > 50 * 1024 * 1024 : false;
  const tusRef = useRef<tus.Upload | null>(null);

  async function handleUpload() {
    if (!selectedFile) {
      setError("Please select an APK file first.");
      return;
    }

    if (!version.trim()) {
      setError("Enter the release version first.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");
    setProgress(0);
    setBytesUploaded(0);
    setBytesTotal(selectedFile.size);

    // Large file on Render/Vercel/HF: use TUS direct to Supabase (bypasses 502 gateway, no fs.readFileSync)
    if (isLargeFile) {
      try {
        // Ensure bucket is 5GB (call RPC, ignore error)
        try {
          await fetch("/api/admin/storage/fix-bucket", { method: "POST" });
        } catch {}

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token || "";

        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${version.trim()}/${safeFileName}`;

        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(selectedFile, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: 6 * 1024 * 1024,
            headers: {
              authorization: token ? `Bearer ${token}` : "",
              apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
              "x-upsert": "false",
            },
            metadata: {
              bucketName: "winlator-releases",
              objectName: filePath,
              contentType: selectedFile.type || "application/vnd.android.package-archive",
              cacheControl: "3600",
            },
            onError: (err) => {
              const msg = (err.message || "").toLowerCase();
              if (msg.includes("maximum size exceeded") || msg.includes("413")) {
                reject(
                  new Error(
                    `Supabase bucket still 50MB. Run supabase-external-url.sql → fix_winlator_bucket() in Dashboard SQL Editor, or use External APK URL field for now.`
                  )
                );
              } else {
                reject(err);
              }
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              setBytesUploaded(bytesUploaded);
              setBytesTotal(bytesTotal);
              setProgress(bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
            },
            onSuccess: () => resolve(),
          });
          tusRef.current = upload;
          upload.start();
        });

        onUploaded({
          name: selectedFile.name,
          path: filePath,
          size: selectedFile.size,
          type: selectedFile.type || "application/vnd.android.package-archive",
        });
        setSuccess(`APK uploaded via TUS direct to Supabase (bypasses 502 gateway) (${formatBytes(selectedFile.size)}) — persistent, PC can be off.`);
        setProgress(100);
        setBytesUploaded(selectedFile.size);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        tusRef.current = null;
      }
      return;
    }

    // Small file: use single POST via busboy (local or Supabase fallback)
    try {
      const result = await new Promise<{
        name: string;
        path: string;
        size: number;
        type: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setBytesUploaded(e.loaded);
            setBytesTotal(e.total);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          try {
            const responseText = xhr.responseText;
            let data: any = null;
            try {
              data = JSON.parse(responseText);
            } catch {
              data = null;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              if (data && data.success && data.file) {
                resolve(data.file);
              } else {
                reject(new Error(data?.message || `Upload failed: ${xhr.status}`));
              }
            } else {
              const msg =
                data?.message ||
                `Upload failed: ${xhr.status} ${xhr.statusText} ${responseText.slice(0, 500)}`;
              reject(new Error(msg));
            }
          } catch (err) {
            reject(err as Error);
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload. Check connection and retry."));
        };

        xhr.onabort = () => {
          reject(new Error("Upload cancelled."));
        };

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("version", version.trim());

        xhr.open("POST", "/api/admin/releases/upload");
        xhr.send(formData);
      });

      onUploaded(result);
      setSuccess(
        `APK uploaded to self-hosted storage (${formatBytes(result.size)}) — separate from Supabase (news stays on Supabase).`
      );
      setProgress(100);
      setBytesUploaded(result.size);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      if (message.includes("cancelled")) {
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setUploading(false);
      xhrRef.current = null;
    }
  }

  const showProgress = uploading || progress > 0;

  return (
    <div className="apk-upload">
      <div className="apk-upload-box">
        <input
          id="apk-file"
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          onChange={handleFileChange}
          disabled={uploading}
        />

        {selectedFile && (
          <div className="apk-selected-file">
            <strong>{selectedFile.name}</strong>
            <span>
              {formatBytes(selectedFile.size)}
              <span
                style={{
                  marginLeft: "8px",
                  color: "var(--frost)",
                  fontSize: "11px",
                }}
              >
                · Self-hosted (5 GB limit)
              </span>
              {selectedFile.size > 50 * 1024 * 1024 && (
                <span
                  style={{
                    marginLeft: "8px",
                    color: "#79e6a4",
                    fontSize: "11px",
                  }}
                >
                  · 239 MB+ OK
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {showProgress && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            background: "rgba(141,220,255,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            <span>
              {uploading
                ? "Uploading to self-hosted storage..."
                : progress === 100
                ? "Completed"
                : "Ready"}
            </span>
            <span>{progress}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background:
                  progress === 100 ? "#79e6a4" : "var(--frost)",
                transition: "width 0.3s ease",
                borderRadius: "999px",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "8px",
              fontSize: "11px",
              color: "var(--muted)",
              fontFamily: "monospace",
            }}
          >
            <span>
              {formatBytes(bytesUploaded)} /{" "}
              {formatBytes(
                bytesTotal || selectedFile?.size || 0
              )}
            </span>
            <span>
              {bytesTotal > 0
                ? `${(bytesUploaded / 1024 / 1024).toFixed(1)} / ${(bytesTotal / 1024 / 1024).toFixed(1)} MB`
                : ""}
            </span>
          </div>

          {uploading && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <button
                type="button"
                className="button-secondary"
                onClick={handleCancel}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "14px",
        }}
      >
        <button
          type="button"
          className="button-primary"
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
        >
          {uploading
            ? `Uploading... ${progress}%`
            : "Upload APK to Self-Hosted"}
        </button>

        {uploading && (
          <button
            type="button"
            className="button-secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
        )}
      </div>

      <p
        style={{
          marginTop: "10px",
          fontSize: "11px",
          color: "var(--muted)",
          lineHeight: "1.5",
        }}
      >
        ✅ Self-hosted file storage for <strong>releases only</strong> — separate from Supabase (news stays on Supabase). No 50 MB limit, supports up to 5 GB via streaming. Files stored at <code>uploads/releases/{`{version}`}/</code> on your server and served with Range (resumable) via <code>/api/downloads/[version]</code>.
      </p>

      {error && (
        <p
          className="admin-error"
          style={{
            whiteSpace: "pre-line",
            marginTop: "12px",
            padding: "14px",
            borderRadius: "10px",
          }}
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="admin-success"
          style={{ marginTop: "12px" }}
        >
          {success}
        </p>
      )}
    </div>
  );
}
