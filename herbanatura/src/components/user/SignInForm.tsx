'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { useI18n } from '@/components/layout/Providers';

export function SignInForm() {
  const { locale } = useI18n();
  const es = locale === 'es';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const db = browserClient();

  useEffect(() => {
    db.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user)
    return (
      <div className="space-y-4">
        <p>{es ? 'Sesión iniciada como' : 'Signed in as'} <strong>{user}</strong></p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/me/export" className="rounded-lg border border-border px-4 py-2 text-sm">⬇️ {es ? 'Exportar datos de mi cuenta' : 'Export my account data'}</a>
          <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={async () => { await db.auth.signOut(); setUser(null); }}>{es ? 'Cerrar sesión' : 'Sign out'}</button>
          <button
            className="rounded-lg border border-danger px-4 py-2 text-sm text-danger"
            onClick={async () => {
              if (!confirm(es ? '¿Eliminar tu cuenta y todos sus datos de forma permanente?' : 'Permanently delete your account and all its data?')) return;
              const r = await fetch('/api/me/delete', { method: 'POST' });
              setMsg(r.ok ? (es ? 'Cuenta eliminada.' : 'Account deleted.') : es ? 'No se pudo eliminar.' : 'Could not delete.');
              if (r.ok) setUser(null);
            }}
          >
            🗑️ {es ? 'Eliminar cuenta' : 'Delete account'}
          </button>
        </div>
        <p role="status" className="text-sm">{msg}</p>
      </div>
    );

  const redirectTo = () => `${window.location.origin}/auth/callback?next=/${locale}/perfil`;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg('');
        const { error } = password
          ? await db.auth.signInWithPassword({ email, password })
          : await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
        if (error) setMsg(error.message);
        else if (password) window.location.href = `/${locale}/perfil`;
        else setMsg(es ? 'Revisa tu correo: te enviamos un enlace de acceso.' : 'Check your email for a sign-in link.');
      }}
    >
      <label className="block text-sm">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" /></label>
      <label className="block text-sm">{es ? 'Contraseña (opcional: vacío = enlace mágico)' : 'Password (optional: empty = magic link)'}<input type="password" autoComplete="current-password" minLength={password ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" /></label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">{es ? 'Entrar' : 'Sign in'}</button>
        <button type="button" className="rounded-lg border border-border px-4 py-2" onClick={async () => {
          const { error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
          setMsg(error ? error.message : es ? 'Cuenta creada: confirma tu correo.' : 'Account created: confirm your email.');
        }}>{es ? 'Crear cuenta' : 'Create account'}</button>
      </div>
      <p role="status" className="text-sm">{msg}</p>
    </form>
  );
}
