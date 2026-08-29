import Link from "next/link";
import { getPublicNews } from "@/lib/news";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";
import { parseNewsContent } from "@/lib/news-helpers";

export async function generateStaticParams() {
  try {
    const news = await getPublicNews();
    const slugs = news.slice(0,10).map((a)=>({ slug: a.slug }));
    return locales.flatMap((locale)=> slugs.map(s=>({ locale, slug: s.slug })));
  } catch { return locales.map((locale)=>({ locale, slug: "placeholder"})); }
}
export const revalidate = 0;
export const dynamic = "force-dynamic";

function formatNewsDate(date: string, locale: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const map: Record<string,string> = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES", ru:"ru-RU", tr:"tr-TR", ko:"ko-KR", ja:"ja-JP", zh:"zh-CN", vi:"vi-VN", th:"th-TH", id:"id-ID", pt:"pt-BR", ar:"ar-SA" };
  return parsedDate.toLocaleDateString(map[locale]||"en-US", { year:"numeric", month:"long", day:"numeric"});
}

export default async function NewsArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const news = await getPublicNews();
  const article = news.find((item)=> item.slug === slug);
  if (!article) {
    return (
      <main className="page-container">
        <section className="downloads-empty">
          <p className="page-eyebrow">{dict.common.winlatorFrost}</p>
          <h1>{dict.news.articleNotFound}</h1>
          <p>{dict.news.articleNotFoundDesc}</p>
          <Link href={`/${locale}/news`} className="button-primary">{dict.news.backToNews}</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="article-container">
      <Link href={`/${locale}/news`} className="back-link">{dict.news.backToNewsArrow}</Link>
      <header className="article-header">
        <div><span>{article.category || dict.news.general}</span><small>{formatNewsDate(article.published_at || article.created_at, locale)}</small></div>
        <h1>{article.title}</h1>
      </header>
      {article.image_url && (
        <div style={{ marginTop: 24, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
          <img src={article.image_url} alt={article.title} style={{ width: "100%", height: "auto", maxHeight: 520, objectFit: "cover", display: "block" }} />
        </div>
      )}
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
      <div style={{ marginTop:"60px", paddingTop:"30px", borderTop:"1px solid var(--border)"}}>
        <Link href={`/${locale}/news`} className="button-secondary">{dict.news.backToNewsArrow}</Link>
      </div>
    </main>
  );
}
