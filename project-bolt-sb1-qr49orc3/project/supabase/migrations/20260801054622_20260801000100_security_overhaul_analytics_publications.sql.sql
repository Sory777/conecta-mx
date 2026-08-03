/*
# Security Overhaul + Analytics Engine + Rich Publications + Favorites + Reports

## Summary
Closes the database (replaces USING(true) with real ownership checks), adds auth support,
creates the analytics engine, transforms products into rich publications, and adds
favorites, reports, and admin tables.

## New Tables
1. admins — whitelist of admin user IDs
2. analytics_events — tracks every interaction for Conecta Analytics
3. favorites — user's saved businesses/products/events/jobs
4. reports — user-submitted reports for moderation

## Modified Tables
1. businesses — added user_id column (links to auth.users owner)
2. products — added publication metadata: category, expiresAt, tags, counters
3. jobs — added businessId column (FK to businesses, nullable)

## New Functions
1. is_admin() — checks if current user is in admins table (SECURITY DEFINER)
2. increment_stat(key) — atomic stat increment (fixes race condition)
3. track_event(...) — inserts analytics event (SECURITY DEFINER, callable by anon)

## Security Changes
- SELECT remains public on content tables
- INSERT/UPDATE/DELETE require auth + ownership OR admin
- reviews: INSERT open to anon, DELETE admin-only
- cvs: INSERT open to anon, SELECT/DELETE admin-only
- stats: SELECT public, modifications only via increment_stat()
- analytics_events: INSERT via track_event(), SELECT owner/admin only
- favorites: fully owner-scoped (authenticated only)
- reports: INSERT open to anon, SELECT/UPDATE/DELETE admin-only
*/

-- ============================================================
-- PART 1: Add user_id to businesses, businessId to jobs, publication metadata to products
-- ============================================================

