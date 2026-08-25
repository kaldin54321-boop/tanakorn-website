"use client";

import { useRef, useState } from "react";

type Props = {
  version: string;
  fileName: string;
  fileSize: number | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DownloadButton({
  version,
  fileName,
  fileSize,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [bytesTotal, setBytesTotal] = useState<number | null>(fileSize);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const receivedRef = useRef(0);

  async function startDownload(
    resumeFrom = 0,
    existingChunks: Blob[] = []
  ) {
    setError("");
    setDownloading(true);
    setPaused(false);

    const controller = new AbortController();
    abortRef.current = controller;
    chunksRef.current = existingChunks;
    receivedRef.current = resumeFrom;

    try {
      // Resolve signed URL via API - follow redirect manually to get final URL with Range support
      // First fetch the API redirect location
      const headRes = await fetch(
        `/api/downloads/${encodeURIComponent(version)}`,
        {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
        }
      );

      let downloadUrl: string | null = null;

      // If redirect, Location header contains signed URL
      if (headRes.status >= 300 && headRes.status < 400) {
        downloadUrl = headRes.headers.get("Location");
      }

      // Fallback: if API returned JSON error, parse
      if (!downloadUrl) {
        // Try fetching as JSON to get error, otherwise use redirect URL via .url
        // For some browsers manual redirect is opaque, so just use direct URL
        // Alternative: fetch which follows redirect and returns blob
        // So we directly fetch the API which will redirect to Supabase
        // Use fetch with Range header if resuming
        const headers: Record<string, string> = {};
        if (resumeFrom > 0) {
          headers["Range"] = `bytes=${resumeFrom}-`;
        }

        const res = await fetch(
          `/api/downloads/${encodeURIComponent(version)}`,
          {
            headers,
            signal: controller.signal,
          }
        );

        if (!res.ok && res.status !== 206) {
          const data = await res
            .json()
            .catch(() => null);
          throw new Error(
            data?.message ||
              `Download failed: ${res.status} ${res.statusText}`
          );
        }

        const contentLength =
          res.headers.get("Content-Length");
        const contentRange =
          res.headers.get("Content-Range");
        let total = bytesTotal;
        if (contentRange) {
          const m = contentRange.match(
            /bytes \d+-\d+\/(\d+)/
          );
          if (m) total = parseInt(m[1], 10);
        } else if (contentLength) {
          total =
            parseInt(contentLength, 10) +
            resumeFrom;
        }
        if (total) setBytesTotal(total);

        const reader =
          res.body?.getReader();
        if (!reader) {
          // Fallback: just redirect
          window.location.href = `/api/downloads/${encodeURIComponent(version)}`;
          setDownloading(false);
          return;
        }

        const chunks: Blob[] = [...existingChunks];
        let received = resumeFrom;

        while (true) {
          const { done, value } =
            await reader.read();
          if (done) break;
          if (value) {
            chunks.push(
              new Blob([value])
            );
            received += value.length;
            receivedRef.current = received;
            chunksRef.current = chunks;
            setBytesReceived(received);
            const t = total || fileSize;
            if (t) {
              setProgress(
                Math.round(
                  (received / t) * 100
                )
              );
              setBytesTotal(t);
            }
          }
        }

        // Complete - trigger download
        const blob = new Blob(chunks);
        const url =
          URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(
          () => URL.revokeObjectURL(url),
          1000
        );
        setProgress(100);
        setDownloading(false);
        return;
      }

      // If we got direct signed URL via Location, fetch it with progress and Range
      const headers: Record<string, string> =
        {};
      if (resumeFrom > 0) {
        headers["Range"] =
          `bytes=${resumeFrom}-`;
      }

      const res = await fetch(
        downloadUrl,
        {
          headers,
          signal: controller.signal,
        }
      );

      if (!res.ok && res.status !== 206) {
        throw new Error(
          `Download failed: ${res.status}`
        );
      }

      const contentLength =
        res.headers.get("Content-Length");
      const contentRange =
        res.headers.get("Content-Range");
      let total = bytesTotal;
      if (contentRange) {
        const m =
          contentRange.match(
            /bytes \d+-\d+\/(\d+)/
          );
        if (m) total = parseInt(m[1], 10);
      } else if (contentLength) {
        total =
          parseInt(contentLength, 10) +
          resumeFrom;
      }
      if (total) setBytesTotal(total);

      const reader = res.body?.getReader();
      if (!reader) {
        window.location.href =
          downloadUrl;
        setDownloading(false);
        return;
      }

      const chunks: Blob[] = [...existingChunks];
      let received = resumeFrom;

      while (true) {
        const { done, value } =
          await reader.read();
        if (done) break;
        if (value) {
          chunks.push(new Blob([value]));
          received += value.length;
          receivedRef.current = received;
          chunksRef.current = chunks;
          setBytesReceived(received);
          const t = total || fileSize;
          if (t) {
            setProgress(
              Math.round(
                (received / t) * 100
              )
            );
          }
        }
      }

      const blob = new Blob(chunks);
      const url =
        URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );
      setProgress(100);
      setDownloading(false);
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        // Paused - keep state
        setPaused(true);
        setDownloading(true);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Download failed."
      );
      setDownloading(false);
      setPaused(false);
    }
  }

  function handleDownload() {
    if (downloading && !paused) return;
    // Reset and start fresh
    setBytesReceived(0);
    setProgress(0);
    setError("");
    chunksRef.current = [];
    receivedRef.current = 0;
    startDownload(0, []);
  }

  function handlePause() {
    if (abortRef.current) {
      abortRef.current.abort();
      setPaused(true);
    }
  }

  function handleResume() {
    if (paused) {
      setPaused(false);
      setDownloading(true);
      startDownload(
        receivedRef.current,
        chunksRef.current
      );
    }
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setDownloading(false);
    setPaused(false);
    setProgress(0);
    setBytesReceived(0);
    chunksRef.current = [];
    receivedRef.current = 0;
    setError("");
  }

  // Simple direct download fallback for quick use
  function handleDirectDownload() {
    window.location.href = `/api/downloads/${encodeURIComponent(version)}`;
  }

  return (
    <div
      style={{
        width: "100%",
      }}
    >
      {!downloading && !paused && progress === 0 && (
        <button
          onClick={handleDownload}
          className="download-button"
          style={{
            width: "100%",
          }}
        >
          DOWNLOAD APK
        </button>
      )}

      {(downloading || paused || progress > 0) && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            background:
              "rgba(141,220,255,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginBottom: "8px",
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            <span>
              {paused
                ? "Paused"
                : downloading
                ? "Downloading..."
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
              background:
                "rgba(255,255,255,0.08)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background:
                  progress === 100
                    ? "#79e6a4"
                    : "var(--frost)",
                transition:
                  "width 0.3s ease",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginTop: "8px",
              fontSize: "11px",
              color: "var(--muted)",
              fontFamily: "monospace",
            }}
          >
            <span>
              {formatBytes(bytesReceived)} /{" "}
              {bytesTotal
                ? formatBytes(bytesTotal)
                : "Unknown"}
            </span>
            <span>
              {fileName}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "12px",
              flexWrap: "wrap",
            }}
          >
            {downloading && !paused && (
              <button
                type="button"
                className="button-secondary"
                onClick={handlePause}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                }}
              >
                Pause
              </button>
            )}

            {paused && (
              <button
                type="button"
                className="button-primary"
                onClick={handleResume}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                }}
              >
                Resume
              </button>
            )}

            {(downloading || paused) && (
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
            )}

            {progress === 100 && (
              <button
                type="button"
                className="button-primary"
                onClick={handleDownload}
                style={{
                  padding: "8px 14px",
                  fontSize: "12px",
                }}
              >
                Download Again
              </button>
            )}

            <button
              type="button"
              className="button-secondary"
              onClick={handleDirectDownload}
              style={{
                padding: "8px 14px",
                fontSize: "12px",
                marginLeft: "auto",
              }}
            >
              Direct Link
            </button>
          </div>

          <p
            style={{
              marginTop: "10px",
              fontSize: "11px",
              color: "var(--muted)",
              lineHeight: "1.5",
            }}
          >
            Resumable download • Auto-resume on
            failure • Supports Range requests
            {paused &&
              " • Paused - click Resume to continue from " +
                formatBytes(bytesReceived)}
          </p>
        </div>
      )}

      {!downloading &&
        !paused &&
        progress === 0 && (
          <p
            style={{
              marginTop: "10px",
              fontSize: "11px",
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            Resumable • Progress shown • Pause/Resume supported
          </p>
        )}

      {error && (
        <p
          className="admin-error"
          style={{
            marginTop: "12px",
            whiteSpace: "pre-line",
            fontSize: "12px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
