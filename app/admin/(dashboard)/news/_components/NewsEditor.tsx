"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageCropDialog from "./ImageCropDialog";

type ParagraphBlock = {
  id: string;
  text: string;
  imageUrl: string | null;
  imageAlt?: string;
};

type CropRequest = {
  file: File;
  target: { kind: "cover" } | { kind: "paragraph"; blockId: string };
};

const ALLOWED_ARTICLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_ARTICLE_IMAGE_BYTES = 10 * 1024 * 1024;

type Props = {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    title: string;
    slug: string;
    category: string;
    excerpt: string;
    content: string;
    image_url: string | null;
    published: boolean;
  };
  action: (formData: FormData) => Promise<void>;
};

function parseContentToBlocks(content: string): ParagraphBlock[] {
  if (!content || !content.trim()) return [{ id: Math.random().toString(36).slice(2), text: "", imageUrl: null }];
  // Try to parse as JSON array of blocks (new format)
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && "text" in parsed[0]) {
      return parsed.map((b: Partial<ParagraphBlock> & { image?: string | null }) => ({
        id: b.id || Math.random().toString(36).slice(2),
        text: String(b.text ?? ""),
        imageUrl: b.imageUrl || b.image || null,
        imageAlt: b.imageAlt || "",
      }));
    }
  } catch {}
  // Fallback: split plain text by double newlines or single newlines into paragraphs
  const parts = content.split(/\n\s*\n/).flatMap((p) => p.split("\n")).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [{ id: Math.random().toString(36).slice(2), text: content, imageUrl: null }];
  return parts.map((text) => ({ id: Math.random().toString(36).slice(2), text, imageUrl: null }));
}

function blocksToContentString(blocks: ParagraphBlock[]): string {
  // Store as JSON string for structured content with images
  // If no images and single paragraph, keep backward compatibility as plain text? But we store JSON for new
  return JSON.stringify(blocks);
}

function validateArticleImage(file: File): string {
  if (!ALLOWED_ARTICLE_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG, WebP, GIF, or AVIF image.";
  }
  if (file.size === 0) return "The selected image is empty.";
  if (file.size > MAX_ARTICLE_IMAGE_BYTES) return "Image too large: max 10 MB.";
  return "";
}

