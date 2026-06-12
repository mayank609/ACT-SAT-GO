-- Migration: Supabase Storage RLS policies for the images bucket
-- Applied: 2026-06-12
-- Reason: storage.objects had RLS enabled but no policies, causing
--         every INSERT/SELECT to be denied with "new row violates row
--         level security policy".
--
-- To re-apply: connect to the project's DATABASE_URL and run this file.
-- To verify:   SELECT policyname, cmd, roles::text FROM pg_policies
--              WHERE schemaname='storage' AND tablename='objects';

-- Ensure the images bucket exists and is correctly configured.
-- The bucket was originally created by the storage service; this ensures
-- it stays public with the right limits even if recreated.
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

-- Remove any pre-existing versions of these policies to allow idempotent re-runs.
DROP POLICY IF EXISTS "auth_upload_images" ON storage.objects;
DROP POLICY IF EXISTS "public_read_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_images"  ON storage.objects;

-- Authenticated users (logged-in admins/tutors/students) can upload images.
CREATE POLICY "auth_upload_images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'images');

-- Anyone can read images (required for <img> tags inside rendered tests).
CREATE POLICY "public_read_images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'images');

-- Authenticated users can delete images (used by the image manager in Test Builder).
CREATE POLICY "auth_delete_images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'images');

-- Authenticated users can update/replace images (required for upsert=true uploads).
CREATE POLICY "auth_update_images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'images');
