import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function getLocalNewsUploadsRoot(): string {
  const isHF = !!process.env.SPACE_ID || fs.existsSync("/data");
  if (isHF) return path.join("/data", "uploads", "news");
  // Local/dev and Render: use public folder so Next.js serves statically
  return path.join(process.cwd(), "public", "uploads", "news");
}

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

    // Try Supabase Storage first
    try {
      const { error: uploadError } = await supabase.storage.from("news-images").upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("news-images").getPublicUrl(storagePath);
        const publicUrl = publicUrlData.publicUrl;
        return NextResponse.json({ success: true, url: publicUrl, path: storagePath, fileName: safeName, size: file.size, type: file.type, alt: alt || null, host: "supabase" });
      }
      console.warn("Supabase news-images upload failed, falling back to local:", uploadError.message);
    } catch (e) {
      console.warn("Supabase upload exception, fallback to local:", e);
    }

    // Fallback to local filesystem (self-hosted/HF)
    const uploadsRoot = getLocalNewsUploadsRoot();
    ensureDir(uploadsRoot);
    const localPath = path.join(uploadsRoot, key);
    fs.writeFileSync(localPath, buffer);
    // Return URL that can be served via Next.js static or via /uploads/news/... if configured
    // For local, we return /uploads/news/<key> which should be served from public or via API
    // Also try to make it accessible via /api/admin/news/upload fallback static
    const localUrl = `/uploads/news/${key}`;
    return NextResponse.json({ success: true, url: localUrl, path: localPath, fileName: safeName, size: file.size, type: file.type, alt: alt || null, host: "local" });
  } catch (error) {
    console.error("News image upload error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
