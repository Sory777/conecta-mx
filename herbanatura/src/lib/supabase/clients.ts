import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env, serverEnv } from '@/lib/env';

/** Anonymous client for public, cacheable knowledge reads (RLS: public rules). */
export function anonClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Client bound to the visitor's session cookies (RLS: that user's permissions). */
export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS: only for cron jobs and account deletion. */
export function serviceClient(): SupabaseClient {
  if (!serverEnv.supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(env.supabaseUrl, serverEnv.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
