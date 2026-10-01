import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIMITS = { title: 120, body: 5000, email: 254 };
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

async function readEmail(request: Request, input: Record<string, unknown>): Promise<string> {
  const fromBody = cleanString(input.email, LIMITS.email);
  if (fromBody) return fromBody;
  try {
    return cleanString(new URL(request.url).searchParams.get("email"), LIMITS.email);
  } catch {
    return "";
  }
}

/**
 * Updates a thread. The author email must match the one used at creation
 * (the app asks the author to re-enter it; there are no accounts).
 */
export async function PUT(request: Request, context: RouteContext) {
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

    const email = await readEmail(request, input);
    const title = cleanString(input.title, LIMITS.title);
    const body = cleanString(input.body ?? input.content, LIMITS.body);
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!body) return NextResponse.json({ error: "Body is required." }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid author email is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: forum } = await supabase
      .from("forums")
      .select("id,email")
      .eq("id", forumId)
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: "Forum not found." }, { status: 404 });
    }
    if (String((forum as { email: string }).email).toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Only the author can edit this forum." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("forums")
      .update({ title, body, edited: true })
      .eq("id", forumId)
      .select("id,title,body,username,timestamp,edited,image_url,video_url")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/forums/[id] failed:", error);
    return NextResponse.json({ error: "Unable to update forum." }, { status: 500 });
  }
}

/** Deletes a thread and all its replies after author-email verification. */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const forumId = decodeURIComponent(rawId);
    if (!forumId) {
      return NextResponse.json({ error: "Forum id is required." }, { status: 400 });
    }

    let input: Record<string, unknown> = {};
    try {
      input = await request.json();
    } catch {
      // Some clients strip DELETE bodies; ?email= is accepted as fallback.
    }
    const email = await readEmail(request, input);
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid author email is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: forum } = await supabase
      .from("forums")
      .select("id,email")
      .eq("id", forumId)
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: "Forum not found." }, { status: 404 });
    }
    if (String((forum as { email: string }).email).toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Only the author can delete this forum." }, { status: 403 });
    }

    const { error } = await supabase.from("forums").delete().eq("id", forumId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/forums/[id] failed:", error);
    return NextResponse.json({ error: "Unable to delete forum." }, { status: 500 });
  }
}
