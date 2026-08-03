/*
# Create events table and add storage update policy

1. New Tables
- `events` — stores community events happening in Guanajuato municipalities
  - id (text, primary key) — client-generated unique id
  - title (text, not null) — event name
  - description (text) — event details
  - municipality (text, not null) — where the event takes place
  - location (text) — specific venue/address
  - date (text, not null) — event date as ISO string
  - time (text) — event time
  - imageUrl (text) — event cover photo
  - category (text) — event category
  - contact (text) — organizer contact info
  - createdAt (bigint) — creation timestamp in ms
2. Modified Tables
- None
3. Security
- Enable RLS on `events`.
- Allow anon + authenticated CRUD (single-tenant, no-auth app — data is intentionally public).
4. Storage
- Add UPDATE policy on storage.objects so `upsert: true` uploads work for the images bucket.
*/

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  municipality text NOT NULL,
  location text,
  date text NOT NULL,
  time text,
  imageUrl text,
  category text,
  contact text,
  createdAt bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE
  TO anon, authenticated USING (true);

-- Add UPDATE policy to storage.objects for the images bucket (needed for upsert: true)
DROP POLICY IF EXISTS "anon_update_images" ON storage.objects;
CREATE POLICY "anon_update_images" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'images') WITH CHECK (bucket_id = 'images');

-- Index for filtering events by municipality
CREATE INDEX IF NOT EXISTS idx_events_municipality ON events(municipality);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
