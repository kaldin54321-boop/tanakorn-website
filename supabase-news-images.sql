-- ============================================================
-- News images bucket and policies
-- Covers: cover image for article (image_url) and inline paragraph images
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Create bucket for news images (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'news-images',
  'news-images',
  true,
  10485760, -- 10 MB per image
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- Allow public read
DROP POLICY IF EXISTS "Public read news-images" ON storage.objects;
CREATE POLICY "Public read news-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'news-images');

-- Allow authenticated (admin) to upload/update/delete
DROP POLICY IF EXISTS "Admin write news-images" ON storage.objects;
CREATE POLICY "Admin write news-images"
ON storage.objects FOR ALL
USING (bucket_id = 'news-images' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'news-images' AND auth.role() = 'authenticated');

-- For service_role bypass, ensure RLS still allows service_role
-- service_role bypasses RLS by default, no policy needed

-- Verify
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id='news-images';
SELECT policyname, cmd FROM pg_policies WHERE tablename='objects' AND policyname LIKE '%news-images%';

-- Optional: ensure news table can store JSON content blocks if needed
-- image_url already exists for cover; content is TEXT which can store JSON string for inline images
-- If you want a dedicated JSONB column for structured content, uncomment:
-- ALTER TABLE public.news ADD COLUMN IF NOT EXISTS content_blocks JSONB;
-- ALTER TABLE public.news ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
