/*
# Create images storage bucket for user-uploaded photos
- Public bucket so images are accessible via URL
- Used for business logos and product photos uploaded from user gallery
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "anon_read_images" ON storage.objects;
CREATE POLICY "anon_read_images" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'images');

-- Allow anyone to upload (no-auth app)
DROP POLICY IF EXISTS "anon_insert_images" ON storage.objects;
CREATE POLICY "anon_insert_images" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'images');

-- Allow anyone to delete their own uploads (best-effort in no-auth app)
DROP POLICY IF EXISTS "anon_delete_images" ON storage.objects;
CREATE POLICY "anon_delete_images" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'images');
