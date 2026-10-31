"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  locales,
  localeNames,
  flagUrl,
  type Locale,
} from "@/lib/i18n/config";
import { switchLocale } from "@/lib/i18n/switch-locale";

type Props = {
  locale: string;
  variant?: "navbar" | "footer" | "drawer";
  label?: string;
};

export default function LanguageSelector({
  locale,
  variant = "navbar",
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = (
    locales.includes(locale as Locale) ? locale : "en"
  ) as Locale;

  function select(nextLocale: string) {
    setOpen(false);
    if (nextLocale === current) return;
    switchLocale(pathname, nextLocale);
  }

  return (
    <div ref={ref} className={`lang-selector lang-selector--${variant}`}>
      <button
        type="button"
        className="lang-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        {variant === "drawer" && (
          <span className="lang-trigger-label">{label}</span>
        )}
        <span className="lang-trigger-value">
          <img
            src={flagUrl(current, 40)}
            alt=""
            width={20}
            height={15}
            loading="lazy"
          />
          <span className="lang-trigger-name">{localeNames[current]}</span>
          <span
            className={`lang-chevron ${open ? "is-open" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {open && (
        <div className="lang-menu" role="listbox" aria-label={label}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="option"
              aria-selected={loc === current}
              className={`lang-option ${
                loc === current ? "is-active" : ""
              }`}
              onClick={() => select(loc)}
            >
              <img
                src={flagUrl(loc, 40)}
                alt=""
                width={20}
                height={15}
                loading="lazy"
              />
              <span className="lang-option-name">{localeNames[loc]}</span>
              <span className="lang-option-code">{loc.toUpperCase()}</span>
              {loc === current && (
                <span className="lang-option-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