DO $$ BEGIN
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "businessId" text REFERENCES businesses(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Publication metadata for products (transform into rich publications)
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Otros';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiresAt" bigint;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS "whatsappClicks" integer NOT NULL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS shares integer NOT NULL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS "uniqueViews" integer NOT NULL DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Index for filtering products by business
CREATE INDEX IF NOT EXISTS idx_products_business ON products("businessId");
CREATE INDEX IF NOT EXISTS idx_products_expires ON products("expiresAt");
CREATE INDEX IF NOT EXISTS idx_jobs_business ON jobs("businessId");

-- ============================================================
-- PART 2: Create new tables (admins, analytics_events, favorites, reports)
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text REFERENCES businesses(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  visitor_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_analytics_business ON analytics_events(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  item_type text NOT NULL,
  item_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ============================================================
-- PART 3: SECURITY DEFINER helper functions
-- ============================================================

-- is_admin(): returns true if current user is in admins table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

-- increment_stat(key): atomic increment of a stats column
CREATE OR REPLACE FUNCTION increment_stat(stat_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO stats (id, visits, "whatsappClicks", "mapClicks", "qrDownloads")
  VALUES ('app_stats', 0, 0, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  IF stat_key = 'visits' THEN
    UPDATE stats SET visits = visits + 1 WHERE id = 'app_stats';
  ELSIF stat_key = 'whatsappClicks' THEN
    UPDATE stats SET "whatsappClicks" = "whatsappClicks" + 1 WHERE id = 'app_stats';
  ELSIF stat_key = 'mapClicks' THEN
    UPDATE stats SET "mapClicks" = "mapClicks" + 1 WHERE id = 'app_stats';
  ELSIF stat_key = 'qrDownloads' THEN
    UPDATE stats SET "qrDownloads" = "qrDownloads" + 1 WHERE id = 'app_stats';
  END IF;
END;
$$;

-- track_event(business_id, product_id, event_type, visitor_id):
-- inserts an analytics event, callable by anon (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION track_event(
  p_business_id text,
  p_product_id text,
  p_event_type text,
  p_visitor_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO analytics_events (business_id, product_id, event_type, visitor_id)
  VALUES (p_business_id, p_product_id, p_event_type, p_visitor_id);

  -- Also increment product-level counters for quick reads
  IF p_product_id IS NOT NULL THEN
    IF p_event_type = 'view' THEN
      UPDATE products SET views = views + 1 WHERE id = p_product_id;
    ELSIF p_event_type = 'whatsapp_click' THEN
      UPDATE products SET "whatsappClicks" = "whatsappClicks" + 1 WHERE id = p_product_id;
    ELSIF p_event_type = 'share' THEN
      UPDATE products SET shares = shares + 1 WHERE id = p_product_id;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- PART 4: Rewrite ALL RLS policies with real ownership checks
-- ============================================================

-- ---------- BUSINESSES ----------
DROP POLICY IF EXISTS "anon_select_businesses" ON businesses;
DROP POLICY IF EXISTS "anon_insert_businesses" ON businesses;
DROP POLICY IF EXISTS "anon_update_businesses" ON businesses;
DROP POLICY IF EXISTS "anon_delete_businesses" ON businesses;

CREATE POLICY "public_read_businesses" ON businesses FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "owner_insert_businesses" ON businesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update_businesses" ON businesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "owner_delete_businesses" ON businesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR is_admin());

-- ---------- PRODUCTS ----------
DROP POLICY IF EXISTS "anon_select_products" ON products;
DROP POLICY IF EXISTS "anon_insert_products" ON products;
DROP POLICY IF EXISTS "anon_update_products" ON products;
DROP POLICY IF EXISTS "anon_delete_products" ON products;

CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "owner_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products."businessId" AND businesses.user_id = auth.uid())
  );

CREATE POLICY "owner_update_products" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products."businessId" AND (businesses.user_id = auth.uid() OR is_admin()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products."businessId" AND (businesses.user_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "owner_delete_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products."businessId" AND (businesses.user_id = auth.uid() OR is_admin()))
  );

-- ---------- REVIEWS ----------
-- Anyone can post a review; only admin can delete
DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
DROP POLICY IF EXISTS "anon_update_reviews" ON reviews;
DROP POLICY IF EXISTS "anon_delete_reviews" ON reviews;

CREATE POLICY "public_read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "owner_update_reviews" ON reviews FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_reviews" ON reviews FOR DELETE
  TO authenticated USING (is_admin());

-- ---------- JOBS ----------
DROP POLICY IF EXISTS "anon_select_jobs" ON jobs;
DROP POLICY IF EXISTS "anon_insert_jobs" ON jobs;
DROP POLICY IF EXISTS "anon_update_jobs" ON jobs;
DROP POLICY IF EXISTS "anon_delete_jobs" ON jobs;

CREATE POLICY "public_read_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "owner_insert_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (
    "businessId" IS NULL OR EXISTS (
      SELECT 1 FROM businesses WHERE businesses.id = jobs."businessId" AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_update_jobs" ON jobs FOR UPDATE
  TO authenticated USING (
    ("businessId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM businesses WHERE businesses.id = jobs."businessId" AND (businesses.user_id = auth.uid() OR is_admin())
    )) OR is_admin()
  ) WITH CHECK (
    ("businessId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM businesses WHERE businesses.id = jobs."businessId" AND (businesses.user_id = auth.uid() OR is_admin())
    )) OR is_admin()
  );

CREATE POLICY "owner_delete_jobs" ON jobs FOR DELETE
  TO authenticated USING (
    ("businessId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM businesses WHERE businesses.id = jobs."businessId" AND (businesses.user_id = auth.uid() OR is_admin())
    )) OR is_admin()
  );

-- ---------- CVS ----------
-- Anyone can submit a CV; only admin can read/delete
DROP POLICY IF EXISTS "anon_select_cvs" ON cvs;
DROP POLICY IF EXISTS "anon_insert_cvs" ON cvs;
DROP POLICY IF EXISTS "anon_update_cvs" ON cvs;
DROP POLICY IF EXISTS "anon_delete_cvs" ON cvs;

CREATE POLICY "admin_read_cvs" ON cvs FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "anon_insert_cvs" ON cvs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_cvs" ON cvs FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_cvs" ON cvs FOR DELETE
  TO authenticated USING (is_admin());

-- ---------- EVENTS ----------
DROP POLICY IF EXISTS "anon_select_events" ON events;
DROP POLICY IF EXISTS "anon_insert_events" ON events;
DROP POLICY IF EXISTS "anon_update_events" ON events;
DROP POLICY IF EXISTS "anon_delete_events" ON events;

CREATE POLICY "public_read_events" ON events FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "admin_insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_update_events" ON events FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_events" ON events FOR DELETE
  TO authenticated USING (is_admin());

-- ---------- STATS ----------
-- Public read, no direct writes (use increment_stat() RPC)
DROP POLICY IF EXISTS "anon_select_stats" ON stats;
DROP POLICY IF EXISTS "anon_insert_stats" ON stats;
DROP POLICY IF EXISTS "anon_update_stats" ON stats;
DROP POLICY IF EXISTS "anon_delete_stats" ON stats;

CREATE POLICY "public_read_stats" ON stats FOR SELECT
  TO anon, authenticated USING (true);

-- ---------- ANALYTICS_EVENTS ----------
-- INSERT via track_event() RPC (SECURITY DEFINER), SELECT by owner/admin only
DROP POLICY IF EXISTS "anon_select_analytics_events" ON analytics_events;
DROP POLICY IF EXISTS "anon_insert_analytics_events" ON analytics_events;
DROP POLICY IF EXISTS "anon_update_analytics_events" ON analytics_events;
DROP POLICY IF EXISTS "anon_delete_analytics_events" ON analytics_events;

CREATE POLICY "owner_read_analytics" ON analytics_events FOR SELECT
  TO authenticated USING (
    business_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM businesses WHERE businesses.id = analytics_events.business_id AND businesses.user_id = auth.uid()
    ) OR is_admin()
  );

CREATE POLICY "admin_delete_analytics" ON analytics_events FOR DELETE
  TO authenticated USING (is_admin());

-- ---------- FAVORITES ----------
-- Fully owner-scoped: each user sees only their own favorites
DROP POLICY IF EXISTS "anon_select_favorites" ON favorites;
DROP POLICY IF EXISTS "anon_insert_favorites" ON favorites;
DROP POLICY IF EXISTS "anon_update_favorites" ON favorites;
DROP POLICY IF EXISTS "anon_delete_favorites" ON favorites;

CREATE POLICY "owner_read_favorites" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "owner_insert_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_delete_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- REPORTS ----------
-- Anyone can submit a report; only admin can read/update/delete
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
DROP POLICY IF EXISTS "anon_update_reports" ON reports;
DROP POLICY IF EXISTS "anon_delete_reports" ON reports;

CREATE POLICY "admin_read_reports" ON reports FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_reports" ON reports FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_reports" ON reports FOR DELETE
  TO authenticated USING (is_admin());

-- ---------- ADMINS ----------
-- A user can check if they themselves are admin
DROP POLICY IF EXISTS "anon_select_admins" ON admins;
DROP POLICY IF EXISTS "anon_insert_admins" ON admins;
DROP POLICY IF EXISTS "anon_delete_admins" ON admins;

CREATE POLICY "self_read_admins" ON admins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- No INSERT/DELETE via RLS — admin table is managed via service role or SQL only