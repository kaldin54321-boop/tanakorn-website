/**
 * Resolves third-party share URLs to direct download URLs where possible.
 * Supports: Google Drive, MediaFire, Dropbox, generic direct links.
 * For services like Mega.nz that require client-side decryption, returns as-is with a note.
 */

export type ResolvedExternal = {
  directUrl: string;
  fileNameHint?: string;
  provider: string;
  needsProxy: boolean;
};

function getFileNameFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
    const paramsName = u.searchParams.get("filename") || u.searchParams.get("file");
    if (paramsName) return decodeURIComponent(paramsName);
  } catch {}
  return undefined;
}

// Google Drive: https://drive.google.com/file/d/<ID>/view?usp=sharing -> direct
function resolveGoogleDrive(url: string): ResolvedExternal | null {
  const u = url.trim();
  // file/d/ID
  let id: string | null = null;
  const m1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m1) id = m1[1];
  if (!id) {
    const m2 = u.match(/[?&]id=([^&]+)/);
    if (u.includes("drive.google.com") && m2) id = m2[1];
  }
  if (id) {
    return {
      directUrl: `https://drive.google.com/uc?export=download&id=${id}`,
      provider: "google_drive",
      needsProxy: true,
      fileNameHint: undefined,
    };
  }
  return null;
}

// Dropbox: ?dl=0 -> ?dl=1, ?raw=1 already direct
function resolveDropbox(url: string): ResolvedExternal | null {
  if (!url.includes("dropbox.com")) return null;
  try {
    const u = new URL(url);
    if (u.searchParams.get("dl") === "0") {
      u.searchParams.set("dl", "1");
    } else if (!u.searchParams.has("dl") && !u.searchParams.has("raw")) {
      u.searchParams.set("dl", "1");
    }
    return { directUrl: u.toString(), provider: "dropbox", needsProxy: true };
  } catch {
    return null;
  }
}

// MediaFire: fetch HTML and extract direct download link (robust for Cloudflare Workers)
async function resolveMediaFire(url: string): Promise<ResolvedExternal | null> {
  if (!url.includes("mediafire.com")) return null;
  // If already direct download subdomain, return as-is
  if (url.includes("download") && url.includes("mediafire")) {
    return { directUrl: url, provider: "mediafire_direct", needsProxy: true };
  }
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.mediafire.com/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
      },
      signal: controller.signal,
      redirect: "follow",
      cf: { cacheTtl: 0, cacheEverything: false },
    } as any);
    clearTimeout(tid);
    if (!res.ok) return null;
    const html = await res.text();

    // Try multiple patterns used by MediaFire (including Cloudflare variant)
    let m = html.match(/aria-label="Download[^"]*"\s*href="(https:\/\/download[^"]+)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    m = html.match(/href="(https:\/\/download[^\"]*\.mediafire\.com[^\"]*)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    m = html.match(/class="input[^"]*"\s*href="(https:\/\/download[^"]+)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    // 4. input#downloadButton
    m = html.match(/id="downloadButton"[^>]*href="(https:\/\/[^"]+)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    // 5. any download*.mediafire.com link
    const all = [...html.matchAll(/https:\/\/download\d*\.mediafire\.com[^"'\s<>]+/gi)];
    if (all.length > 0) {
      const candidate = all.map((a) => a[0].replace(/&amp;/g, "&")).sort((a, b) => b.length - a.length)[0];
      if (candidate) return { directUrl: candidate, provider: "mediafire", needsProxy: true };
    }

    // 6. Cloudflare-specific: look for data-url or javascript redirect
    m = html.match(/data-url="(https:\/\/download[^"]+)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    m = html.match(/window\.location\s*=\s*"(https:\/\/download[^"]+)"/i);
    if (m) return { directUrl: m[1].replace(/&amp;/g, "&"), provider: "mediafire", needsProxy: true };

    // 7. Try MediaFire API via quick_key (for share links like /file/abc123/filename) - most reliable for share links, works even when HTML is blocked/JS-generated
    const qkMatch = url.match(/\/file\/([a-zA-Z0-9]+)\//);
    if (qkMatch) {
      const quickKey = qkMatch[1];
      // Try multiple API endpoints and response formats
      const apiUrls = [
        `https://www.mediafire.com/api/1.4/file/get_info.php?quick_key=${quickKey}&response_format=json`,
        `https://www.mediafire.com/api/1.5/file/get_info.php?quick_key=${quickKey}&response_format=json`,
        `https://www.mediafire.com/api/file/get_info.php?quick_key=${quickKey}`,
      ];
      for (const apiUrl of apiUrls) {
        try {
          const apiCtrl = new AbortController();
          const apiTid = setTimeout(() => apiCtrl.abort(), 10000);
          const apiRes = await fetch(apiUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "application/json, text/plain, */*" },
            signal: apiCtrl.signal,
            redirect: "follow",
          } as any);
          clearTimeout(apiTid);
          if (!apiRes.ok) continue;
          const j = await apiRes.json().catch(() => null);
          if (!j) continue;
          // Try different response structures
          const fileInfo = j?.response?.file_info || j?.response?.file_infos?.[0] || j?.file_info || j;
          const links = fileInfo?.links || j?.response?.links || fileInfo;
          const candidates = [
            links?.normal_download,
            links?.direct_download,
            links?.view,
            j?.response?.file_info?.links?.normal_download,
            j?.response?.file_info?.links?.direct_download,
            fileInfo?.normal_download,
            fileInfo?.direct_download,
          ].filter((v) => typeof v === "string" && v.includes("mediafire.com"));
          for (const cand of candidates) {
            if (cand) return { directUrl: cand, provider: "mediafire", needsProxy: true };
          }
          // Also try to find any mediafire URL in the JSON string
          const jsonStr = JSON.stringify(j);
          const mApi = jsonStr.match(/https:\/\/[^"]*mediafire\.com[^"]*/i);
          if (mApi && mApi[0].includes("download")) {
            return { directUrl: mApi[0], provider: "mediafire", needsProxy: true };
          }
        } catch {}
      }
    }

    // 8. Fallback: try to fetch via MediaFire download page with different User-Agent for Workers
    // Cloudflare Workers may be blocked with default UA, try with mobile UA
    try {
      const mobileCtrl = new AbortController();
      const mobileTid = setTimeout(() => mobileCtrl.abort(), 8000);
      const mobileRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: mobileCtrl.signal,
        redirect: "follow",
      } as any);
      clearTimeout(mobileTid);
      if (mobileRes.ok) {
        const html2 = await mobileRes.text();
        const m2 = html2.match(/href="(https:\/\/download[^"]+)"/i) || html2.match(/https:\/\/download\d*\.mediafire\.com[^"'\s<>]+/i);
        if (m2) {
          const cand = (m2[1] || m2[0]).replace(/&amp;/g, "&");
          return { directUrl: cand, provider: "mediafire", needsProxy: true };
        }
      }
    } catch {}

    return null;
  } catch {
    return null;
  }
}

