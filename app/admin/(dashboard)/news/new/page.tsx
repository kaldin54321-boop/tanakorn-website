import Link from "next/link";
import { createNewsArticle } from "../actions";
import NewsEditor from "../_components/NewsEditor";

export default function NewNewsPage() {
  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">WINLATOR@FROST</p>
          <h1>New Article</h1>
          <p className="admin-page-description">Create a new Winlator@Frost news article or announcement. Attach cover image and per-paragraph images from device storage.</p>
        </div>
        <Link href="/admin/news" className="button-secondary">← BACK TO NEWS</Link>
      </div>
      <NewsEditor mode="create" action={createNewsArticle} />
    </main>
  );
}
