import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { SITE_URL } from "@/lib/seo";
import ViewTracker from "./components/ViewTracker";
import DonationDangerModal from "./components/DonationDangerModal";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Winlator@Frost",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const h = await headers();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const headerLocale = h.get("x-locale");
  const locale = headerLocale || cookieLocale || "en";
  const isRTL = locale === "ar";
  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
      <body>
        <ViewTracker />
        <DonationDangerModal />
        {children}
      </body>
    </html>
  );
}