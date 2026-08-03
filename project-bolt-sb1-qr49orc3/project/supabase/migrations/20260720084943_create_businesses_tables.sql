/*
# Create businesses, products, reviews, jobs, and stats tables

1. New Tables
- `businesses`: stores registered businesses (name, category, contact, plan, etc.)
- `products`: catalog products belonging to a business
- `reviews`: user reviews for businesses
- `jobs`: job postings
- `stats`: app-wide statistics (visits, clicks, downloads)

2. Security
- This is a public directory app with NO sign-in. All tables allow anon + authenticated CRUD
  because the data is intentionally public/shared (single-tenant, no-auth).
- RLS enabled on every table.
- 4 policies per table (select/insert/update/delete), all TO anon, authenticated.

3. Notes
- Uses text IDs (not uuid) to preserve existing seed data IDs like 'biz_tacos_leon'.
- created_at is timestamptz defaulting to now().
*/

CREATE TABLE IF NOT EXISTS businesses (
  id text PRIMARY KEY,
  name text NOT NULL,
  municipality text NOT NULL,
  city text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  whatsapp text NOT NULL,
  phone text,
  address text,
  "mapsLink" text,
  hours text,
  facebook text,
  instagram text,
  promotion text,
  "imageUrl" text,
  plan text NOT NULL DEFAULT 'free',
  verified boolean NOT NULL DEFAULT false,
  founding boolean NOT NULL DEFAULT false,
  rating numeric NOT NULL DEFAULT 0,
  "reviewCount" integer NOT NULL DEFAULT 0,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  coords jsonb
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_businesses" ON businesses;
CREATE POLICY "anon_select_businesses" ON businesses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_businesses" ON businesses;
CREATE POLICY "anon_insert_businesses" ON businesses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_businesses" ON businesses;
CREATE POLICY "anon_update_businesses" ON businesses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_businesses" ON businesses;
CREATE POLICY "anon_delete_businesses" ON businesses FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  "businessId" text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  "imageUrl" text,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY,
  "businessId" text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author text NOT NULL,
  rating integer NOT NULL,
  comment text NOT NULL,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
CREATE POLICY "anon_select_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reviews" ON reviews;
CREATE POLICY "anon_update_reviews" ON reviews FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reviews" ON reviews;
CREATE POLICY "anon_delete_reviews" ON reviews FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  "companyName" text NOT NULL,
  municipality text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  requirements text NOT NULL,
  salary text,
  "contractType" text,
  contact text,
  whatsapp text,
  email text,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_jobs" ON jobs;
CREATE POLICY "anon_select_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jobs" ON jobs;
CREATE POLICY "anon_insert_jobs" ON jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jobs" ON jobs;
CREATE POLICY "anon_update_jobs" ON jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_jobs" ON jobs;
CREATE POLICY "anon_delete_jobs" ON jobs FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS stats (
  id text PRIMARY KEY DEFAULT 'app_stats',
  visits bigint NOT NULL DEFAULT 0,
  "whatsappClicks" bigint NOT NULL DEFAULT 0,
  "mapClicks" bigint NOT NULL DEFAULT 0,
  "qrDownloads" bigint NOT NULL DEFAULT 0
);

ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stats" ON stats;
CREATE POLICY "anon_select_stats" ON stats FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_stats" ON stats;
CREATE POLICY "anon_insert_stats" ON stats FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_stats" ON stats;
CREATE POLICY "anon_update_stats" ON stats FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_stats" ON stats;
CREATE POLICY "anon_delete_stats" ON stats FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO stats (id, visits, "whatsappClicks", "mapClicks", "qrDownloads")
VALUES ('app_stats', 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
