"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    return null;
  } catch {
    return null;
  }
}

export async function createYoutubeVideo(formData: FormData) {
  const youtube_url = String(formData.get("youtube_url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const is_featured = String(formData.get("is_featured") ?? "true") === "true";

  if (!youtube_url) throw new Error("YouTube URL is required.");

  let youtube_id: string | null = null;
  try {
    youtube_id = extractYoutubeId(youtube_url);
  } catch {}
  if (!youtube_id) throw new Error("Invalid YouTube URL.");

  const supabase = await createClient();
  const { error } = await supabase.from("youtube_videos").insert({
    youtube_url,
    youtube_id,
    title: title || null,
    is_featured,
  });

  if (error) {
    // If table missing, give helpful error
    throw new Error(`SUPABASE ERROR: ${error.message} | CODE: ${error.code}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/videos");
  revalidatePath("/admin");
  redirect("/admin/videos");
}

export async function deleteYoutubeVideo(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("ID required");
  const supabase = await createClient();
  const { error } = await supabase.from("youtube_videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/videos");
}
