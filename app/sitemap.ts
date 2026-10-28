import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/seo";

const publicPaths = ["", "/downloads", "/news", "/support"];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((alternate) => [
            alternate,
            `${SITE_URL}/${alternate}${path}`,
          ])
        ),
      },
    }))
  );
}
