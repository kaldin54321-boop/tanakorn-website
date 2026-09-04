"use client";

import { useEffect, useState, useCallback } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales, type Locale } from "@/lib/i18n/config";

const STORAGE_KEY = "frost_danger_popup_seen_v1";

function detectLocale(): Locale {
  try {
    // 1) path prefix like /de, /fr etc.
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    if (seg && (locales as readonly string[]).includes(seg)) return seg as Locale;
    // 2) html lang
    const htmlLang = document.documentElement.lang?.split("-")[0];
    if (htmlLang && (locales as readonly string[]).includes(htmlLang)) return htmlLang as Locale;
    // 3) cookie
    const match = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
    const cookieLoc = match?.[1];
    if (cookieLoc && (locales as readonly string[]).includes(cookieLoc)) return cookieLoc as Locale;
  } catch {}
  return "en";
}

export default function DonationDangerModal() {
  const [showPrimary, setShowPrimary] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setMounted(true);
    const loc = detectLocale();
    setLocale(loc);
    try {
      if (window.location.pathname.startsWith("/admin")) return;
      const seen = sessionStorage.getItem(STORAGE_KEY);
      if (seen) return;
      const timer = setTimeout(() => setShowPrimary(true), 700);
      return () => clearTimeout(timer);
    } catch {
      const timer = setTimeout(() => setShowPrimary(true), 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // lock scroll when any popup visible
  useEffect(() => {
    if (!mounted) return;
    const isOpen = showPrimary || showSecondary;
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showPrimary, showSecondary, mounted]);

  // ESC behavior: primary ESC opens secondary, secondary ESC closes secondary only
  useEffect(() => {
    if (!showPrimary && !showSecondary) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (showSecondary) {
        setShowSecondary(false);
      } else if (showPrimary) {
        setShowSecondary(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPrimary, showSecondary]);

  const markSeenAndCloseAll = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShowSecondary(false);
    setShowPrimary(false);
  }, []);

  const handlePrimaryCloseClick = useCallback(() => {
    setShowSecondary(true);
  }, []);

  const handleProceedToDonate = useCallback(() => {
    setShowSecondary(false);
  }, []);

  if (!mounted || (!showPrimary && !showSecondary)) return null;

  const dict = getDictionary(locale);
  const t = dict.dangerModal;

  const DONATION_LINKS = [
    { href: "https://ko-fi.com/haikalmanheem", label: "Ko-fi", className: "kofi" },
    { href: "https://buymeacoffee.com/haikalmanheem", label: "Buy Me a Coffee", className: "bmc" },
    { href: "https://paypal.me/MUHAMMADINISMAIL", label: "PayPal", className: "paypal" },
  ] as const;

  return (
    <>
      {/* Primary popup */}
      {showPrimary && (
        <div
          className="frost-danger-overlay"
          aria-hidden={showSecondary ? "true" : undefined}
        >
          <div
            className="frost-danger-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="frost-danger-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="frost-danger-topbar" />
            <button
              type="button"
              className="frost-danger-close"
              aria-label="Close"
              onClick={handlePrimaryCloseClick}
            >
              <span aria-hidden>×</span>
            </button>

            <div className="frost-danger-iconWrap">
              <span className="frost-danger-icon">⚠</span>
            </div>

            <p className="frost-danger-eyebrow">{t.eyebrow}</p>
            <h2 id="frost-danger-title" className="frost-danger-title">
              {t.title} <span>{t.titleAccent}</span>
            </h2>

            <p className="frost-danger-text">{t.text}</p>

            <div className="support-buttons frost-danger-actions">
              {DONATION_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`support-button ${link.className}`}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <p className="frost-danger-hint">{t.hint}</p>
          </div>
        </div>
      )}

      {/* Secondary confirm popup - on top of primary */}
      {showSecondary && (
        <div className="frost-danger-overlay frost-danger-overlay--secondary">
          <div
            className="frost-danger-dialog frost-danger-dialog--secondary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="frost-danger-secondary-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="frost-danger-topbar frost-danger-topbar--amber" />
            <div className="frost-danger-iconWrap frost-danger-iconWrap--amber">
              <span className="frost-danger-icon">⏻</span>
            </div>

            <p className="frost-danger-eyebrow frost-danger-eyebrow--amber">{t.secondaryEyebrow}</p>
            <h2 id="frost-danger-secondary-title" className="frost-danger-title frost-danger-title--secondary">
              {t.secondaryTitle}
            </h2>

            <p className="frost-danger-text frost-danger-text--secondary">{t.secondaryText}</p>

            <div className="frost-danger-secondary-actions">
              <button type="button" className="frost-danger-btn frost-danger-btn--ghost" onClick={markSeenAndCloseAll}>
                {t.ok}
              </button>
              <button type="button" className="frost-danger-btn frost-danger-btn--frost" onClick={handleProceedToDonate}>
                {t.proceed}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
