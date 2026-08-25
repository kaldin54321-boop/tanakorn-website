import Link from "next/link";

interface DownloadFileProps {
  name: string;
  type: string;
  architecture: string;
  size: string;
  checksum: string;
  downloadUrl: string | null;
}

export default function DownloadFile({
  name,
  type,
  architecture,
  size,
  checksum,
  downloadUrl,
}: DownloadFileProps) {
  return (
    <div className="download-file">

      <div className="download-file-icon">
        APK
      </div>

      <div className="download-file-info">

        <h3>
          {name}
        </h3>

        <div className="download-file-meta">

          <span>
            {type}
          </span>

          <span>
            {architecture}
          </span>

          <span>
            {size}
          </span>

        </div>

        <div className="checksum">

          SHA-256:
          {" "}
          {checksum}

        </div>

      </div>

      {downloadUrl ? (
        <Link
          href={downloadUrl}
          className="button-primary"
        >
          Download
        </Link>
      ) : (
        <button
          className="button-secondary"
          disabled
        >
          Coming Soon
        </button>
      )}

    </div>
  );
}