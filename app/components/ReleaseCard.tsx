import Link from "next/link";

interface ReleaseCardProps {
  version: string;
  status: string;
  date: string;
  architecture: string;
  description: string;
}

export default function ReleaseCard({
  version,
  status,
  date,
  architecture,
  description,
}: ReleaseCardProps) {
  return (
    <article className="release-item">

      <div className="release-version">

        <span>
          VERSION
        </span>

        <strong>
          {version}
        </strong>

      </div>


      <div className="release-info">

        <div className="release-status">
          {status}
        </div>

        <h2>
          Winlator@Frost {version}
        </h2>

        <p>
          {description}
        </p>

        <div className="release-meta">

          <span>
            Android {architecture}
          </span>

          <span>
            {date}
          </span>

        </div>

      </div>


      <Link
        href={`/downloads/${version}`}
        className="button-primary"
      >
        View Release
      </Link>

    </article>
  );
}
