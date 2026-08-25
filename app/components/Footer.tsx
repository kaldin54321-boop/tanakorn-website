import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">

      <div className="footer-inner">

        <div className="footer-brand">

          <Link href="/" className="brand">
            <span className="brand-icon">❄</span>
            WINLATOR<span className="brand-frost">@FROST</span>
          </Link>

          <p>
            A customized Winlator experience
            for Android.
          </p>

        </div>


        <div className="footer-links">

          <div>
            <h4>Project</h4>

            <Link href="/about">
              About
            </Link>

            <Link href="/news">
              News
            </Link>

            <Link href="/downloads">
              Downloads
            </Link>
          </div>


          <div>
            <h4>Resources</h4>

            <Link href="/docs">
              Documentation
            </Link>

            <Link href="/downloads">
              Releases
            </Link>
          </div>

        </div>

      </div>


      <div className="footer-bottom">

        <span>
          Copyright © Frost Apps & Games Software Co., Ltd. 2023-2026. All rights reserved.
        </span>

        <span>
          Built with Frost ❄
        </span>

      </div>

    </footer>
  );
}
