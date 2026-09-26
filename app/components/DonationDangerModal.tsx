"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales, type Locale } from "@/lib/i18n/config";

// Occasional, low-pressure support nudge:
// - waits before showing (lets the user explore first)
// - only shows when there is a hint of engagement (scroll or 2nd page view)
// - snoozes for 14 days after ANY dismissal ("Maybe later", ×, ESC, overlay click)
// - never shows on admin pages or on the /support page itself
const SNOOZE_KEY = "frost_support_modal_snoozed_v2";
const PAGEVIEWS_KEY = "frost_support_modal_pageviews_v2";
const SNOOZE_DAYS = 14;
const SHOW_DELAY_MS = 30000;
const SHOW_FALLBACK_MS = 90000;

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

function detectLocaleSafe(): Locale {
  if (typeof window === "undefined") return "en";
  return detectLocale();
}

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const elapsed = Date.now() - parseInt(raw, 10);
    return elapsed < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {}
}

function shouldSkipRoute(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  // never nudge on the support page itself (any locale)
  const segments = pathname.split("/").filter(Boolean);
  if (segments[segments.length - 1] === "support") return true;
  return false;
}

export default function DonationDangerModal() {
  const [visible, setVisible] = useState(false);
  // Lazy init keeps SSR and first client render identical (both render null
  // until `visible` flips), so no hydration mismatch and no setState-in-effect.
  const [locale] = useState<Locale>(detectLocaleSafe);

  useEffect(() => {
    try {
      const pathname = window.location.pathname;
      if (shouldSkipRoute(pathname)) return;
      if (isSnoozed()) return;

      // Track page views within this session as a light engagement signal.
      let pageViews = 1;
      try {
        pageViews = (parseInt(sessionStorage.getItem(PAGEVIEWS_KEY) || "0", 10) || 0) + 1;
        sessionStorage.setItem(PAGEVIEWS_KEY, String(pageViews));
      } catch {}

      let cancelled = false;

      const show = () => {
        if (!cancelled) setVisible(true);
      };

      if (pageViews >= 2) {
        // Returning visitor in this session — show after a calm delay.
        const timer = setTimeout(show, SHOW_DELAY_MS);
        return () => {
          cancelled = true;
          clearTimeout(timer);
        };
      }

      // First page view: wait for the delay AND a sign of engagement
      // (scroll), with an absolute fallback so it can still appear rarely.
      let delayElapsed = false;
      let engaged = false;
      const maybeShow = () => {
        if (delayElapsed && engaged) show();
      };
      const delayTimer = setTimeout(() => {
        delayElapsed = true;
        maybeShow();
      }, SHOW_DELAY_MS);
      const fallbackTimer = setTimeout(show, SHOW_FALLBACK_MS);
      const onScroll = () => {
        engaged = true;
        window.removeEventListener("scroll", onScroll);
        maybeShow();
      };
      window.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        cancelled = true;
        clearTimeout(delayTimer);
        clearTimeout(fallbackTimer);
        window.removeEventListener("scroll", onScroll);
      };
    } catch {
      return;
    }
  }, []);

  // lock scroll while visible
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const dismiss = useCallback(() => {
    snooze();
    setVisible(false);
  }, []);

  // ESC dismisses quietly — no guilt-trip confirm step.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismiss]);

  if (!visible) return null;

  const dict = getDictionary(locale);
  const t = dict.dangerModal;
  const supportHref = `/${locale}/support`;

  return (
    <div
      className="frost-danger-overlay"
      onClick={dismiss}
    >
      <div
        className="frost-danger-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frost-support-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="frost-danger-topbar" />
        <button
          type="button"
          className="frost-danger-close"
          aria-label="Close"
          onClick={dismiss}
        >
          <span aria-hidden>×</span>
        </button>

        <div className="frost-danger-iconWrap">
          <span className="frost-danger-icon">❄</span>
        </div>

        <p className="frost-danger-eyebrow">{t.eyebrow}</p>
        <h2 id="frost-support-title" className="frost-danger-title">
          {t.title}
        </h2>

        <p className="frost-danger-text">{t.description}</p>

        <p className="frost-danger-text">{t.invite}</p>

        <div className="frost-danger-secondary-actions">
          <Link
            href={supportHref}
            className="frost-danger-btn frost-danger-btn--frost"
            onClick={dismiss}
          >
            {t.supportCta} →
          </Link>
          <button
            type="button"
            className="frost-danger-btn frost-danger-btn--ghost"
            onClick={dismiss}
          >
            {t.laterCta}
          </button>
        </div>

        <p className="frost-danger-freenote">{t.freeNote}</p>
        <p className="frost-danger-hint">{t.thanks}</p>
      </div>
    </div>
  );
}
