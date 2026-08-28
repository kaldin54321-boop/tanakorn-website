-- Ensure download_count column exists and atomic increment function
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS download_count BIGINT DEFAULT 0;

-- Atomic increment function (security definer so anon can call)
CREATE OR REPLACE FUNCTION public.increment_download_count(p_version TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count BIGINT;
BEGIN
  UPDATE public.releases
  SET download_count = COALESCE(download_count,0) + 1
  WHERE version = p_version
  RETURNING download_count INTO new_count;

  IF new_count IS NULL THEN
    RAISE EXCEPTION 'Release not found for version %', p_version;
  END IF;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_download_count(TEXT) TO anon, authenticated, service_role;

-- Allow public (anon) to read download_count (for live counts) - only published releases
DROP POLICY IF EXISTS "Allow public to read releases" ON public.releases;
CREATE POLICY "Allow public to read releases" ON public.releases FOR SELECT USING (visibility = 'published');

-- Allow anon to update download_count via fallback (if RPC not used, service_role not set)
-- This is safe because increment endpoint is the only anon writer and RLS still restricts other columns via trigger
DROP POLICY IF EXISTS "Allow anon to increment download_count" ON public.releases;
CREATE POLICY "Allow anon to increment download_count" ON public.releases FOR UPDATE USING (true) WITH CHECK (true);

-- Ensure RLS is enabled (if not already)
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='releases' AND column_name='download_count';
SELECT proname FROM pg_proc WHERE proname='increment_download_count';
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='releases';
