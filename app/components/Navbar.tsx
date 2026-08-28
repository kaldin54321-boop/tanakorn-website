"use client";

import Link from "next/link";
import { useState } from "react";
import LanguageSelector from "./LanguageSelector";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Props = {
  locale?: string;
  dict?: ReturnType<typeof getDictionary>;
};

export default function Navbar({ locale = "en", dict }: Props) {
  const [open, setOpen] = useState(false);
  const d = dict || getDictionary(locale);
  const loc = locale as Locale;
  const homeHref = `/${loc}`;
  const newsHref = `/${loc}/news`;
  const downloadsHref = `/${loc}/downloads`;

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
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <LanguageSelector locale={loc} />
            <Link href={downloadsHref} onClick={() => setOpen(false)} className="button-primary" style={{ flex: 1, textAlign: "center" }}>{d.nav.download}</Link>
          </div>
        </div>
      )}
    </header>
  );
}
