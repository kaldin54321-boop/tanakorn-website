import { createClient } from "@/lib/supabase/server";

export type YoutubeVideo = {
  id: string;
  title: string | null;
  youtube_url: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  is_featured: boolean;
  created_at: string;
};

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("?")[0] || null;
    }
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

export async function getPublicYoutubeVideos(): Promise<YoutubeVideo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("youtube_videos")
    .select("*")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    // Table may not exist yet — return empty gracefully
    if (error.code === "42P01") return [];
    console.error("Failed to load youtube videos:", error.message);
    return [];
  }
  return (data as YoutubeVideo[]) ?? [];
}

export async function getAdminYoutubeVideos(): Promise<YoutubeVideo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("youtube_videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];
    console.error("Failed to load admin youtube videos:", error.message);
    return [];
  }
  return (data as YoutubeVideo[]) ?? [];
}

export function getYoutubeThumbnail(video: YoutubeVideo): string {
  if (video.thumbnail_url) return video.thumbnail_url;
  if (video.youtube_id) return `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
  const id = extractYoutubeId(video.youtube_url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "";
}

export { extractYoutubeId };
