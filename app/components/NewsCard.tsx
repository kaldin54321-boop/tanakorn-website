import Link from "next/link";

interface NewsCardProps {
  slug: string;
  category: string;
  date: string;
  title: string;
  description: string;
}

export default function NewsCard({
  slug,
  category,
  date,
  title,
  description,
}: NewsCardProps) {
  return (
    <article className="news-card">

      <div className="news-image">
        {category}
      </div>

      <div className="news-content">

        <span>
          {category}
        </span>

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

        <small>
          {date}
        </small>

        <br />

        <Link href={`/news/${slug}`}>
          Read article →
        </Link>

      </div>

    </article>
  );
}
