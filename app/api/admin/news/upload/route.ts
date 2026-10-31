import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims ?? null;
    if (claimsError || !claims) {
      return NextResponse.json({ success: false, message: "You must be logged in." }, { status: 401 });
    }
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    if (!userId) return NextResponse.json({ success: false, message: "Unable to identify user." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role").eq("id", userId).maybeSingle();
    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, message: "Administrator permission required." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const alt = String(formData.get("alt") ?? "").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file uploaded. Use field 'file'." }, { status: 400 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ success: false, message: `Invalid image type: ${file.type}. Allowed: jpeg, png, webp, gif, avif` }, { status: 400 });
    }

    if (file.size === 0) return NextResponse.json({ success: false, message: "File is empty." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, message: "File too large: max 10 MB." }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "image.jpg";
    const ext = path.extname(safeName) || ".jpg";
    const baseName = path.basename(safeName, ext).slice(0, 40) || "image";
    const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${baseName}${ext}`;
    const storagePath = `news/${key}`;

    // The public attachment bucket is a durable fallback when news-images was never provisioned.
    const buckets = ["news-images", "forum-attachments"];
    let bucket: string | null = null;
    let uploadErrorMessage = "";

    for (const candidate of buckets) {
      const { error } = await supabase.storage.from(candidate).upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });
      if (!error) {
        bucket = candidate;
        break;
      }
      uploadErrorMessage = error.message;
      console.warn(`Supabase ${candidate} upload failed:`, error.message);
    }

    if (!bucket) {
      console.error("Supabase news image upload failed:", uploadErrorMessage);
      const message = /bucket not found/i.test(uploadErrorMessage)
        ? "News image storage is not configured on the server."
        : `Image storage upload failed: ${uploadErrorMessage}`;
      return NextResponse.json({ success: false, message }, { status: 503 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return NextResponse.json({ success: true, url: publicUrlData.publicUrl, path: storagePath, fileName: safeName, size: file.size, type: file.type, alt: alt || null, host: "supabase", bucket });
  } catch (error) {
    console.error("News image upload error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
