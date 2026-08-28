"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { locales, localeNames, localeFlagCodes, flagUrl, type Locale } from "@/lib/i18n/config";

export default function LanguageSelector({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function switchLocale(newLocale: string) {
    setOpen(false);
    // Replace first segment (/en, /th, etc) with new locale
    const segments = pathname.split("/");
    // pathname is like /en/news or /en -> ["", "en", "news"]
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join("/") || `/${newLocale}`;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.push(newPath);
  }

  const currentCode = localeFlagCodes[locale as Locale] || "us";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Language"
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 9,
          background: "rgba(255,255,255,0.04)", color: "var(--foreground)", fontSize: 13, cursor: "pointer"
        }}
      >
        <img src={flagUrl(locale as Locale, 40)} alt={locale} width={20} height={15} style={{ width: 20, height: 15, objectFit: "cover", borderRadius: 2, border: "1px solid rgba(255,255,255,0.1)" }} loading="lazy" />
        <span style={{ fontWeight: 700 }}>{locale.toUpperCase()}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 8,
          background: "#0a0e13", border: "1px solid var(--border)", borderRadius: 12,
          padding: 6, minWidth: 210, maxHeight: 340, overflowY: "auto",
          display: "grid", gap: 4, zIndex: 200,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
        }}>
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 8, border: loc===locale?"1px solid rgba(141,220,255,0.3)":"1px solid transparent",
                background: loc===locale?"rgba(141,220,255,0.08)":"transparent",
                color: loc===locale?"var(--frost)":"var(--muted)",
                fontSize: 13, cursor: "pointer", textAlign: "left", width: "100%"
              }}
            >
              <img src={flagUrl(loc as Locale, 40)} alt={loc} width={20} height={15} style={{ width: 20, height: 15, objectFit: "cover", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} loading="lazy" />
              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{localeNames[loc]}</span>
              <span style={{ marginLeft:"auto", fontSize: 11, opacity: 0.6 }}>{loc.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
