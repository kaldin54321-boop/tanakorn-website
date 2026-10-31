import type { Metadata } from "next";
import VideoGallery from "@/app/components/VideoGallery";
import { getAllFrostVideos, YOUTUBE_CHANNEL_URL } from "@/lib/youtube";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { defaultLocale, locales } from "@/lib/i18n/config";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const canonical = `/${locale}/videos`;

  return {
    title: `${dict.home.seeFrostInAction} – Winlator@Frost`,
    description: dict.home.videosPageDesc,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          locales.map((item) => [item, `/${item}/videos`])
        ),
        "x-default": `/${defaultLocale}/videos`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Winlator@Frost",
      title: `${dict.home.seeFrostInAction} – Winlator@Frost`,
      description: dict.home.videosPageDesc,
    },
  };
}

export default async function VideosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const videos = await getAllFrostVideos();

  return (
    <main className="page-container">
      <section className="page-hero">
        <p className="page-eyebrow">{dict.home.featuredVideos}</p>
        <h1>{dict.home.seeFrostInAction}</h1>
        <p>{dict.home.videosPageDesc}</p>
      </section>

      <section className="videos-page-section">
        {videos.length === 0 ? (
          <div className="youtube-empty">
            <p>{dict.home.noVideosTitle}</p>
            <span>{dict.home.noVideosDesc}</span>
          </div>
        ) : (
          <>
            <div className="videos-page-toolbar">
              <span className="videos-page-count">
                {videos.length} Winlator@Frost videos
              </span>
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                @HMgamingstudioTH ↗
              </a>
            </div>
            <VideoGallery videos={videos} />
          </>
        )}
      </section>
    </main>
  );
}
