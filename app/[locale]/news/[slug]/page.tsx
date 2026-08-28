import Link from "next/link";
import { getPublicNews } from "@/lib/news";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";

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
      <article className="article-body">
        {article.content.split("\n").map((paragraph, index)=> !paragraph.trim() ? null : <p key={index}>{paragraph}</p>)}
      </article>
      <div style={{ marginTop:"60px", paddingTop:"30px", borderTop:"1px solid var(--border)"}}>
        <Link href={`/${locale}/news`} className="button-secondary">{dict.news.backToNewsArrow}</Link>
      </div>
    </main>
  );
}
