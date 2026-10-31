import { locales, type Locale } from "./config";

export function localePathFor(pathname: string, locale: string): string {
  const segments = pathname.split("/").filter(Boolean);

  if (locales.includes(segments[0] as Locale)) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }

  return `/${segments.join("/")}`;
}

export function switchLocale(pathname: string, locale: string): void {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.assign(localePathFor(pathname, locale));
}
