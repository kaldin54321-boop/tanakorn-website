import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/3gpp", "video/x-matroska", "video/webm", "video/quicktime"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 32 * 1024 * 1024;

/**
 * Public attachment upload for the Android app's forums (the app has no
 * login, so this route is intentionally unauthenticated; the
 * `forum-attachments` bucket policy only allows this one bucket).
 *   POST /api/forums/attachments  (multipart field "file")
 *   -> { "url": "https://.../forum-attachments/forums/..." }
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded. Use field 'file'." }, { status: 400 });
    }

    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}.` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large: max ${isImage ? "10 MB for images" : "32 MB for videos"}.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "file";
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext).slice(0, 40) || "file";
    const key = `forums/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("forum-attachments")
      .upload(key, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("forum-attachments").getPublicUrl(key);
    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error("POST /api/forums/attachments failed:", error);
    return NextResponse.json({ error: "Unable to upload attachment." }, { status: 500 });
  }
}
