import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { sessionClient } from '@/lib/supabase/clients';

/** OAuth / magic-link callback: exchanges the code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/es/perfil';
  const safeNext = /^\/(es|en)(\/[\w\-/]*)?$/.test(next) ? next : '/es/perfil';
  if (code && isSupabaseConfigured()) {
    const db = await sessionClient();
    await db.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
