import ViewTracker from "./components/ViewTracker";
import "./globals.css";
import { cookies, headers } from "next/headers";

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
        {children}
      </body>
    </html>
  );
}