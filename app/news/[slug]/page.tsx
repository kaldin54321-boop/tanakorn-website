import Link from "next/link";

import {
  getPublicNews,
} from "@/lib/news";

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


      {/* ====================================== */}
      {/* ARTICLE CONTENT                        */}
      {/* ====================================== */}

      <article className="article-body">

        {article.content
          .split("\n")
          .map(
            (paragraph, index) => {

              if (
                !paragraph.trim()
              ) {
                return null;
              }


              return (
                <p key={index}>
                  {paragraph}
                </p>
              );
            }
          )}

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