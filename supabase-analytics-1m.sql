-- Support >1000 views (up to 1M) for admin dashboard analytics
-- Previous lib/analytics.ts did .limit(5000) but Supabase PostgREST caps at 1000 by default,
-- so dashboard stopped at 1000. This uses exact count and server-side aggregation (no row limit).

-- Ensure page_views exists (from earlier analytics setup)
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  user_agent text,
  country text,
  browser text,
  os text,
  created_at timestamptz default now()
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read page_views" ON public.page_views;
CREATE POLICY "Allow public read page_views" ON public.page_views FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert page_views" ON public.page_views;
CREATE POLICY "Allow public insert page_views" ON public.page_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read page_views" ON public.page_views;
DROP POLICY IF EXISTS "Allow anon insert page_views" ON public.page_views;

-- Function to get total count efficiently (no row fetch)
CREATE OR REPLACE FUNCTION public.get_page_views_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT FROM public.page_views;
$$;
GRANT EXECUTE ON FUNCTION public.get_page_views_count() TO anon, authenticated, service_role;

-- Function to get aggregated stats for dashboard (browser/os/country) - handles 1M+ rows efficiently
CREATE OR REPLACE FUNCTION public.get_analytics_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalViews', (SELECT COUNT(*) FROM public.page_views),
    'byBrowser', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT COALESCE(browser,'Unknown') as name, COUNT(*)::int as count FROM public.page_views GROUP BY COALESCE(browser,'Unknown') ORDER BY count DESC) t),
    'byOS', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT COALESCE(os,'Unknown') as name, COUNT(*)::int as count FROM public.page_views GROUP BY COALESCE(os,'Unknown') ORDER BY count DESC) t),
    'byCountry', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT COALESCE(country,'Unknown') as name, COUNT(*)::int as count FROM public.page_views GROUP BY COALESCE(country,'Unknown') ORDER BY count DESC) t)
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_analytics_stats() TO anon, authenticated, service_role;

-- Verify
SELECT public.get_page_views_count() as total;
SELECT public.get_analytics_stats() as stats;
