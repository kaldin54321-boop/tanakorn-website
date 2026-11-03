import { SITE_NAME, SITE_URL } from "@/lib/seo";

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: "Winlator Frost",
  url: `${SITE_URL}/`,
};

export default function WebsiteStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
    />
  );
}
