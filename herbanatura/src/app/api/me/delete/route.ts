import { isSupabaseConfigured } from '@/lib/env';
import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/security/rate-limit';
import { serviceClient, sessionClient } from '@/lib/supabase/clients';

/** Permanently delete the signed-in account. All user tables cascade from auth.users. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'account');
  if (limited) return limited;
  if (!isSupabaseConfigured()) return Response.json({ error: 'accounts_disabled' }, { status: 404 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) return Response.json({ error: 'forbidden' }, { status: 403 });
  const db = await sessionClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await serviceClient().auth.admin.deleteUser(auth.user.id);
  if (error) return Response.json({ error: 'delete_failed' }, { status: 500 });
  await db.auth.signOut();
  log.info('account_deleted');
  return Response.json({ deleted: true });
}