export default function NewsEditor({ mode, initialData, action }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? "");
  const [published, setPublished] = useState(String(initialData?.published ?? false));
  const [coverUrl, setCoverUrl] = useState<string>(initialData?.image_url ?? "");
  const [coverPreview, setCoverPreview] = useState<string>(initialData?.image_url ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadingBlocks, setUploadingBlocks] = useState<Set<string>>(() => new Set());
  const [cropRequest, setCropRequest] = useState<CropRequest | null>(null);
  const [blocks, setBlocks] = useState<ParagraphBlock[]>(() => parseContentToBlocks(initialData?.content ?? ""));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-generate slug from title if empty (create mode)
  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (mode === "create" && !slug) {
      const s = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      setSlug(s);
    }
  };

  const uploadCoverFile = async (file: File) => {
    setCoverUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/news/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Cover upload failed");
      setCoverUrl(data.url);
      setCoverPreview(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateArticleImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setCropRequest({ file, target: { kind: "cover" } });
  };

  const uploadParagraphImage = async (blockId: string, file: File) => {
    const previousImageUrl = blocks.find((block) => block.id === blockId)?.imageUrl ?? null;
    const localPreview = URL.createObjectURL(file);
    setError("");
    setUploadingBlocks((prev) => new Set(prev).add(blockId));
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, imageUrl: localPreview, imageAlt: b.imageAlt || "" } : b)));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/news/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Image upload failed");
      setBlocks((prev) => prev.map((b) => (b.id === blockId && b.imageUrl === localPreview ? { ...b, imageUrl: data.url } : b)));
    } catch (err) {
      setBlocks((prev) => prev.map((b) => (b.id === blockId && b.imageUrl === localPreview ? { ...b, imageUrl: previousImageUrl } : b)));
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploadingBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }
  };

  const handleParagraphFile = (blockId: string, file: File | null) => {
    if (!file) return;
    const validationError = validateArticleImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setCropRequest({ file, target: { kind: "paragraph", blockId } });
  };

  const handleCropConfirm = (file: File) => {
    const request = cropRequest;
    setCropRequest(null);
    if (!request) return;
    if (request.target.kind === "cover") {
      void uploadCoverFile(file);
    } else {
      void uploadParagraphImage(request.target.blockId, file);
    }
  };

  const addParagraph = () => {
    setBlocks((prev) => [...prev, { id: Math.random().toString(36).slice(2), text: "", imageUrl: null }]);
  };

  const removeParagraph = (id: string) => {
    if (blocks.length <= 1) {
      setBlocks([{ id, text: "", imageUrl: null }]);
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateParagraphText = (id: string, text: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  };

  const removeParagraphImage = (id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, imageUrl: null } : b)));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cropRequest) {
      setError("Finish or cancel the image crop before saving.");
      return;
    }
    if (coverUploading || uploadingBlocks.size > 0) {
      setError("Please wait for all image uploads to finish before saving.");
      return;
    }
    if (coverUrl.startsWith("blob:") || blocks.some((block) => block.imageUrl?.startsWith("blob:"))) {
      setError("An image upload failed or is still in progress. Reattach the image before saving.");
      return;
    }
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    if (initialData?.id) {
      formData.set("id", initialData.id);
      formData.set("old_slug", initialData.slug);
    }
    formData.set("title", title);
    formData.set("slug", slug);
    formData.set("category", category);
    formData.set("excerpt", excerpt);
    // Content as JSON string of blocks
    const contentStr = blocksToContentString(blocks);
    formData.set("content", contentStr);
    formData.set("image_url", coverUrl);
    formData.set("published", published);

    try {
      await action(formData);
      // action does redirect, but if it returns, refresh
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="admin-form">
      <section className="admin-form-section">
        <h2>Article Information</h2>
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Enter article title" required />
          </label>
          <label>
            <span>Slug</span>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="example-news-article" required />
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="" disabled>Select category</option>
              <option value="News">News</option>
              <option value="Release">Release</option>
              <option value="Announcement">Announcement</option>
              <option value="Development">Development</option>
              <option value="Update">Update</option>
            </select>
          </label>
          <label>
            <span>Publication Status</span>
            <select value={published} onChange={(e) => setPublished(e.target.value)}>
              <option value="false">Draft</option>
              <option value="true">Published</option>
            </select>
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <h2>Article Summary</h2>
        <label>
          <span>Excerpt</span>
          <textarea rows={4} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Write a short summary of this article..." />
        </label>
      </section>

      <section className="admin-form-section">
        <h2>Cover Image (optional)</h2>
        <p className="admin-page-description" style={{ marginBottom: 12 }}>
          Optional cover image shown on news listing and homepage. Upload from device storage, adjust the crop, or paste a URL below. Any aspect ratio is supported, max 10 MB.
        </p>
        {coverPreview && (
          <div style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", maxWidth: 480 }}>
            <img src={coverPreview} alt="Cover preview" style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label className="button-secondary" style={{ cursor: "pointer", margin: 0 }}>
            {coverUploading ? "Uploading..." : coverPreview ? "Change cover image" : "Upload cover image"}
            <input type="file" accept={ALLOWED_ARTICLE_IMAGE_TYPES.join(",")} onChange={handleCoverFile} style={{ display: "none" }} disabled={coverUploading || !!cropRequest} />
          </label>
          {coverPreview && (
            <button type="button" className="button-secondary" onClick={() => { setCoverUrl(""); setCoverPreview(""); }} disabled={coverUploading}>
              Remove cover
            </button>
          )}
        </div>
        <label>
          <span>Or Cover Image URL (optional)</span>
          <input type="url" value={coverUrl} onChange={(e) => { setCoverUrl(e.target.value); setCoverPreview(e.target.value); }} placeholder="https://..." />
          <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>If you upload a file, URL will be filled automatically. You can also paste an external URL.</span>
        </label>
      </section>

      <section className="admin-form-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Article Content — Paragraphs with Images</h2>
          <button type="button" className="button-secondary" onClick={addParagraph} style={{ padding: "8px 12px", fontSize: 12 }}>+ Add paragraph</button>
        </div>
        <p className="admin-page-description" style={{ marginBottom: 16 }}>
          Write each paragraph separately. For any paragraph that needs a picture, click “Attach image” below that paragraph, then crop the image before uploading. Images will appear right after that paragraph on the public article page.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {blocks.map((block, idx) => (
            <div key={block.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.015)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)" }}>PARAGRAPH {idx + 1}</span>
                <button type="button" onClick={() => removeParagraph(block.id)} style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Remove paragraph
                </button>
              </div>
              <textarea
                value={block.text}
                onChange={(e) => updateParagraphText(block.id, e.target.value)}
                rows={4}
                placeholder={`Write paragraph ${idx + 1} here...`}
                style={{ width: "100%", padding: "12px", border: "1px solid var(--border)", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "inherit", font: "inherit", resize: "vertical" }}
              />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Attached image for this paragraph (optional)</div>
                {block.imageUrl ? (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxWidth: 520, marginBottom: 8 }}>
                    <img src={block.imageUrl} alt={block.imageAlt || `Paragraph ${idx + 1} image`} style={{ width: "100%", height: "auto", display: "block" }} />
                  </div>
                ) : (
                  <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>No image attached for this paragraph</div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <label className="button-secondary" style={{ cursor: "pointer", padding: "7px 12px", fontSize: 12, margin: 0 }}>
                    {uploadingBlocks.has(block.id) ? "Uploading..." : block.imageUrl ? "Change image" : "Attach image"}
                    <input
                      type="file"
                      accept={ALLOWED_ARTICLE_IMAGE_TYPES.join(",")}
                      style={{ display: "none" }}
                      disabled={uploadingBlocks.has(block.id) || !!cropRequest}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f) handleParagraphFile(block.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {block.imageUrl && (
                    <button type="button" className="button-secondary" onClick={() => removeParagraphImage(block.id)} style={{ padding: "7px 12px", fontSize: 12 }}>
                      Remove image
                    </button>
                  )}
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>From device storage, max 10 MB, will be shown right after this paragraph.</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="admin-error" style={{ whiteSpace: "pre-line" }}>{error}</div>}

      <div className="admin-form-actions">
        <Link href="/admin/news" className="button-secondary">CANCEL</Link>
        <button type="submit" className="button-primary" disabled={submitting || coverUploading || uploadingBlocks.size > 0 || !!cropRequest}>
          {submitting ? "Saving..." : cropRequest ? "FINISH IMAGE CROP" : coverUploading || uploadingBlocks.size > 0 ? "WAITING FOR UPLOADS..." : mode === "create" ? "CREATE ARTICLE" : "SAVE CHANGES"}
        </button>
      </div>
      </form>

      {cropRequest ? (
        <ImageCropDialog
          key={`${cropRequest.target.kind}-${cropRequest.file.name}-${cropRequest.file.lastModified}`}
          file={cropRequest.file}
          title={cropRequest.target.kind === "cover" ? "Crop cover image" : "Crop paragraph image"}
          onCancel={() => setCropRequest(null)}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </>
  );
}
