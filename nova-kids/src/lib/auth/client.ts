"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuentas de cliente con Supabase Auth. Se activan al definir
 * NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
let client: SupabaseClient | null = null;

export function authEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function authClient(): SupabaseClient | null {
  if (!authEnabled()) return null;
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
