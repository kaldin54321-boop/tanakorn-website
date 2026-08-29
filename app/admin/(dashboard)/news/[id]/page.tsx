import Link from "next/link";
import { getAdminNewsArticle } from "@/lib/news";
import { updateNewsArticle } from "../actions";
import NewsEditor from "../_components/NewsEditor";

export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

type EditNewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditNewsPage({ params }: EditNewsPageProps) {
  const { id } = await params;
  const article = await getAdminNewsArticle(id);

  if (!article) {
    return (
      <main className="admin-page">
        <div className="admin-page-header">
          <div>
            <p className="admin-eyebrow">WINLATOR@FROST</p>
            <h1>Article Not Found</h1>
            <p className="admin-page-description">The requested news article could not be found.</p>
          </div>
          <Link href="/admin/news" className="button-secondary">← BACK TO NEWS</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">WINLATOR@FROST</p>
          <h1>Edit Article</h1>
          <p className="admin-page-description">Edit and update this Winlator@Frost news article. Manage cover and per-paragraph images.</p>
        </div>
        <Link href="/admin/news" className="button-secondary">← BACK TO NEWS</Link>
      </div>
      <NewsEditor
        mode="edit"
        initialData={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          category: article.category,
          excerpt: article.excerpt ?? "",
          content: article.content,
          image_url: article.image_url,
          published: article.published,
        }}
        action={updateNewsArticle}
      />
    </main>
  );
}
