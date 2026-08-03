/*
# Security Overhaul + Analytics Engine + Rich Publications + Favorites + Reports

## Summary
This migration closes the database (replaces all USING(true) policies with real ownership
checks), adds authentication support, creates the analytics engine, transforms products
into rich publications with metadata, and adds favorites, reports, and admin tables.

## New Tables
1. `admins` — whitelist of admin user IDs (who can manage everything)
2. `analytics_events` — tracks every interaction (views, clicks, shares) for Conecta Analytics
3. `favorites` — user's saved businesses/products/events/jobs
4. `reports` — user-submitted reports for moderation (fake business, wrong info, etc.)

## Modified Tables
1. `businesses` — added `user_id` column (links business to its auth.users owner)
2. `products` — added publication metadata: category, expiresAt, tags, view/click/share counters
3. `jobs` — added `businessId` column (proper FK to businesses, nullable for general postings)

## New Functions
1. `is_admin()` — checks if current user is in admins table (SECURITY DEFINER, bypasses RLS)
2. `increment_stat(key)` — atomic stat increment, fixes the race condition in the old read-modify-write
3. `track_event(...)` — inserts an analytics event, callable by anon (SECURITY DEFINER)

## Security Changes (ALL tables)
- SELECT remains public on content tables (businesses, products, reviews, jobs, events, stats)
- INSERT/UPDATE/DELETE now require authentication + ownership OR admin status
- reviews: INSERT open to anon (anyone can review), DELETE admin-only
- cvs: INSERT open to anon (anyone can apply), SELECT/DELETE admin-only
- stats: SELECT public, modifications only via increment_stat() function
- analytics_events: INSERT via track_event() function, SELECT owner/admin only
- favorites: fully owner-scoped (authenticated only, user_id = auth.uid())
- reports: INSERT open to anon, SELECT/UPDATE/DELETE admin-only
- admins: SELECT own row only (user can check if they are admin)

## Important Notes
1. Existing businesses get user_id = NULL (orphaned). They remain visible (SELECT is public)
   but only admin can edit/delete them until an owner is assigned.
2. The user_id column on businesses defaults to auth.uid(), so new inserts from authenticated
   sessions automatically get the correct owner even if the frontend omits user_id.
3. The increment_stat() function is SECURITY DEFINER, so it bypasses RLS to update the stats
   table. The old read-modify-write pattern in the frontend must be replaced with an RPC call.
4. The track_event() function is SECURITY DEFINER, so anon users can insert analytics events
   via RPC even though the analytics_events table itself blocks anon INSERT.
5. Storage bucket policies are NOT changed in this migration (separate concern).
*/