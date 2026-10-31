import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-layout">

      <aside className="admin-sidebar">

        <div className="admin-logo">

          <div className="admin-logo-mark">
            F
          </div>

          <div>
            <strong>
              WINLATOR@FROST
            </strong>

            <span>
              ADMIN PANEL
            </span>
          </div>

        </div>


        <nav className="admin-nav">

          <Link href="/admin">
            <span>⌂</span>
            Dashboard
          </Link>

          <Link href="/admin/releases">
            <span>▣</span>
            Releases
          </Link>

          <Link href="/admin/news">
            <span>▤</span>
            News
          </Link>

          <Link href="/admin/files">
            <span>□</span>
            Files
          </Link>

          <Link href="/admin/settings">
            <span>⚙</span>
            Settings
          </Link>

        </nav>


        <div className="admin-sidebar-bottom">

          <Link href="/">
            ← View Website
          </Link>

        </div>

      </aside>


      <main className="admin-main">
        {children}
      </main>

    </div>
  );
}