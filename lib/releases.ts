import { createClient } from "@/lib/supabase/server";

export async function getPublicReleases() {
  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("releases")
    .select(`
      id,
      version,
      name,
      status,
      architecture,
      release_date,
      description,
      wine_version,
      android_version,
      file_name,
      file_path,
      file_size,
      file_type,
      visibility,
      external_url,
      download_count,
      created_at
    `)
    .eq("visibility", "published")
    .order("release_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Failed to load public releases:",
      error.message
    );

    return [];
  }

  return data ?? [];
}

export async function getLatestPublicRelease() {
  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("releases")
    .select(`
      id,
      version,
      name,
      status,
      architecture,
      release_date,
      description,
      wine_version,
      android_version,
      file_name,
      file_path,
      file_size,
      file_type,
      visibility,
      external_url,
      download_count,
      created_at
    `)
    .eq("visibility", "published")
    .order("release_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to load latest public release:",
      error.message
    );

    return null;
  }

  return data;
}