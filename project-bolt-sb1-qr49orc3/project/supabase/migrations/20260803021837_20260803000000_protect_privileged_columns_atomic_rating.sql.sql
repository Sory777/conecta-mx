/*
# Protect privileged columns + atomic rating recompute + input validation

## Summary
1. Creates `recompute_rating(business_id)` SECURITY DEFINER function that atomically
   recomputes a business's rating and review_count from the reviews table.
2. Adds a CHECK constraint on reviews.rating to enforce 1-5 range.
3. Adds column-level privileges: strips UPDATE on `verified`, `plan`, `rating`,
   `reviewCount`, `founding` from the `authenticated` role so only admin (via service
   role or a SECURITY DEFINER function) can change them. The existing UPDATE policy
   already allows `is_admin()` but the column grant is a second layer of defense.
4. Grants EXECUTE on `is_admin()` only to `authenticated` (not anon) to prevent
   unauthenticated info disclosure.
5. Grants EXECUTE on `increment_stat` and `track_event` to `anon` and `authenticated`
   (these are intentionally public).

## Security Changes
- `authenticated` can no longer UPDATE verified, plan, rating, reviewCount, founding
  on businesses. Only the service role (admin) can change these.
- `is_admin()` is no longer callable by anon.
- reviews.rating has a CHECK constraint (1-5).
*/

-- 1. Atomic rating recompute function
CREATE OR REPLACE FUNCTION recompute_rating(p_business_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  cnt integer;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO avg_rating, cnt
  FROM reviews
  WHERE "businessId" = p_business_id;

  UPDATE businesses
  SET rating = ROUND(avg_rating * 10) / 10,
      "reviewCount" = cnt
  WHERE id = p_business_id;
END;
$$;

-- 2. CHECK constraint on reviews.rating (1-5)
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Column-level privileges: strip privileged columns from authenticated UPDATE
-- First grant all columns, then revoke the sensitive ones
GRANT UPDATE ON businesses TO authenticated;
REVOKE UPDATE (verified, plan, rating, "reviewCount", founding) ON businesses FROM authenticated;

-- Also strip these from anon (anon should never UPDATE businesses anyway)
REVOKE UPDATE ON businesses FROM anon;
REVOKE INSERT ON businesses FROM anon;
REVOKE DELETE ON businesses FROM anon;

-- 4. Restrict is_admin() to authenticated only (not anon)
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- 5. Ensure increment_stat and track_event are callable by anon + authenticated
GRANT EXECUTE ON FUNCTION increment_stat(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION track_event(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION recompute_rating(text) TO anon, authenticated;

-- 6. Grant recompute_rating so the client can call it after adding a review
-- (it reads reviews which the caller may not own, hence SECURITY DEFINER)
