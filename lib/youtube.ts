import { unstable_cache } from "next/cache";

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HMgamingstudioTH";

const YOUTUBE_CHANNEL_VIDEOS_URL = `${YOUTUBE_CHANNEL_URL}/videos`;
const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// The channel_id feed returns 404 for this brand account, but the uploads
// playlist feed (UU + channel id without the UC prefix) serves all uploads.
const YOUTUBE_UPLOADS_PLAYLIST_ID = "UUIQa0dliPS9mcBWHjMINifQ";

const FROST_VIDEO_TITLE = /winlator@frost/i;
const MAX_FEATURED_VIDEOS = 6;
const MAX_LISTING_PAGES = 30;

export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
  published_at: string;
};

type RawYoutubeVideo = {
  id: string;
  title: string;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseFeed(xml: string): YoutubeVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return entries.flatMap((entry) => {
    const id = entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/)?.[1];
    const rawTitle =
      entry.match(/<media:title>([\s\S]*?)<\/media:title>/)?.[1] ??
      entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];

    if (!id || !rawTitle) return [];

    const title = decodeXml(rawTitle).trim();
    const thumbnail =
      entry.match(/<media:thumbnail url="([^"]*)"/)?.[1] ??
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const published =
      entry.match(/<published>([^<]*)<\/published>/)?.[1] ?? "";

    return [
      {
        id,
        title,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail_url: decodeXml(thumbnail),
        published_at: published,
      },
    ];
  });
}

export async function getPublicYoutubeVideos(): Promise<YoutubeVideo[]> {
  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${YOUTUBE_UPLOADS_PLAYLIST_ID}`,
      {
        next: { revalidate: 600 },
        headers: { Accept: "application/atom+xml,application/xml" },
      }
    );

    if (!response.ok) {
      throw new Error(`YouTube feed returned ${response.status}`);
    }

    return parseFeed(await response.text())
      .filter((video) => FROST_VIDEO_TITLE.test(video.title))
      .slice(0, MAX_FEATURED_VIDEOS);
  } catch (error) {
    console.error("Failed to load YouTube videos:", error);
    return [];
  }
}

function extractJsonObject(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = html.indexOf("{", markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index++) {
    const char = html[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(html.slice(start, index + 1));
      }
    }
  }

  return null;
}

function findFirst(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, key);
      if (found !== null && found !== undefined) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;
  if (key in value) return value[key];

  for (const child of Object.values(value)) {
    const found = findFirst(child, key);
    if (found !== null && found !== undefined) return found;
  }

  return null;
}

function collectListingItems(
  node: unknown,
  videos: RawYoutubeVideo[],
  tokens: string[]
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectListingItems(item, videos, tokens);
    return;
  }

  if (!isRecord(node)) return;

  const lockup = node.lockupViewModel;
  if (isRecord(lockup)) {
    const id = lockup.contentId;
    const metadata = isRecord(lockup.metadata)
      ? lockup.metadata.lockupMetadataViewModel
      : null;
    const title = isRecord(metadata) && isRecord(metadata.title)
      ? metadata.title.content
      : null;

    if (typeof id === "string" && typeof title === "string") {
      videos.push({ id, title });
    }
  }

  const renderer = node.videoRenderer;
  if (isRecord(renderer)) {
    const id = renderer.videoId;
    const titleNode = renderer.title;
    let title: string | null = null;

    if (isRecord(titleNode)) {
      if (typeof titleNode.simpleText === "string") {
        title = titleNode.simpleText;
      } else if (Array.isArray(titleNode.runs)) {
        title = titleNode.runs
          .map((run) =>
            isRecord(run) && typeof run.text === "string" ? run.text : ""
          )
          .join("");
      }
    }

    if (typeof id === "string" && title) {
      videos.push({ id, title });
    }
  }

  const continuation = node.continuationItemRenderer;
  if (isRecord(continuation)) {
    const endpoint = continuation.continuationEndpoint;
    const command = isRecord(endpoint)
      ? endpoint.continuationCommand
      : null;
    const token = isRecord(command) ? command.token : null;

    if (typeof token === "string") tokens.push(token);
  }

  for (const child of Object.values(node)) {
    collectListingItems(child, videos, tokens);
  }
}

function getContinuationItems(payload: unknown): unknown[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.onResponseReceivedActions)) {
    return null;
  }

  for (const action of payload.onResponseReceivedActions) {
    if (!isRecord(action)) continue;
    const continuationAction = action.appendContinuationItemsAction;
    if (!isRecord(continuationAction)) continue;
    const items = continuationAction.continuationItems;
    if (Array.isArray(items)) return items;
  }

  return null;
}

async function fetchChannelVideosPage(): Promise<string> {
  const response = await fetch(YOUTUBE_CHANNEL_VIDEOS_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": YOUTUBE_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`YouTube channel page returned ${response.status}`);
  }

  return response.text();
}

async function fetchContinuation(
  token: string,
  apiKey: string,
  clientVersion: string
): Promise<unknown> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": YOUTUBE_USER_AGENT,
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": clientVersion,
        Origin: "https://www.youtube.com",
        Referer: YOUTUBE_CHANNEL_VIDEOS_URL,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion,
            hl: "en",
            gl: "US",
          },
        },
        continuation: token,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube continuation returned ${response.status}`);
  }

  return response.json();
}

async function scrapeAllFrostVideos(): Promise<YoutubeVideo[]> {
  const html = await fetchChannelVideosPage();
  const initialData = extractJsonObject(html, "var ytInitialData = ");
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientVersion = html.match(
    /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/
  )?.[1];

  if (!initialData || !apiKey || !clientVersion) {
    throw new Error("Unable to read the YouTube channel listing");
  }

  const grid = findFirst(initialData, "richGridRenderer");
  if (!isRecord(grid) || !Array.isArray(grid.contents)) {
    throw new Error("YouTube channel listing is empty");
  }

  const videos: RawYoutubeVideo[] = [];
  const tokens: string[] = [];
  collectListingItems(grid.contents, videos, tokens);

  let nextToken = tokens[0];
  let page = 0;

  while (nextToken && page < MAX_LISTING_PAGES) {
    page++;

    try {
      const payload = await fetchContinuation(
        nextToken,
        apiKey,
        clientVersion
      );
      const items = getContinuationItems(payload);
      if (!items) break;

      const pageVideos: RawYoutubeVideo[] = [];
      const pageTokens: string[] = [];
      collectListingItems(items, pageVideos, pageTokens);

      if (pageVideos.length === 0) break;

      videos.push(...pageVideos);
      nextToken = pageTokens[0];
    } catch (error) {
      console.error("Failed to load a YouTube listing page:", error);
      break;
    }
  }

  const seen = new Set<string>();

  return videos
    .filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return FROST_VIDEO_TITLE.test(video.title);
    })
    .map((video) => ({
      id: video.id,
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail_url: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      published_at: "",
    }));
}

const getCachedAllFrostVideos = unstable_cache(
  scrapeAllFrostVideos,
  ["youtube-all-frost-videos"],
  { revalidate: 3600 }
);

export async function getAllFrostVideos(): Promise<YoutubeVideo[]> {
  try {
    return await getCachedAllFrostVideos();
  } catch (error) {
    console.error("Failed to load all YouTube videos:", error);
    return [];
  }
}
