/*
# Create cvs table for job applicant CVs

1. New Tables
- `cvs`: stores applicant CVs submitted through the app
  - id (text PK)
  - fullName, email, phone, municipality
  - position (the role sought)
  - experience (text), education (text), skills (text)
  - jobId (text, references jobs, nullable for general CVs)
  - companyName (text, denormalized from job for display)
  - createdAt (bigint epoch ms)

2. Security
- Public app with no sign-in. anon + authenticated CRUD.
- RLS enabled. 4 policies per table.

3. Notes
- jobId is nullable so users can also submit a general CV not tied to a specific vacancy.
*/

CREATE TABLE IF NOT EXISTS cvs (
  id text PRIMARY KEY,
  "fullName" text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  municipality text NOT NULL,
  position text NOT NULL,
  experience text NOT NULL DEFAULT '',
  education text NOT NULL DEFAULT '',
  skills text NOT NULL DEFAULT '',
  "jobId" text REFERENCES jobs(id) ON DELETE SET NULL,
  "companyName" text,
  "createdAt" bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cvs" ON cvs;
CREATE POLICY "anon_select_cvs" ON cvs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_cvs" ON cvs;
CREATE POLICY "anon_insert_cvs" ON cvs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_cvs" ON cvs;
CREATE POLICY "anon_update_cvs" ON cvs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_cvs" ON cvs;
CREATE POLICY "anon_delete_cvs" ON cvs FOR DELETE
  TO anon, authenticated USING (true);
