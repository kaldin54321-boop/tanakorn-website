-- ============================================================
-- Add external_url to releases for 239MB+ APKs
-- Allows publishing without Supabase bucket limit
-- Run in Dashboard → SQL Editor
-- ============================================================

-- Add column if not exists
ALTER TABLE public.releases
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Also ensure file_size can hold 5GB (int8/BIGINT)
-- If file_size is integer (32-bit max 2GB), change to bigint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='releases' AND column_name='file_size' AND data_type='integer'
  ) THEN
    ALTER TABLE public.releases ALTER COLUMN file_size TYPE BIGINT USING file_size::bigint;
  END IF;
END $$;

-- Helper RPC to bump bucket to 5GB without needing service_role in UI
-- SECURITY DEFINER allows anon/authenticated to call it
CREATE OR REPLACE FUNCTION public.fix_winlator_bucket()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE storage.buckets
  SET file_size_limit = 5368709120,
      allowed_mime_types = ARRAY['application/vnd.android.package-archive','application/octet-stream']
  WHERE id = 'winlator-releases';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count = 0 THEN
    -- Bucket missing, create it
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('winlator-releases','winlator-releases', false, 5368709120, ARRAY['application/vnd.android.package-archive','application/octet-stream'])
    ON CONFLICT (id) DO UPDATE SET file_size_limit = 5368709120;
    RETURN json_build_object('success', true, 'message', 'Bucket created with 5GB limit');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Bucket updated to 5GB', 'updated', updated_count);
END;
$$;

-- Allow anyone to call the fix (or restrict to authenticated)
GRANT EXECUTE ON FUNCTION public.fix_winlator_bucket() TO anon, authenticated, service_role;

-- Verify
SELECT public.fix_winlator_bucket();
SELECT id, file_size_limit/1024/1024/1024 AS gb FROM storage.buckets WHERE id='winlator-releases';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='releases' AND column_name='external_url';
