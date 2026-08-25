import Link from "next/link";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">

        <Link href="/" className="brand">
          <span className="brand-icon">❄</span>
          <span>WINLATOR<span className="brand-frost">@FROST</span></span>
        </Link>

        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/news">News</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/support">Support Us</Link>
          <Link href="/about">About</Link>
        </nav>

        <Link href="/downloads" className="nav-download">
          Download
        </Link>

      </div>
    </header>
  );
}
