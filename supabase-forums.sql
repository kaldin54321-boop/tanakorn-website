-- ============================================================
-- Public forums for the Winlator@Frost Android app (Social Hub tab)
-- Endpoints (Next.js, works on Cloudflare Workers + Render):
--   GET  /api/forums
--   POST /api/forums
--   POST /api/forums/:id/replies
-- Run this in Supabase Dashboard -> SQL Editor, then deploy the site.
-- ============================================================

-- Threads posted from the app. `id` is the client-generated UUID so that
-- POST retries stay idempotent. `timestamp` is epoch millis from the app.
CREATE TABLE IF NOT EXISTS public.forums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  username TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 40),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 1 AND 254),
  timestamp BIGINT NOT NULL,
  image_url TEXT NULL,
  video_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id TEXT PRIMARY KEY,
  forum_id TEXT NOT NULL REFERENCES public.forums(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 40),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 1 AND 254),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forums_timestamp_idx ON public.forums (timestamp DESC);
CREATE INDEX IF NOT EXISTS forum_replies_forum_idx ON public.forum_replies (forum_id, timestamp ASC);

ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- The app has no login, so the anon key needs public read + insert.
-- (Emails are stored for moderation but never returned by GET /api/forums.)
DROP POLICY IF EXISTS "Public read forums" ON public.forums;
CREATE POLICY "Public read forums"
ON public.forums FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public insert forums" ON public.forums;
CREATE POLICY "Public insert forums"
ON public.forums FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public read forum replies" ON public.forum_replies;
CREATE POLICY "Public read forum replies"
ON public.forum_replies FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public insert forum replies" ON public.forum_replies;
CREATE POLICY "Public insert forum replies"
ON public.forum_replies FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ============================================================
-- Attachment storage for forum images/videos (public read, anon upload)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-attachments',
  'forum-attachments',
  true,
  33554432, -- 32 MB per file (route enforces 10 MB images / 32 MB videos)
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif',
        'video/mp4','video/3gpp','video/x-matroska','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 33554432;

DROP POLICY IF EXISTS "Public read forum-attachments" ON storage.objects;
CREATE POLICY "Public read forum-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'forum-attachments');

-- The app has no login, so anonymous uploads must be allowed here.
DROP POLICY IF EXISTS "Public upload forum-attachments" ON storage.objects;
CREATE POLICY "Public upload forum-attachments"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'forum-attachments');

-- Verify
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('forums', 'forum_replies') ORDER BY tablename, cmd;
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'forum-attachments';
