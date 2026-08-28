import Link from "next/link";
import { getPublicNews } from "@/lib/news";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

function formatNewsDate(date: string, locale: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const map: Record<string,string> = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES", ru:"ru-RU", tr:"tr-TR", ko:"ko-KR", ja:"ja-JP", zh:"zh-CN", vi:"vi-VN", th:"th-TH", id:"id-ID", pt:"pt-BR", ar:"ar-SA" };
  return parsedDate.toLocaleDateString(map[locale]||"en-US", { year:"numeric", month:"long", day:"numeric"});
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const news = await getPublicNews();
  return (
    <main className="page-container">
      <section className="page-hero">
        <p className="page-eyebrow">{dict.common.winlatorFrost}</p>
        <h1>{dict.news.title}</h1>
        <p>{dict.news.desc}</p>
      </section>
      {news.length === 0 && (
        <section className="downloads-empty">
          <h2>{dict.news.noNewsTitle}</h2>
          <p>{dict.news.noNewsDesc}</p>
        </section>
      )}
      {news.length > 0 && (
        <section className="news-list">
          {news.map((article) => (
            <article key={article.id} className="news-list-card">
              <div className="news-list-image">NEWS</div>
              <div className="news-list-content">
                <div className="news-meta">
                  <span>{article.category || dict.news.general}</span>
                  <span>{formatNewsDate(article.published_at || article.created_at, locale)}</span>
                </div>
                <h2>{article.title}</h2>
                {article.excerpt && <p>{article.excerpt}</p>}
                <Link href={`/${locale}/news/${article.slug}`} className="button-secondary">{dict.news.readArticle}</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
