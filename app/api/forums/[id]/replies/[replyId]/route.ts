import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIMITS = { body: 2000, email: 254 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{
    id: string;
    replyId: string;
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

/** Updates a reply after author-email verification. */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id: rawId, replyId: rawReplyId } = await context.params;
    const forumId = decodeURIComponent(rawId);
    const replyId = decodeURIComponent(rawReplyId);
    if (!forumId || !replyId) {
      return NextResponse.json({ error: "Forum id and reply id are required." }, { status: 400 });
    }

    let input: Record<string, unknown>;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = await readEmail(request, input);
    const body = cleanString(input.body ?? input.content, LIMITS.body);
    if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "A valid author email is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: reply } = await supabase
      .from("forum_replies")
      .select("id,forum_id,email")
      .eq("id", replyId)
      .maybeSingle();

    if (!reply || (reply as { forum_id: string }).forum_id !== forumId) {
      return NextResponse.json({ error: "Reply not found." }, { status: 404 });
    }
    if (String((reply as { email: string }).email).toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Only the author can edit this reply." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("forum_replies")
      .update({ body, edited: true })
      .eq("id", replyId)
      .select("id,username,body,timestamp,edited")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/forums/[id]/replies/[replyId] failed:", error);
    return NextResponse.json({ error: "Unable to update reply." }, { status: 500 });
  }
}

/** Deletes a reply after author-email verification. */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: rawId, replyId: rawReplyId } = await context.params;
    const forumId = decodeURIComponent(rawId);
    const replyId = decodeURIComponent(rawReplyId);
    if (!forumId || !replyId) {
      return NextResponse.json({ error: "Forum id and reply id are required." }, { status: 400 });
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
    const { data: reply } = await supabase
      .from("forum_replies")
      .select("id,forum_id,email")
      .eq("id", replyId)
      .maybeSingle();

    if (!reply || (reply as { forum_id: string }).forum_id !== forumId) {
      return NextResponse.json({ error: "Reply not found." }, { status: 404 });
    }
    if (String((reply as { email: string }).email).toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Only the author can delete this reply." }, { status: 403 });
    }

    const { error } = await supabase.from("forum_replies").delete().eq("id", replyId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/forums/[id]/replies/[replyId] failed:", error);
    return NextResponse.json({ error: "Unable to delete reply." }, { status: 500 });
  }
}
