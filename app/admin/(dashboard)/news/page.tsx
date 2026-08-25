import Link from "next/link";

import {
  getAdminNews,
} from "@/lib/news";

import DeleteNewsButton from "./delete-news-button";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {

  const news =
    await getAdminNews();


  return (
    <main className="admin-page">

      {/* ======================================
          HEADER
          ====================================== */}

      <div className="admin-page-header">

        <div>

          <p className="admin-eyebrow">
            WINLATOR@FROST
          </p>

          <h1>
            News
          </h1>

          <p className="admin-page-description">
            Manage Winlator@Frost news
            articles and announcements.
          </p>

        </div>


        <Link
          href="/admin/news/new"
          className="button-primary"
        >
          + NEW ARTICLE
        </Link>

      </div>


      {/* ======================================
          NEWS LIST
          ====================================== */}

      {news.length === 0 ? (

        <section className="admin-empty-state">

          <div className="admin-empty-icon">
            📰
          </div>

          <h2>
            No News Articles
          </h2>

          <p>
            There are currently no published
            news articles.
          </p>

          <Link
            href="/admin/news/new"
            className="button-primary"
          >
            CREATE FIRST ARTICLE
          </Link>

        </section>

      ) : (

        <section className="release-table">

          {/* Table header */}

          <div className="release-table-header">

            <span>
              Article
            </span>

            <span>
              Category
            </span>

            <span>
              Status
            </span>

            <span>
              Published
            </span>

            <span>
              Actions
            </span>

          </div>


          {/* Articles */}

          {news.map((article) => (

            <div
              key={article.id}
              className="release-table-row"
            >

              <div className="release-name">

                <strong>
                  {article.title}
                </strong>

                <span>
                  /news/{article.slug}
                </span>

              </div>


              <div>

                {article.category}

              </div>


              <div>

                <span
                  className={
                    `status-badge ${
                      article.published
                        ? "status-stable"
                        : "status-beta"
                    }`
                  }
                >
                  {article.published
                    ? "Published"
                    : "Draft"}
                </span>

              </div>


              <div>

                {article.published_at
                  ? new Date(
                      article.published_at
                    ).toLocaleDateString(
                      "en-US"
                    )
                  : "—"}

              </div>


              <div className="release-actions">

                <Link
                  href={`/admin/news/${article.id}`}
                  className="button-secondary"
                >
                  Edit
                </Link>

                <DeleteNewsButton
                  id={article.id}
                  title={article.title}
                />

              </div>

            </div>

          ))}

        </section>

      )}

    </main>
  );
}