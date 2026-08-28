import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, getPreferredLocale } from "./lib/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip api, _next, admin, static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_static") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/uploads") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check if pathname already has locale
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (hasLocale) {
    const locale = pathname.split("/")[1];
    const res = NextResponse.next();
    res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
    res.headers.set("x-locale", locale);
    // also forward to request headers for layout
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-locale", locale);
    return NextResponse.next({
      request: { headers: reqHeaders },
      headers: res.headers,
    });
  }

  // No locale -> detect from cookie or Accept-Language
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  let locale: string = defaultLocale;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const accept = request.headers.get("accept-language");
    locale = getPreferredLocale(accept);
  }

  // Redirect to locale-prefixed URL
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  // Preserve search
  const res = NextResponse.redirect(url);
  res.cookies.set("NEXT_LOCALE", locale, { path: "/", maxAge: 31536000 });
  return res;
}

export const config = {
  matcher: ["/((?!api|_next|_static|admin|uploads|.*\\..*).*)"],
};
