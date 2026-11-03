import { unstable_cache } from "next/cache";

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HMgamingstudioTH";

// Public web client values used by youtube.com itself for the browse API.
const YOUTUBE_BROWSE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const YOUTUBE_CLIENT_VERSION = "2.20261029.11.00";

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

  const continuationViewModel = node.continuationItemViewModel;
  if (isRecord(continuationViewModel)) {
    const command = continuationViewModel.continuationCommand;
    const innertubeCommand = isRecord(command)
      ? command.innertubeCommand
      : null;
    const nestedCommand = isRecord(innertubeCommand)
      ? innertubeCommand.continuationCommand
      : null;
    const token = isRecord(nestedCommand) ? nestedCommand.token : null;

    if (typeof token === "string") tokens.push(token);
  }

  for (const child of Object.values(node)) {
    collectListingItems(child, videos, tokens);
  }
}

async function fetchBrowse(
  payload: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/browse?key=${YOUTUBE_BROWSE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: YOUTUBE_CLIENT_VERSION,
            hl: "en",
            gl: "US",
          },
        },
        ...payload,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube browse API returned ${response.status}`);
  }

  return response.json();
}

async function scrapeAllFrostVideos(): Promise<YoutubeVideo[]> {
  const videos: RawYoutubeVideo[] = [];
  const tokens: string[] = [];

  const initialData = await fetchBrowse({
    browseId: `VL${YOUTUBE_UPLOADS_PLAYLIST_ID}`,
  });
  collectListingItems(initialData, videos, tokens);
  console.log(
    `YouTube playlist initial page: ${videos.length} videos, ${tokens.length} tokens`
  );

  let nextToken = tokens[0];
  let page = 0;

  while (nextToken && page < MAX_LISTING_PAGES) {
    page++;

    try {
      const payload = await fetchBrowse({ continuation: nextToken });
      const pageVideos: RawYoutubeVideo[] = [];
      const pageTokens: string[] = [];
      collectListingItems(payload, pageVideos, pageTokens);

      console.log(
        `YouTube playlist page ${page}: ${pageVideos.length} videos, ${pageTokens.length} tokens`
      );

      if (pageVideos.length === 0) break;

      videos.push(...pageVideos);
      nextToken = pageTokens[0];
    } catch (error) {
      console.error("Failed to load a YouTube listing page:", error);
      break;
    }
  }

  const seen = new Set<string>();
  const frostVideos = videos
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

  console.log(
    `YouTube playlist loaded ${videos.length} uploads, ${frostVideos.length} Winlator@Frost videos`
  );

  return frostVideos;
}

const getCachedAllFrostVideos = unstable_cache(
  scrapeAllFrostVideos,
  ["youtube-all-frost-videos-v3"],
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
