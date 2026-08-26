import Link from "next/link";
import { getAdminYoutubeVideos } from "@/lib/youtube";
import { createYoutubeVideo, deleteYoutubeVideo } from "./actions";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const videos = await getAdminYoutubeVideos();

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">WINLATOR@FROST</p>
          <h1>YouTube Videos</h1>
          <p className="admin-page-description">Manage featured YouTube videos shown on the homepage. These replace the old screenshot showcase.</p>
        </div>
      </div>

      <section className="admin-form-section">
        <h2>Add Video</h2>
        <form action={createYoutubeVideo} className="admin-form" style={{ marginTop: "16px" }}>
          <div className="form-grid">
            <label>
              <span>YouTube URL *</span>
              <input name="youtube_url" type="url" placeholder="https://youtube.com/watch?v=..." required />
            </label>
            <label>
              <span>Title (optional)</span>
              <input name="title" type="text" placeholder="Frost gameplay showcase" />
            </label>
            <label>
              <span>Featured on Homepage</span>
              <select name="is_featured" defaultValue="true">
                <option value="true">Yes — show on homepage</option>
                <option value="false">No — hidden</option>
              </select>
            </label>
          </div>
          <div className="admin-form-actions" style={{ marginTop: "16px", justifyContent: "flex-start" }}>
            <button type="submit" className="button-primary">Add Video</button>
          </div>
          <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
            Tip: Create table <code>youtube_videos</code> in Supabase if not exists: <code>id uuid pk, youtube_url text, youtube_id text, title text, is_featured bool, created_at timestamptz</code>
          </p>
        </form>
      </section>

      <section className="release-table" style={{ marginTop: "24px" }}>
        <div className="release-table-header">
          <span>Video</span>
          <span>Featured</span>
          <span>Added</span>
          <span>Action</span>
        </div>
        {videos.length === 0 ? (
          <div className="release-table-row">
            <div className="release-name"><strong>No videos yet</strong><span>Add one above to show on homepage</span></div>
            <div>—</div><div>—</div><div>—</div>
          </div>
        ) : (
          videos.map((v) => (
            <div key={v.id} className="release-table-row">
              <div className="release-name">
                <strong>{v.title || v.youtube_id || "YouTube Video"}</strong>
                <span style={{ wordBreak: "break-all" }}>{v.youtube_url}</span>
              </div>
              <div>
                <span className={`status-badge ${v.is_featured ? "status-stable" : "status-beta"}`}>{v.is_featured ? "Featured" : "Hidden"}</span>
              </div>
              <div>{new Date(v.created_at).toLocaleDateString()}</div>
              <div className="release-actions">
                <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="button-secondary">View</a>
                <form action={deleteYoutubeVideo}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="button-danger">Delete</button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
