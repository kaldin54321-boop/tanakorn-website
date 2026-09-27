import { createClient } from "@/lib/supabase/server";

// Marker path recorded in page_views for each APK download click.
// Canonical download total = releases.download_count + marker rows, so the
// same true number is served on first paint everywhere (lists, homepage,
// detail pages, API) and can never appear to "revert" after a restart.
export function downloadMarkerPath(version: string) {
  return `/__download/${version}`;
}

async function withDownloadTotals<T extends { version: string; download_count?: number | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  releases: T[]
): Promise<T[]> {
  if (!releases.length) return releases;
  try {
    const extras = await Promise.all(
      releases.map(async (r) => {
        try {
          const { count } = await supabase
            .from("page_views")
            .select("id", { count: "exact", head: true })
            .eq("path", downloadMarkerPath(r.version));
          return count ?? 0;
        } catch {
          return 0;
        }
      })
    );
    return releases.map((r, i) => ({
      ...r,
      download_count: (r.download_count ?? 0) + extras[i],
    }));
  } catch {
    return releases;
  }
}

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

  return withDownloadTotals(supabase, data ?? []);
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

  if (!data) return null;
  const [withTotal] = await withDownloadTotals(supabase, [data]);
  return withTotal;
}