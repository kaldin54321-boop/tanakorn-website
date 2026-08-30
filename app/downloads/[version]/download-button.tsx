"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  version: string;
  fileName: string;
  fileSize: number | null;
  isExternal?: boolean;
  externalUrl?: string;
  initialDownloadCount?: number | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DownloadButton({
  version,
  fileName: initialFileName,
  fileSize,
  isExternal = false,
  externalUrl,
  initialDownloadCount = null,
}: Props) {
  const [fileName, setFileName] = useState(initialFileName);
  const [downloading, setDownloading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [bytesTotal, setBytesTotal] = useState<number | null>(fileSize);
  const [error, setError] = useState("");
  const [downloadCount, setDownloadCount] = useState<number>(initialDownloadCount ?? 0);
  const [resolvedInfo, setResolvedInfo] = useState<{ fileName?: string; fileSize?: number | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const receivedRef = useRef(0);

  // Fetch metadata + public download count polling
  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      try {
        const res = await fetch(`/api/downloads/${encodeURIComponent(version)}?info=1`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          if (data.file_name && data.file_name !== initialFileName) setFileName(data.file_name);
          if (data.file_size && data.file_size !== fileSize) {
            setBytesTotal(data.file_size);
            setResolvedInfo({ fileName: data.file_name, fileSize: data.file_size });
          }
          if (data.file_size) setBytesTotal(data.file_size);
        }
      } catch {}
    }
    async function fetchPublicCount() {
      try {
        const r = await fetch(`/api/downloads/${encodeURIComponent(version)}/increment`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d.success && typeof d.download_count === "number") setDownloadCount(d.download_count);
      } catch {}
    }
    fetchInfo();
    fetchPublicCount();
    const id = setInterval(fetchPublicCount, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchPublicCount(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version, initialFileName, fileSize]);

  // Keep downloadCount in sync with initialDownloadCount prop (live from server)
  useEffect(() => {
    if (initialDownloadCount !== null && initialDownloadCount !== undefined) {
      setDownloadCount(initialDownloadCount);
    }
  }, [initialDownloadCount]);

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
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) {
        headers["Range"] = `bytes=${resumeFrom}-`;
      }

      // Single fetch to our proxy - it stays on-site (no redirect to external tab)
      // For external URLs, the API proxies the file and streams it here
      // For S3, the API redirects to signed URL which fetch follows automatically
      // For local files, it streams directly
      const res = await fetch(
        `/api/downloads/${encodeURIComponent(version)}`,
        {
          headers,
          signal: controller.signal,
          cache: "no-store",
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

      const contentLength = res.headers.get("Content-Length");
      const contentRange = res.headers.get("Content-Range");
      const contentDisposition = res.headers.get("Content-Disposition");
      // Try to extract filename from header if provided
      if (contentDisposition) {
        const m = contentDisposition.match(/filename="?([^"]+)"?/i);
        if (m && m[1]) {
          const extracted = m[1].trim();
          if (extracted && extracted !== fileName) setFileName(extracted);
        }
      }
      let total: number | null = bytesTotal ?? fileSize;
      if (contentRange) {
        const m = contentRange.match(/bytes \d+-\d+\/(\d+)/);
        if (m) total = parseInt(m[1], 10);
      } else if (contentLength) {
        const parsed = parseInt(contentLength, 10);
        if (!isNaN(parsed) && parsed > 0) total = parsed + resumeFrom;
      }
      if (!total && bytesTotal) total = bytesTotal;
      if (total && total > 0) setBytesTotal(total);

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No readable stream - browser does not support streaming download. Trying direct link...");
      }

      const chunks: Blob[] = [...existingChunks];
      let received = resumeFrom;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(new Blob([value]));
          received += value.length;
          receivedRef.current = received;
          chunksRef.current = chunks;
          setBytesReceived(received);
          const t = total ?? fileSize ?? bytesTotal;
          if (t && t > 0) {
            const pct = Math.min(100, Math.round((received / t) * 100));
            setProgress(pct);
            if (!bytesTotal || bytesTotal !== t) setBytesTotal(t);
          }
        }
      }

      // Complete - trigger download on-site (saves to device storage, no new tab)
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use best filename we have
      const finalName = fileName || initialFileName || `Winlator@Frost-${version}.apk`;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(100);
      setDownloading(false);
      setPaused(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPaused(true);
        setDownloading(true);
        return;
      }
      // If streaming failed, fallback message (not redirect)
      const msg = err instanceof Error ? err.message : "Download failed.";
      if (msg.includes("No readable stream")) {
        setError(msg + " Please try again or use Direct Link below (still on-site).");
      } else {
        setError(msg);
      }
      setDownloading(false);
      setPaused(false);
    }
  }

  function handleDownload() {
    if (downloading && !paused) return;
    setBytesReceived(0);
    setProgress(0);
    setError("");
    chunksRef.current = [];
    receivedRef.current = 0;
    // Increment live download count
    fetch(`/api/downloads/${encodeURIComponent(version)}/increment`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.download_count !== undefined) {
          setDownloadCount(data.download_count);
        }
      })
      .catch(() => {});
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
      startDownload(receivedRef.current, chunksRef.current);
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

  const displaySize = bytesTotal ?? fileSize;
  const hasSize = displaySize !== null && displaySize > 0;

  return (
    <div style={{ width: "100%" }}>
      {!downloading && !paused && progress === 0 && (
        <>
          <button
            onClick={handleDownload}
            className="download-button"
            style={{ width: "100%" }}
          >
            DOWNLOAD APK
          </button>
          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--frost)", letterSpacing: "0.03em" }}>
              ⬇ {downloadCount.toLocaleString()} downloads
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)", textAlign: "center" }}>
              {isExternal
                ? hasSize
                  ? `External • ${formatBytes(displaySize!)}`
                  : "External • Size detected on download"
                : hasSize
                  ? `${formatBytes(displaySize!)} • resumable`
                  : "Resumable download"}
            </span>
          </div>
        </>
      )}

      {(downloading || paused || progress > 0) && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
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
            <span>{paused ? "Paused" : downloading ? "Downloading..." : progress === 100 ? "Completed" : "Ready"}</span>
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
                background: progress === 100 ? "#79e6a4" : "var(--frost)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div style={{ marginTop: "8px", display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--frost)", fontWeight: 800 }}>⬇ {downloadCount.toLocaleString()} downloads</span>
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
              {formatBytes(bytesReceived)} / {bytesTotal ? formatBytes(bytesTotal) : hasSize ? formatBytes(displaySize!) : "Unknown"}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50%" }}>{fileName}</span>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            {downloading && !paused && (
              <button type="button" className="button-secondary" onClick={handlePause} style={{ padding: "8px 14px", fontSize: "12px" }}>
                Pause
              </button>
            )}
            {paused && (
              <button type="button" className="button-primary" onClick={handleResume} style={{ padding: "8px 14px", fontSize: "12px" }}>
                Resume
              </button>
            )}
            {(downloading || paused) && (
              <button type="button" className="button-secondary" onClick={handleCancel} style={{ padding: "8px 14px", fontSize: "12px" }}>
                Cancel
              </button>
            )}
            {progress === 100 && (
              <button type="button" className="button-primary" onClick={handleDownload} style={{ padding: "8px 14px", fontSize: "12px" }}>
                Download Again
              </button>
            )}
          </div>

          <p style={{ marginTop: "10px", fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", textAlign: "center" }}>
            {isExternal
              ? "Proxied through this website • No new tab • File saved to device storage on finish • Supports Range/resume when host allows"
              : "Resumable download • Auto-resume on failure • Supports Range requests"}
            {paused && " • Paused - click Resume to continue from " + formatBytes(bytesReceived)}
          </p>
        </div>
      )}

      {!downloading && !paused && progress === 0 && (
        <p style={{ marginTop: "10px", fontSize: "11px", color: "var(--muted)", textAlign: "center" }}>
          {isExternal ? "One-click • On-site download • No redirect to external host" : "Resumable • Progress shown • Pause/Resume supported"}
        </p>
      )}

      {error && (
        <p className="admin-error" style={{ marginTop: "12px", whiteSpace: "pre-line", fontSize: "12px" }}>
          {error}
        </p>
      )}
    </div>
  );
}
