import Link from "next/link";

import {
  getAdminNewsArticle,
} from "@/lib/news";

import {
  updateNewsArticle,
} from "../actions";


export async function generateStaticParams() {
  // Admin pages not pre-rendered for static export, return placeholder to satisfy output: export
  return [{ id: "placeholder" }];
}

type EditNewsPageProps = {
  params: Promise<{
    id: string;
  }>;
};


export default async function EditNewsPage({
  params,
}: EditNewsPageProps) {

  const {
    id,
  } = await params;


  const article =
    await getAdminNewsArticle(id);


  if (!article) {

    return (
      <main className="admin-page">

        <div className="admin-page-header">

          <div>

            <p className="admin-eyebrow">
              WINLATOR@FROST
            </p>

            <h1>
              Article Not Found
            </h1>

            <p className="admin-page-description">
              The requested news article could
              not be found.
            </p>

          </div>


          <Link
            href="/admin/news"
            className="button-secondary"
          >
            ← BACK TO NEWS
          </Link>

        </div>

      </main>
    );
  }


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
            Edit Article
          </h1>

          <p className="admin-page-description">
            Edit and update this Winlator@Frost
            news article.
          </p>

        </div>


        <Link
          href="/admin/news"
          className="button-secondary"
        >
          ← BACK TO NEWS
        </Link>

      </div>


      {/* ======================================
          FORM
          ====================================== */}

      <form
        action={updateNewsArticle}
        className="admin-form"
      >

        <input
  type="hidden"
  name="id"
  value={article.id}
/>

<input
  type="hidden"
  name="old_slug"
  value={article.slug}
/>

        {/* ====================================
            BASIC INFORMATION
            ==================================== */}

        <section className="admin-form-section">

          <h2>
            Article Information
          </h2>


          <div className="form-grid">

            {/* Title */}

            <label>

              <span>
                Title
              </span>

              <input
                type="text"
                name="title"
                defaultValue={
                  article.title
                }
              />

            </label>


            {/* Slug */}

            <label>

              <span>
                Slug
              </span>

              <input
                type="text"
                name="slug"
                defaultValue={
                  article.slug
                }
              />

            </label>


            {/* Category */}

            <label>

              <span>
                Category
              </span>

              <select
                name="category"
                defaultValue={
                  article.category
                }
              >

                <option value="News">
                  News
                </option>

                <option value="Release">
                  Release
                </option>

                <option value="Announcement">
                  Announcement
                </option>

                <option value="Development">
                  Development
                </option>

                <option value="Update">
                  Update
                </option>

              </select>

            </label>


            {/* Publication Status */}

            <label>

              <span>
                Publication Status
              </span>

              <select
                name="published"
                defaultValue={
                  String(
                    article.published
                  )
                }
              >

                <option value="false">
                  Draft
                </option>

                <option value="true">
                  Published
                </option>

              </select>

            </label>

          </div>

        </section>


        {/* ====================================
            EXCERPT
            ==================================== */}

        <section className="admin-form-section">

          <h2>
            Article Summary
          </h2>


          <label>

            <span>
              Excerpt
            </span>

            <textarea
              name="excerpt"
              rows={4}
              defaultValue={
                article.excerpt ?? ""
              }
              placeholder="Write a short summary of this article..."
            />

          </label>

        </section>


        {/* ====================================
            CONTENT
            ==================================== */}

        <section className="admin-form-section">

          <h2>
            Article Content
          </h2>


          <label>

            <span>
              Content
            </span>

            <textarea
              name="content"
              rows={18}
              defaultValue={
                article.content
              }
              placeholder="Write the full article content here..."
            />

          </label>

        </section>


        {/* ====================================
            IMAGE
            ==================================== */}

        <section className="admin-form-section">

          <h2>
            Article Image
          </h2>


          <label>

            <span>
              Image URL
            </span>

            <input
              type="url"
              name="image_url"
              defaultValue={
                article.image_url ?? ""
              }
              placeholder="https://..."
            />

          </label>

        </section>


        {/* ====================================
            ACTIONS
            ==================================== */}

        <div className="admin-form-actions">

          <Link
            href="/admin/news"
            className="button-secondary"
          >
            CANCEL
          </Link>


          <button
            type="submit"
            className="button-primary"
          >
            SAVE CHANGES
          </button>

        </div>

      </form>

    </main>
  );
}