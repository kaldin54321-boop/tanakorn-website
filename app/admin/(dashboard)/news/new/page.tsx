import Link from "next/link";

import {
  createNewsArticle,
} from "../actions";


export default function NewNewsPage() {

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
            New Article
          </h1>

          <p className="admin-page-description">
            Create a new Winlator@Frost
            news article or announcement.
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
        action={createNewsArticle}
        className="admin-form"
      >

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
                placeholder="Enter article title"
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
                placeholder="example-news-article"
              />

            </label>


            {/* Category */}

            <label>

              <span>
                Category
              </span>

              <select
                name="category"
                defaultValue=""
              >

                <option
                  value=""
                  disabled
                >
                  Select category
                </option>

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


            {/* Published */}

            <label>

              <span>
                Publication Status
              </span>

              <select
                name="published"
                defaultValue="false"
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
            CREATE ARTICLE
          </button>

        </div>

      </form>

    </main>
  );
}