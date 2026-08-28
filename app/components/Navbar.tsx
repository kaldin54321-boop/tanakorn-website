"use client";

import Link from "next/link";
import { useState } from "react";
import LanguageSelector from "./LanguageSelector";
import { locales, localeNames, localeFlagCodes, flagUrl, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { useRouter, usePathname } from "next/navigation";

type Props = {
  locale?: string;
  dict?: ReturnType<typeof getDictionary>;
};

export default function Navbar({ locale = "en", dict }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const d = dict || getDictionary(locale);
  const loc = locale as Locale;
  const homeHref = `/${loc}`;
  const newsHref = `/${loc}/news`;
  const downloadsHref = `/${loc}/downloads`;
  function switchLocaleMobile(newLocale: string) {
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) segments[1] = newLocale;
    else segments.splice(1, 0, newLocale);
    const newPath = segments.join("/") || `/${newLocale}`;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    setOpen(false);
    router.push(newPath);
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href={homeHref} className="brand">
          <span className="brand-icon">❄</span>
          <span>WINLATOR<span className="brand-frost">@FROST</span></span>
        </Link>

        <nav className={`nav-links ${open ? "nav-links-open" : ""}`}>
          <Link href={homeHref} onClick={() => setOpen(false)}>{d.nav.home}</Link>
          <Link href={newsHref} onClick={() => setOpen(false)}>{d.nav.news}</Link>
          <Link href={downloadsHref} onClick={() => setOpen(false)}>{d.nav.downloads}</Link>
        </nav>

        <div className="nav-right">
          <LanguageSelector locale={loc} />
          <Link href={downloadsHref} className="nav-download">
            {d.nav.download}
          </Link>
          <button
            className="nav-hamburger"
            aria-label={d.nav.toggleMenu}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile-panel">
          <Link href={homeHref} onClick={() => setOpen(false)}>{d.nav.home}</Link>
          <Link href={newsHref} onClick={() => setOpen(false)}>{d.nav.news}</Link>
          <Link href={downloadsHref} onClick={() => setOpen(false)}>{d.nav.downloads}</Link>
          <Link href={downloadsHref} onClick={() => setOpen(false)} className="button-primary" style={{ marginTop: "8px", textAlign: "center" }}>{d.nav.download}</Link>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "var(--muted)" }}>{d.language.select.toUpperCase()}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <img src={flagUrl(loc as Locale, 40)} alt={loc} width={18} height={13} style={{ width: 18, height: 13, borderRadius: 2, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} /> {loc.toUpperCase()}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => switchLocaleMobile(l)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 10px", borderRadius: 9,
                    border: l === loc ? "1px solid rgba(141,220,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
                    background: l === loc ? "rgba(141,220,255,0.09)" : "rgba(255,255,255,0.03)",
                    color: l === loc ? "var(--frost)" : "var(--foreground)",
                    fontSize: 13, fontWeight: l === loc ? 700 : 500,
                    cursor: "pointer", textAlign: "left", width: "100%", minWidth: 0
                  }}
                >
                  <img src={flagUrl(l as Locale, 40)} alt={l} width={20} height={15} style={{ width: 20, height: 15, objectFit: "cover", borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} loading="lazy" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{localeNames[l as Locale]}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, flexShrink: 0 }}>{l.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
