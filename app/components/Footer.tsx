import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Props = { locale?: string; dict?: ReturnType<typeof getDictionary> };

export default function Footer({ locale = "en", dict }: Props) {
  const d = dict || getDictionary(locale);
  const loc = (locale || "en") as Locale;
  return (
    <footer className="footer">

      <div className="footer-inner">

        <div className="footer-brand">

          <Link href={`/${loc}`} className="brand">
            <span className="brand-icon">❄</span>
            WINLATOR<span className="brand-frost">@FROST</span>
          </Link>

          <p>
            {d.footer.customizedDesc}
          </p>

          <div className="footer-social">
            <a
              href="https://discord.gg/Q74CNHJnq2"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="footer-social-link"
            >
              {/* Discord */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037 13.6 13.6 0 00-.588 1.207 18.24 18.24 0 00-5.53 0 12.3 12.3 0 00-.594-1.207.07.07 0 00-.079-.037A19.79 19.79 0 003.681 4.37a.064.064 0 00-.028.02A20.26 20.26 0 00.529 13.91a.069.069 0 00.026.033 19.86 19.86 0 005.993 3.025.07.07 0 00.084-.027 13.8 13.8 0 001.18-1.913.07.07 0 00-.038-.094 12.7 12.7 0 01-1.81-.864.07.07 0 01-.007-.119l.136-.102a.07.07 0 01.07-.01c3.808 1.756 7.93 1.756 11.7 0a.07.07 0 01.071.01l.136.102a.07.07 0 01-.006.119 12.7 12.7 0 01-1.81.864.07.07 0 00-.039.094 13.5 13.5 0 001.183 1.913.07.07 0 00.084.027 19.86 19.86 0 005.994-3.025.07.07 0 00.026-.033A20.26 20.26 0 0020.345 4.39a.06.06 0 00-.028-.02zM8.58 15.33c-1.182 0-2.16-1.08-2.16-2.41s.955-2.41 2.16-2.41c1.21 0 2.185 1.09 2.16 2.41s-.955 2.41-2.16 2.41zm7.04 0c-1.183 0-2.16-1.08-2.16-2.41s.955-2.41 2.16-2.41c1.21 0 2.185 1.09 2.16 2.41s-.955 2.41-2.16 2.41z"/></svg>
            </a>
            <a
              href="https://youtube.com/@techtanakornofficialth?si=HMZ9D01OJvqrR8rW"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="footer-social-link"
            >
              {/* YouTube */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.02 3.02 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.02 3.02 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.02 3.02 0 002.122 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.02 3.02 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>

        </div>


        <div className="footer-links">

          <div>
            <h4>{d.footer.project}</h4>
            <Link href={`/${loc}/news`}>{d.footer.news}</Link>
            <Link href={`/${loc}/downloads`}>{d.footer.downloads}</Link>
          </div>

          <div>
            <h4>{d.footer.resources}</h4>
            <Link href={`/${loc}/news`}>{d.footer.updates}</Link>
            <Link href={`/${loc}/downloads`}>{d.footer.releases}</Link>
          </div>

        </div>

      </div>

      <div className="footer-bottom footer-bottom-col">
        <span>{d.footer.copyright}</span>
        <span>{d.footer.thaiCompany}</span>
        <span>{d.footer.allRights}</span>
        <span className="footer-built">{d.footer.builtWith}</span>
      </div>

    </footer>
  );
}
