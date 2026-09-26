import Link from "next/link";
import ShareButtons from "@/app/components/ShareButtons";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { locales } from "@/lib/i18n/config";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const DONATION_LINKS = [
  { href: "https://ko-fi.com/haikalmanheem", label: "Ko-fi", className: "kofi" },
  { href: "https://buymeacoffee.com/haikalmanheem", label: "Buy Me a Coffee", className: "bmc" },
  { href: "https://paypal.me/MUHAMMADINISMAIL", label: "PayPal", className: "paypal" },
] as const;

const DISCORD_URL = "https://discord.gg/Q74CNHJnq2";

const TIERS = [
  "❄ Frost Supporter",
  "❤ Frost Contributor",
  "🛠 Frost Developer Supporter",
] as const;

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const t = dict.dangerModal;
  const s = dict.support;

  const whyCards = [
    { icon: "🌐", title: s.why1T, desc: s.why1D },
    { icon: "🔨", title: s.why2T, desc: s.why2D },
    { icon: "🤖", title: s.why3T, desc: s.why3D },
    { icon: "🧪", title: s.why4T, desc: s.why4D },
  ];

  const whereItems = [
    { icon: "🌐", title: s.where1T, desc: s.where1D },
    { icon: "🔨", title: s.where2T, desc: s.where2D },
    { icon: "🤖", title: s.where3T, desc: s.where3D },
    { icon: "🧪", title: s.where4T, desc: s.where4D },
    { icon: "🔧", title: s.where5T, desc: s.where5D },
  ];

  const costRows = [
    { label: s.cost1L, amount: s.cost1A },
    { label: s.cost2L, amount: s.cost2A },
    { label: s.cost3L, amount: s.cost3A },
    { label: s.cost4L, amount: s.cost4A },
  ];

  const buildGroups = [
    { icon: "🧊", title: s.build1T, items: s.build1Items },
    { icon: "🌐", title: s.build2T, items: s.build2Items },
    { icon: "🧪", title: s.build3T, items: s.build3Items },
  ];

  const methodDescs = [s.mKofiD, s.mBmcD, s.mPpD];

  const otherWays = [
    { icon: "⭐", title: s.o1T, desc: s.o1D, href: undefined, share: false },
    { icon: "🐛", title: s.o2T, desc: s.o2D, href: DISCORD_URL, share: false },
    { icon: "📖", title: s.o3T, desc: s.o3D, href: undefined, share: false },
    { icon: "📢", title: s.o4T, desc: s.o4D, href: undefined, share: true },
    { icon: "💻", title: s.o5T, desc: s.o5D, href: undefined, share: false },
    { icon: "🧪", title: s.o6T, desc: s.o6D, href: `/${locale}/downloads`, share: false },
  ];

  const faqs = [
    { q: s.f1Q, a: s.f1A },
    { q: s.f2Q, a: s.f2A },
    { q: s.f3Q, a: s.f3A },
    { q: s.f4Q, a: s.f4A },
    { q: s.f5Q, a: s.f5A },
    { q: s.f6Q, a: s.f6A },
  ];

  return (
    <main className="support-page">
      {/* 1 — Hero */}
      <section className="support-hero">
        <p className="frost-danger-eyebrow">{t.eyebrow}</p>
        <h1>{s.title} ❄</h1>
        <p className="support-tagline">{s.heroTag}</p>
        <p>{s.heroDesc}</p>
        <div className="support-hero-actions">
          <a href="#methods" className="button-primary">❤ {t.supportCta}</a>
          <a href="#roadmap" className="button-secondary">{s.viewDev}</a>
        </div>
        <p className="support-freenote">{s.alwaysFree}</p>
      </section>

      {/* Status dashboard */}
      <section className="status-panel" aria-label={s.statusTitle}>
        <p className="status-panel-title">{s.statusTitle}</p>
        <p className="status-panel-active"><span className="status-dot" aria-hidden />{s.statusActive}</p>
        <div className="status-rows">
          <div><span>{s.statusWebsite}</span><span><span className="status-dot" aria-hidden />{s.statusOperational}</span></div>
          <div><span>{s.statusBuilds}</span><span><span className="status-dot" aria-hidden />{s.statusActive}</span></div>
          <div><span>{s.statusDev}</span><span><span className="status-dot" aria-hidden />{s.statusActive}</span></div>
        </div>
      </section>

      {/* 2 — Why */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.whyTitle}</h2>
        </div>
        <p className="support-lead">{s.whyDesc}</p>
        <div className="features-grid">
          {whyCards.map((card) => (
            <div key={card.title} className="feature-card">
              <div className="feature-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — Where */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.whereTitle}</h2>
        </div>
        <div className="support-card">
          <ul className="support-costs">
            {whereItems.map((item) => (
              <li key={item.title}>
                <span aria-hidden>{item.icon}</span>
                <span><strong>{item.title}</strong><br />{item.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 — Cost tracker */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.costsTitle}</h2>
        </div>
        <p className="support-lead">{s.costsSub}</p>
        <div className="support-card">
          <div className="cost-table">
            {costRows.map((row) => (
              <div key={row.label} className="cost-row">
                <span>{row.label}</span>
                <span>{row.amount}</span>
              </div>
            ))}
            <div className="cost-row cost-row--total">
              <span>{s.costTotalL}</span>
              <span>{s.costTotalA}</span>
            </div>
          </div>
          <p className="cost-note">{s.costsNote}</p>
        </div>
      </section>

      {/* 5 — What support builds */}
      <section id="builds" className="support-section">
        <div className="section-heading">
          <h2>{s.buildTitle}</h2>
        </div>
        <div className="features-grid features-grid--3">
          {buildGroups.map((group) => (
            <div key={group.title} className="feature-card">
              <div className="feature-icon">{group.icon}</div>
              <h3>{group.title}</h3>
              <ul className="support-ticks">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — Roadmap */}
      <section id="roadmap" className="support-section">
        <div className="section-heading">
          <h2>❄ {s.roadTitle}</h2>
        </div>
        <p className="support-lead">{s.roadDesc}</p>
        <div className="sysreq-grid">
          <div className="sysreq-card">
            <h3>✓ {s.roadDoneT}</h3>
            <ul className="roadmap-list">
              {s.roadDoneItems.map((item) => (
                <li key={item}><span aria-hidden>✓</span> {item}</li>
              ))}
            </ul>
          </div>
          <div className="sysreq-card sysreq-card-recommended">
            <h3>◐ {s.roadActiveT}</h3>
            <ul className="roadmap-list">
              {s.roadActiveItems.map((item) => (
                <li key={item}><span aria-hidden>◐</span> {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="support-card" style={{ marginTop: "16px" }}>
          <h2>○ {s.roadPlanT}</h2>
          <ul className="support-ticks support-ticks--inline">
            {s.roadPlanItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7 — Donation methods */}
      <section id="methods" className="support-section">
        <div className="section-heading">
          <h2>❤ {s.methodsTitle}</h2>
        </div>
        <p className="support-lead">{s.methodsDesc}</p>
        <div className="features-grid features-grid--3">
          {DONATION_LINKS.map((link, idx) => (
            <div key={link.label} className="feature-card">
              <div className="feature-icon">{idx === 2 ? "💳" : "☕"}</div>
              <h3>{link.label}</h3>
              <p>{methodDescs[idx]}</p>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
                style={{ marginTop: "12px" }}
              >
                {s.openLink} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* 8 — Supporter wall */}
      <section className="support-section">
        <div className="section-heading">
          <h2>❤ {s.wallTitle}</h2>
        </div>
        <p className="support-lead">{s.wallDesc}</p>
        <div className="support-card support-wall">
          <p className="support-wall-empty">❄ {s.wallEmpty}</p>
          <div className="support-tiers">
            {TIERS.map((tier) => (
              <span key={tier} className="support-tier">{tier}</span>
            ))}
          </div>
          <p className="cost-note">☑ {s.wallOptin}</p>
        </div>
      </section>

      {/* 9 — Other ways */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.otherTitle}</h2>
        </div>
        <p className="support-lead">{s.otherDesc}</p>
        <div className="features-grid features-grid--3">
          {otherWays.map((item) => (
            <div key={item.title} className="feature-card">
              <div className="feature-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              {item.share ? (
                <ShareButtons
                  url="https://tanakorn-website.onrender.com"
                  title={s.title}
                  text={s.heroTag}
                />
              ) : (
                item.href && (
                  <a
                    href={item.href}
                    {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="text-link"
                    style={{ display: "inline-block", marginTop: "10px" }}
                  >
                    {s.openLink} →
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 10 — Transparency */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.transTitle}</h2>
        </div>
        <div className="support-card">
          <p className="transparency-text">{s.transP1}</p>
          <p className="transparency-text"><strong>{s.transP2}</strong></p>
        </div>
      </section>

      {/* 11 — FAQ */}
      <section className="support-section">
        <div className="section-heading">
          <h2>{s.faqTitle}</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((faq) => (
            <details key={faq.q} className="faq-card">
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 12 — Final CTA */}
      <section className="cta-section" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div className="cta-card">
          <h2>{s.finalTitle}</h2>
          <p>{s.finalDesc}</p>
          <p className="cta-subtitle">{s.finalThanks}</p>
          <a href="#methods" className="button-primary">❤ {t.supportCta}</a>
          <div style={{ marginTop: "18px", display: "flex", gap: "18px", justifyContent: "center" }}>
            <Link href={`/${locale}`} className="text-link">{dict.nav.home}</Link>
            <Link href={`/${locale}/downloads`} className="text-link">{dict.nav.downloads}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
