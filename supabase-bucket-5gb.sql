-- ============================================================
-- Fix: Increase Supabase Storage bucket limit to 5GB
-- Bucket: winlator-releases
-- Run this in Supabase Dashboard -> SQL Editor
-- Requires service_role or owner privileges
-- ============================================================

-- Check current limit (should show 52428800 = 50 MB before fix)
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'winlator-releases';

-- Increase to 5GB (5368709120 bytes = 5 * 1024^3)
-- Sufficient for 250 MB APKs with headroom
UPDATE storage.buckets
SET file_size_limit = 5368709120,
    allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
WHERE id = 'winlator-releases';

-- Verify after update
SELECT id, file_size_limit,
       file_size_limit / 1024 / 1024 AS limit_mb,
       file_size_limit / 1024 / 1024 / 1024 AS limit_gb
FROM storage.buckets
WHERE id = 'winlator-releases';

-- Expected: limit_mb = 5120, limit_gb = 5

-- If bucket does not exist yet, create it with 5GB limit:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('winlator-releases', 'winlator-releases', false, 5368709120, ARRAY['application/vnd.android.package-archive','application/octet-stream'])
-- ON CONFLICT (id) DO UPDATE SET file_size_limit = 5368709120;
