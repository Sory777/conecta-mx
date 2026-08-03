-- The events table was created with lowercase column names (imageurl, createdat)
-- instead of the camelCase names (imageUrl, createdAt) the app expects.
-- This mismatch causes the events query to fail, which crashes the entire
-- Promise.all data load (businesses + jobs + events), making the app show
-- "No se pudo cargar la información" and no businesses appear.
-- No data exists in events yet, so we can safely recreate the table.

DROP TABLE IF EXISTS events;

CREATE TABLE events (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  municipality text NOT NULL,
  location text,
  date text NOT NULL,
  time text,
  "imageUrl" text,
  category text,
  contact text,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
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

CREATE INDEX IF NOT EXISTS idx_events_municipality ON events(municipality);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
