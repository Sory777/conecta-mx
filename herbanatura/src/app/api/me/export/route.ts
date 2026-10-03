import { isSupabaseConfigured } from '@/lib/env';
import { rateLimit } from '@/lib/security/rate-limit';
import { sessionClient } from '@/lib/supabase/clients';

/** Export every cloud row belonging to the signed-in user (RLS restricts to own rows). */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'account');
  if (limited) return limited;
  if (!isSupabaseConfigured()) return Response.json({ error: 'accounts_disabled' }, { status: 404 });
  const db = await sessionClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const tables = ['profiles', 'favorites', 'search_history', 'collections', 'collection_items', 'saved_studies', 'user_alerts', 'health_profiles', 'ai_queries', 'subscriptions'];
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), user: { id: auth.user.id, email: auth.user.email } };
  for (const t of tables) out[t] = (await db.from(t).select('*')).data ?? [];
  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="herbanatura-export.json"', 'Cache-Control': 'no-store' },
  });
}
