import { createClient } from '@supabase/supabase-js';

// Fallback defaults: Supabase's anon key is a public, non-secret credential
// designed to ship in client bundles (access is enforced by Postgres RLS
// policies, not by keeping this key hidden). Hardcoding it here avoids
// depending on the hosting platform's env-var UI at build time.
const DEFAULT_URL = 'https://yjiuewwziebheojbdsut.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqaXVld3d6aWViaGVvamJkc3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTUzMTUsImV4cCI6MjEwMTgzMTMxNX0.f0dhWjs9UNCIHk1HQcUQ7vwErgV0sEazZdAi8loXZtU';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_ANON_KEY;

export const supabase = createClient(url, anonKey);
