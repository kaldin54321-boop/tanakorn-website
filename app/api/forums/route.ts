import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const LIMITS = { title: 120, body: 5000, username: 40, email: 254 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FORUMS = 100;

function cleanString(value: unknown, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** Accepts epoch millis/seconds numbers as well as ISO date strings. */
function asMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 10000000000 ? value * 1000 : Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const t = Date.parse(value.trim());
    if (!Number.isNaN(t)) return t;
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return n < 10000000000 ? n * 1000 : Math.floor(n);
  }
  return Date.now();
}

type ForumRow = {
  id: string;
  title: string;
  body: string;
  username: string;
  timestamp: number;
  edited: boolean;
  image_url: string | null;
  video_url: string | null;
};

type ReplyRow = {
  id: string;
  forum_id: string;
  username: string;
  body: string;
  timestamp: number;
};

type PublicReply = {
  id: string;
  username: string;
  email: string;
  body: string;
  timestamp: number;
  edited: boolean;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: forums, error } = await supabase
      .from("forums")
      .select("id,title,body,username,timestamp,edited,image_url,video_url")
      .order("timestamp", { ascending: false })
      .limit(MAX_FORUMS);

    if (error) throw error;

    const rows = (forums ?? []) as ForumRow[];
    const ids = rows.map((f) => f.id);

    const repliesByForum = new Map<string, PublicReply[]>();
    if (ids.length > 0) {
      const { data: replies, error: replyError } = await supabase
        .from("forum_replies")
        .select("id,forum_id,username,body,timestamp,edited")
        .in("forum_id", ids)
        .order("timestamp", { ascending: true });

      if (replyError) throw replyError;

      for (const r of (replies ?? []) as (ReplyRow & { edited: boolean })[]) {
        const list = repliesByForum.get(r.forum_id) ?? [];
        const reply: PublicReply = {
          id: r.id,
          username: r.username,
          email: "",
          body: r.body,
          timestamp: r.timestamp,
          edited: !!r.edited,
        };
        list.push(reply);
        repliesByForum.set(r.forum_id, list);
      }
    }

    // NOTE: emails are intentionally blanked in public reads; the app only
    // displays usernames. They stay stored for moderation.
    return NextResponse.json({
      forums: rows.map((f) => ({
        id: f.id,
        title: f.title,
        body: f.body,
        username: f.username,
        email: "",
        timestamp: f.timestamp,
        edited: !!f.edited,
        ...(isHttpUrl(f.image_url) ? { imageUrl: (f.image_url as string).trim() } : {}),
        ...(isHttpUrl(f.video_url) ? { videoUrl: (f.video_url as string).trim() } : {}),
        replies: repliesByForum.get(f.id) ?? [],
      })),
    });
  } catch (error) {
    console.error("GET /api/forums failed:", error);
    return NextResponse.json({ error: "Unable to load forums." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let input: Record<string, unknown>;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const title = cleanString(input.title, LIMITS.title);
    const body = cleanString(input.body ?? input.content, LIMITS.body);
    const username = cleanString(input.username ?? input.user, LIMITS.username);
    const email = cleanString(input.email, LIMITS.email);
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!body) return NextResponse.json({ error: "Body is required." }, { status: 400 });
    if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const id = cleanString(input.id, 64) || crypto.randomUUID();
    const supabase = await createClient();

    // Idempotent retry: the app re-pushes local posts until the server has them.
    const { data: existing } = await supabase
      .from("forums")
      .select("id,title,body,username,timestamp,image_url,video_url")
      .eq("id", id)
      .maybeSingle();

    if (existing) return NextResponse.json(existing, { status: 200 });

    const row = {
      id,
      title,
      body,
      username,
      email,
      timestamp: asMillis(input.timestamp ?? (input as Record<string, unknown>).createdAt),
      image_url: isHttpUrl(input.imageUrl) ? (input.imageUrl as string).trim() : null,
      video_url: isHttpUrl(input.videoUrl) ? (input.videoUrl as string).trim() : null,
    };

    const { data, error } = await supabase.from("forums").insert(row).select().single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/forums failed:", error);
    return NextResponse.json({ error: "Unable to publish forum." }, { status: 500 });
  }
}
