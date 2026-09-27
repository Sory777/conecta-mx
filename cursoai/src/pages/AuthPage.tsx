import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { pendingRequest, useAuth } from '../lib/auth';
import { navigate } from '../lib/router';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = isRegister ? await api.register(email, password, name) : await api.login(email, password);
      setUser(r.user);
      const pending = pendingRequest.take();
      navigate(pending ? `/nuevo?q=${encodeURIComponent(pending)}` : '/', true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page flex justify-center">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">{isRegister ? 'Crea tu cuenta' : 'Entra a CursoAI'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister ? 'Guardaremos tu progreso para que continúes donde lo dejaste.' : 'Continúa donde lo dejaste.'}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate={false}>
          {isRegister && (
            <div>
              <label className="label" htmlFor="name">
                Nombre
              </label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={isRegister ? 8 : undefined}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              aria-describedby={isRegister ? 'pw-help' : undefined}
            />
            {isRegister && (
              <p id="pw-help" className="mt-1 text-xs text-slate-500">
                Mínimo 8 caracteres.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {isRegister ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <a className="font-semibold text-brand-700" href={isRegister ? '#/entrar' : '#/registro'}>
            {isRegister ? 'Entra' : 'Regístrate'}
          </a>
        </p>
      </div>
    </div>
  );
}
