-- Fallback public download counts when releases RLS blocks anon or RPC not yet run
-- This table allows any anon to insert a row per download click, counts are public

CREATE TABLE IF NOT EXISTS public.download_events (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  created_at timestamptz default now()
);

-- Allow public to insert and read counts (for public download counts)
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read download_events" ON public.download_events;
CREATE POLICY "Allow public read download_events" ON public.download_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert download_events" ON public.download_events;
CREATE POLICY "Allow public insert download_events" ON public.download_events FOR INSERT WITH CHECK (true);

-- Optional: allow public to count via RPC that sums download_events + download_count
CREATE OR REPLACE FUNCTION public.get_public_download_count(p_version TEXT)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT download_count FROM public.releases WHERE version = p_version), 0)
         + COALESCE((SELECT count(*) FROM public.download_events WHERE version = p_version), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_download_count(TEXT) TO anon, authenticated, service_role;

-- Verify
SELECT * FROM public.download_events LIMIT 1;
SELECT public.get_public_download_count('test');
