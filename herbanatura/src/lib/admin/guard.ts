import 'server-only';
import { getSession, type SessionInfo } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { sessionClient } from '@/lib/supabase/clients';

export type AdminAccess =
  | { kind: 'demo' }
  | { kind: 'anonymous' }
  | { kind: 'forbidden'; session: SessionInfo }
  | { kind: 'staff'; session: SessionInfo };

export async function adminAccess(): Promise<AdminAccess> {
  if (!isSupabaseConfigured()) return { kind: 'demo' };
  const session = await getSession();
  if (!session.userId) return { kind: 'anonymous' };
  if (!session.staffRole) return { kind: 'forbidden', session };
  return { kind: 'staff', session };
}

/** For server actions: returns an authenticated DB client or throws. RLS still enforces every write. */
export async function requireStaff() {
  const access = await adminAccess();
  if (access.kind !== 'staff') throw new Error('No autorizado');
  return { db: await sessionClient(), session: access.session };
}
