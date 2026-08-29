import Link from "next/link";

import {
  getPublicNews,
} from "@/lib/news";

import { parseNewsContent } from "@/lib/news-helpers";

export async function generateStaticParams() {
  // For Cloudflare Pages static export (CF_PAGES=1), pre-generate existing slugs at build time
  // For dynamic runtime (standalone), this is ignored due to force-dynamic
  try {
    const { getPublicNews } = await import("@/lib/news");
    const news = await getPublicNews();
    return news.slice(0, 10).map((a) => ({ slug: a.slug }));
  } catch {
    return [{ slug: "placeholder" }];
  }
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

type NewsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};


function formatNewsDate(
  date: string
) {
  const parsedDate =
    new Date(date);


  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return date;
  }


  return parsedDate.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}


export default async function NewsArticlePage({
  params,
}: NewsPageProps) {

  // ------------------------------------------
  // Get slug from URL
  // ------------------------------------------

  const {
    slug,
  } = await params;


  // ------------------------------------------
  // Get published news
  // ------------------------------------------

  const news =
    await getPublicNews();


  // ------------------------------------------
  // Find requested article
  // ------------------------------------------

  const article =
    news.find(
      (item) =>
        item.slug === slug
    );


  // ------------------------------------------
  // Article not found
  // ------------------------------------------

  if (!article) {

    return (
      <main className="page-container">

        <section className="downloads-empty">

          <p className="page-eyebrow">
            WINLATOR@FROST
          </p>


          <h1>
            Article Not Found
          </h1>


          <p>
            The requested Winlator@Frost
            news article could not be found.
          </p>


          <Link
            href="/news"
            className="button-primary"
          >
            BACK TO NEWS
          </Link>

        </section>

      </main>
    );
  }


  // ------------------------------------------
  // Article found
  // ------------------------------------------

  return (
    <main className="article-container">

      {/* ====================================== */}
      {/* BACK LINK                              */}
      {/* ====================================== */}

      <Link
        href="/news"
        className="back-link"
      >
        ← Back to News
      </Link>


      {/* ====================================== */}
      {/* ARTICLE HEADER                         */}
      {/* ====================================== */}

      <header className="article-header">

        <div>

          <span>
            {article.category ||
              "GENERAL"}
          </span>


          <small>
            {formatNewsDate(
              article.published_at ||
              article.created_at
            )}
          </small>

        </div>


        <h1>
          {article.title}
        </h1>

      </header>

      {/* Cover image (optional) */}
      {article.image_url && (
        <div style={{ marginTop: 24, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
          <img src={article.image_url} alt={article.title} style={{ width: "100%", height: "auto", maxHeight: 520, objectFit: "cover", display: "block" }} />
        </div>
      )}


      {/* ====================================== */}
      {/* ARTICLE CONTENT                        */}
      {/* ====================================== */}

      <article className="article-body">

        {(() => {
          const blocks = parseNewsContent(article.content);
          return blocks.map((block, idx) => (
            <div key={idx} style={{ marginBottom: block.imageUrl ? 28 : undefined }}>
              {block.text && <p>{block.text}</p>}
              {block.imageUrl && (
                <figure style={{ margin: block.text ? "16px 0 0" : "0", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img src={block.imageUrl} alt={block.imageAlt || `Image ${idx + 1}`} style={{ width: "100%", height: "auto", display: "block" }} loading="lazy" />
                  {block.imageAlt && <figcaption style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>{block.imageAlt}</figcaption>}
                </figure>
              )}
            </div>
          ));
        })()}

      </article>


      {/* ====================================== */}
      {/* FOOTER ACTION                         */}
      {/* ====================================== */}

      <div
        style={{
          marginTop: "60px",
          paddingTop: "30px",
          borderTop:
            "1px solid var(--border)",
        }}
      >

        <Link
          href="/news"
          className="button-secondary"
        >
          ← BACK TO NEWS
        </Link>

      </div>

    </main>
  );
}