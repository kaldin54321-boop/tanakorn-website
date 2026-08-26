"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">

        <Link href="/" className="brand">
          <span className="brand-icon">❄</span>
          <span>WINLATOR<span className="brand-frost">@FROST</span></span>
        </Link>

        <nav className={`nav-links ${open ? "nav-links-open" : ""}`}>
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/news" onClick={() => setOpen(false)}>News</Link>
          <Link href="/downloads" onClick={() => setOpen(false)}>Downloads</Link>
        </nav>

        <div className="nav-right">
          <Link href="/downloads" className="nav-download">
            Download
          </Link>

          <button
            className="nav-hamburger"
            aria-label="Toggle menu"
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
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/news" onClick={() => setOpen(false)}>News</Link>
          <Link href="/downloads" onClick={() => setOpen(false)}>Downloads</Link>
          <Link href="/downloads" onClick={() => setOpen(false)} className="button-primary" style={{ marginTop: "8px" }}>Download</Link>
        </div>
      )}
    </header>
  );
}
