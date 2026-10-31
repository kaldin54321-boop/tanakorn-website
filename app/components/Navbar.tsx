"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LanguageSelector from "./LanguageSelector";
import { type Locale } from "@/lib/i18n/config";
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
  const videosHref = `/${loc}/videos`;
  const downloadsHref = `/${loc}/downloads`;
  const supportHref = `/${loc}/support`;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  const mobileMenu = open
    ? createPortal(
        <>
          <div
            className="nav-mobile-backdrop"
            onClick={closeMenu}
            aria-hidden="true"
          />

          <aside
            className="nav-mobile-panel"
            role="dialog"
            aria-modal="true"
            aria-label={d.nav.toggleMenu}
          >
            <div className="nav-mobile-head">
              <Link href={homeHref} className="brand" onClick={closeMenu}>
                <span className="brand-icon">❄</span>
                <span>
                  WINLATOR<span className="brand-frost">@FROST</span>
                </span>
              </Link>

              <button
                type="button"
                className="nav-mobile-close"
                aria-label={d.nav.toggleMenu}
                onClick={closeMenu}
              >
                ×
              </button>
            </div>

            <nav className="nav-mobile-links">
              <Link href={homeHref} onClick={closeMenu}>
                {d.nav.home}
              </Link>
              <Link href={newsHref} onClick={closeMenu}>
                {d.nav.news}
              </Link>
              <Link href={videosHref} onClick={closeMenu}>
                {d.nav.videos}
              </Link>
              <Link href={downloadsHref} onClick={closeMenu}>
                {d.nav.downloads}
              </Link>
              <Link href={supportHref} onClick={closeMenu}>
                ❄ {d.nav.support}
              </Link>
              <Link
                href={downloadsHref}
                onClick={closeMenu}
                className="button-primary nav-mobile-download"
              >
                {d.nav.download}
              </Link>
            </nav>

            <div className="nav-mobile-lang">
              <LanguageSelector
                locale={loc}
                variant="drawer"
                label={d.language.select}
              />
            </div>
          </aside>
        </>,
        document.body
      )
    : null;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button
          className="nav-hamburger"
          aria-label={d.nav.toggleMenu}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        <Link href={homeHref} className="brand">
          <span className="brand-icon">❄</span>
          <span>
            WINLATOR<span className="brand-frost">@FROST</span>
          </span>
        </Link>

        <nav className="nav-links">
          <Link href={homeHref}>{d.nav.home}</Link>
          <Link href={newsHref}>{d.nav.news}</Link>
          <Link href={videosHref}>{d.nav.videos}</Link>
          <Link href={downloadsHref}>{d.nav.downloads}</Link>
          <Link href={supportHref}>❄ {d.nav.support}</Link>
        </nav>

        <div className="nav-right">
          <LanguageSelector
            locale={loc}
            variant="navbar"
            label={d.language.select}
          />
          <Link href={downloadsHref} className="nav-download">
            {d.nav.download}
          </Link>
        </div>
      </div>

      {mobileMenu}
    </header>
  );
}
