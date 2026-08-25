import Link from "next/link";

import {
  getPublicNews,
} from "@/lib/news";

export const revalidate = 0;
export const dynamic = "force-dynamic";


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


export default async function NewsPage() {

  const news =
    await getPublicNews();


  return (
    <main className="page-container">

      {/* ====================================== */}
      {/* HERO                                   */}
      {/* ====================================== */}

      <section className="page-hero">

        <p className="page-eyebrow">
          WINLATOR@FROST
        </p>


        <h1>
          News
        </h1>


        <p>
          Latest news, announcements,
          updates and development information
          from Winlator@Frost.
        </p>

      </section>


      {/* ====================================== */}
      {/* NO NEWS                                */}
      {/* ====================================== */}

      {news.length === 0 && (

        <section className="downloads-empty">

          <h2>
            No News Available
          </h2>


          <p>
            There are currently no published
            Winlator@Frost news articles.
          </p>

        </section>

      )}


      {/* ====================================== */}
      {/* NEWS LIST                              */}
      {/* ====================================== */}

      {news.length > 0 && (

        <section className="news-list">

          {news.map(
            (article) => (

              <article
                key={article.id}
                className="news-list-card"
              >

                {/* IMAGE / PLACEHOLDER */}

                <div className="news-list-image">

                  NEWS

                </div>


                {/* CONTENT */}

                <div className="news-list-content">

                  <div className="news-meta">

                    <span>
                      {article.category ||
                        "GENERAL"}
                    </span>


                    <span>
                      {formatNewsDate(
                        article.published_at ||
                        article.created_at
                      )}
                    </span>

                  </div>


                  <h2>
                    {article.title}
                  </h2>


                  {article.excerpt && (

                    <p>
                      {article.excerpt}
                    </p>

                  )}


                  <Link
                    href={`/news/${article.slug}`}
                    className="button-secondary"
                  >
                    READ ARTICLE
                  </Link>

                </div>

              </article>

            )
          )}

        </section>

      )}

    </main>
  );
}