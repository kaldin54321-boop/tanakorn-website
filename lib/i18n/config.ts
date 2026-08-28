export const locales = ["en","de","fr","it","es","ru","tr","ko","ja","zh","vi","th","id","pt","ar"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  ru: "Русский",
  tr: "Türkçe",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Indonesia",
  pt: "Português",
  ar: "العربية",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  ru: "🇷🇺",
  tr: "🇹🇷",
  ko: "🇰🇷",
  ja: "🇯🇵",
  zh: "🇨🇳",
  vi: "🇻🇳",
  th: "🇹🇭",
  id: "🇮🇩",
  pt: "🇵🇹",
  ar: "🇸🇦",
};

// Map browser language codes to our locales
export const languageToLocale: Record<string, Locale> = {
  en: "en",
  "en-US": "en", "en-GB": "en",
  de: "de", "de-DE": "de", "de-AT": "de", "de-CH": "de",
  fr: "fr", "fr-FR": "fr", "fr-CA": "fr",
  it: "it", "it-IT": "it",
  es: "es", "es-ES": "es", "es-MX": "es",
  ru: "ru", "ru-RU": "ru",
  tr: "tr", "tr-TR": "tr",
  ko: "ko", "ko-KR": "ko",
  ja: "ja", "ja-JP": "ja",
  zh: "zh", "zh-CN": "zh", "zh-SG": "zh", "zh-Hans": "zh", "zh-Hant": "zh", "zh-TW": "zh", "zh-HK": "zh",
  vi: "vi", "vi-VN": "vi",
  th: "th", "th-TH": "th",
  id: "id", "id-ID": "id",
  pt: "pt", "pt-BR": "pt", "pt-PT": "pt",
  ar: "ar", "ar-SA": "ar", "ar-EG": "ar",
};

export function getLocaleFromLanguage(lang: string): Locale | null {
  if (!lang) return null;
  if (languageToLocale[lang]) return languageToLocale[lang];
  const short = lang.split("-")[0].toLowerCase();
  if ((locales as readonly string[]).includes(short)) return short as Locale;
  if (languageToLocale[short]) return languageToLocale[short];
  return null;
}

export function getPreferredLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const langs = acceptLanguage.split(",").map(s => {
    const [lang, qStr] = s.trim().split(";q=");
    const q = qStr ? parseFloat(qStr) : 1.0;
    return { lang: lang.trim(), q };
  }).sort((a,b) => b.q - a.q);
  for (const { lang } of langs) {
    const loc = getLocaleFromLanguage(lang);
    if (loc) return loc;
  }
  return defaultLocale;
}
