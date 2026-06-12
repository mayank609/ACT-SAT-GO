-- Supabase Storage setup for ACT-SAT-GO
-- Applied: 2026-06-12 via direct PostgreSQL connection (pg package, DATABASE_URL)
--
-- Run this in the Supabase Dashboard → SQL Editor to re-apply from scratch,
-- or use the versioned migration at:
--   platform/supabase/migrations/20260612_storage_rls_policies.sql
--
-- Verification query:
--   SELECT policyname, cmd, roles::text
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects';

-- 1. Create / update the images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

-- 2. Drop previous versions so this script is idempotent
DROP POLICY IF EXISTS "auth_upload_images" ON storage.objects;
DROP POLICY IF EXISTS "public_read_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_images"  ON storage.objects;

-- 3. Authenticated users may upload images
CREATE POLICY "auth_upload_images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'images');

-- 4. Everyone may read images (required for <img> tags in rendered tests)
CREATE POLICY "public_read_images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'images');

-- 5. Authenticated users may delete images
CREATE POLICY "auth_delete_images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'images');

-- 6. Authenticated users may replace images (upsert=true in storage client)
CREATE POLICY "auth_update_images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'images');