// Mega.nz - cannot be proxied without API; return as-is but mark
function resolveMega(url: string): ResolvedExternal | null {
  if (url.includes("mega.nz") || url.includes("mega.co.nz")) {
    return {
      directUrl: url,
      provider: "mega",
      needsProxy: false, // client must open externally; we will error with hint
    };
  }
  return null;
}

export async function resolveExternalUrl(url: string): Promise<ResolvedExternal> {
  const trimmed = url.trim();
  // Check Google Drive first (needs URL parse, no fetch)
  const gdrive = resolveGoogleDrive(trimmed);
  if (gdrive) return gdrive;

  const dropbox = resolveDropbox(trimmed);
  if (dropbox) return dropbox;

  const mega = resolveMega(trimmed);
  if (mega) return mega;

  // MediaFire needs fetch to resolve
  if (trimmed.includes("mediafire.com")) {
    const resolved = await resolveMediaFire(trimmed);
    if (resolved) return resolved;
    // fallback to original - let caller decide error message
    return { directUrl: trimmed, provider: "mediafire_unresolved", needsProxy: true };
  }

  // Generic - check if it already looks like direct file link
  // For other services (like many file hosts), just use directly and proxy
  return {
    directUrl: trimmed,
    provider: "generic",
    needsProxy: true,
    fileNameHint: getFileNameFromUrl(trimmed),
  };
}

export function parseFileNameFromHeaders(
  contentDisposition: string | null,
  contentType: string | null,
  url: string,
  fallback: string
): string {
  if (contentDisposition) {
    // filename*=UTF-8''... or filename="..."
    const mStar = contentDisposition.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
    if (mStar) {
      try {
        return decodeURIComponent(mStar[1].trim().replace(/"/g, ""));
      } catch {}
    }
    const m = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
    if (m) return m[1].trim();
  }
  const hint = getFileNameFromUrl(url);
  if (hint) return hint;
  return fallback;
}
