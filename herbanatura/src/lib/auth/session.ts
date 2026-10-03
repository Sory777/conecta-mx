import 'server-only';
import { isSupabaseConfigured, serverEnv } from '@/lib/env';
import { canUse, type Feature, type Plan } from '@/lib/plans';
import { sessionClient } from '@/lib/supabase/clients';

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  plan: Plan;
  staffRole: 'editor' | 'reviewer' | 'admin' | null;
}

const ANON: SessionInfo = { userId: null, email: null, plan: 'free', staffRole: null };

export async function getSession(): Promise<SessionInfo> {
  if (!isSupabaseConfigured()) return ANON;
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return ANON;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle(),
  ]);
  return { userId: user.id, email: user.email ?? null, plan: (profile?.plan as Plan) ?? 'free', staffRole: (staff?.role as SessionInfo['staffRole']) ?? null };
}

export async function hasFeature(feature: Feature): Promise<boolean> {
  if (!serverEnv.premiumEnforced) return true;
  const s = await getSession();
  return canUse(feature, s.plan, true);
}
