import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const LIMITS = { username: 40, body: 2000, email: 254 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanString(value: unknown, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > max ? s.slice(0, max) : s;
}

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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const forumId = decodeURIComponent(rawId);
    if (!forumId) {
      return NextResponse.json({ error: "Forum id is required." }, { status: 400 });
    }

    let input: Record<string, unknown>;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const username = cleanString(input.username ?? input.user, LIMITS.username);
    const body = cleanString(input.body ?? input.content, LIMITS.body);
    const email = cleanString(input.email, LIMITS.email);
    if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
    if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: forum } = await supabase
      .from("forums")
      .select("id")
      .eq("id", forumId)
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: "Forum not found." }, { status: 404 });
    }

    const id = cleanString(input.id, 64) || crypto.randomUUID();

    // Idempotent retry: the app re-pushes missing replies on every sync.
    const { data: existing } = await supabase
      .from("forum_replies")
      .select("id,username,body,timestamp")
      .eq("id", id)
      .maybeSingle();

    if (existing) return NextResponse.json(existing, { status: 200 });

    const { data, error } = await supabase
      .from("forum_replies")
      .insert({
        id,
        forum_id: forumId,
        username,
        email,
        body,
        timestamp: asMillis(input.timestamp ?? (input as Record<string, unknown>).createdAt),
      })
      .select("id,username,body,timestamp")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/forums/[id]/replies failed:", error);
    return NextResponse.json({ error: "Unable to publish reply." }, { status: 500 });
  }
}
