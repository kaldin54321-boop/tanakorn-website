import type { Metadata } from "next";

export const SITE_URL = "https://winlator-frost.tanakorn-website.workers.dev";
export const SITE_NAME = "Winlator@Frost";
export const HOME_TITLE = "Winlator@Frost - Official Home & Download";
export const HOME_DESCRIPTION =
  "Official Winlator@Frost website. Download the latest Winlator@Frost release for Android, check system requirements, and read the latest Frost news and updates.";

export function truncateDescription(
  value: string | null | undefined,
  fallback: string
) {
  const text = (value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PageMetadataOptions): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      title: absoluteTitle ? title : `${title} | ${SITE_NAME}`,
      description,
    },
  };
}
