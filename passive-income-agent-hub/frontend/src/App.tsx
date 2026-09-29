import { FormEvent, useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Bell, Bot, FlaskConical, History, LayoutDashboard, LogOut, Search, Settings as Cog, Wallet } from 'lucide-react';
import { api, User } from './api';
import { ErrorBox, Field, MetaProvider } from './components/ui';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import OpportunityDetail from './pages/OpportunityDetail';
import Experiments from './pages/Experiments';
import ExperimentDetail from './pages/ExperimentDetail';
import Finance from './pages/Finance';
import Agents from './pages/Agents';
import Alerts from './pages/Alerts';
import Decisions from './pages/Decisions';
import SettingsPage from './pages/Settings';

const NAV = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/oportunidades', 'Oportunidades', Search],
  ['/experimentos', 'Experimentos', FlaskConical],
  ['/finanzas', 'Ingresos y gastos', Wallet],
  ['/agentes', 'Agentes', Bot],
  ['/decisiones', 'Historial de decisiones', History],
  ['/alertas', 'Alertas', Bell],
  ['/configuracion', 'Configuración', Cog],
] as const;

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [status, setStatus] = useState<{ has_users: boolean; registration_open: boolean } | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<{ has_users: boolean; registration_open: boolean }>('/auth/status').then((s) => {
      setStatus(s);
      if (!s.has_users) setMode('register');
    });
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      onLogin(await api.post<User>(`/auth/${mode}`, { email, password }));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Passive Income Agent Hub</h1>
          <p className="text-xs text-slate-400">
            Central escéptica de agentes para investigar y medir ingresos complementarios. Sin promesas: solo datos.
          </p>
        </div>
        {status && !status.has_users && (
          <p className="rounded bg-sky-950 p-2 text-xs text-sky-200">Primer uso: crea la cuenta de administrador.</p>
        )}
        <Field label="Correo">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={mode === 'register' ? 'Contraseña (mínimo 10 caracteres)' : 'Contraseña'}>
          <input className="input" type="password" required minLength={mode === 'register' ? 10 : 1} value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full justify-center">{mode === 'register' ? 'Crear cuenta' : 'Entrar'}</button>
        {status?.has_users && status.registration_open && (
          <button type="button" className="w-full text-xs text-slate-400 underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
          </button>
        )}
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get<User>('/auth/me').then(setUser).catch(() => setUser(null));
    const onUnauth = () => setUser(null);
    window.addEventListener('pih:unauthorized', onUnauth);
    return () => window.removeEventListener('pih:unauthorized', onUnauth);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => api.get<unknown[]>('/alerts?unread=true').then((a) => setUnread(a.length)).catch(() => undefined);
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user]);

  if (user === undefined) return <div className="p-8 text-slate-400">Cargando…</div>;
  if (user === null) return <Login onLogin={setUser} />;

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <MetaProvider>
        <div className="min-h-screen text-slate-100 lg:flex">
          <aside className="border-b border-slate-800 bg-slate-950 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="px-4 py-4">
              <div className="text-sm font-bold text-emerald-400">Passive Income Agent Hub</div>
              <div className="text-[11px] text-slate-500">Datos observados &gt; promesas</div>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
              {NAV.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
                  <Icon size={16} />
                  <span>{label}</span>
                  {to === '/alertas' && unread > 0 && (
                    <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-[10px] font-bold">{unread}</span>
                  )}
                </NavLink>
              ))}
              <button onClick={logout} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-300 lg:mt-4">
                <LogOut size={16} /> Salir
              </button>
            </nav>
          </aside>
          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/oportunidades" element={<Opportunities />} />
              <Route path="/oportunidades/:id" element={<OpportunityDetail />} />
              <Route path="/experimentos" element={<Experiments />} />
              <Route path="/experimentos/:id" element={<ExperimentDetail />} />
              <Route path="/finanzas" element={<Finance />} />
              <Route path="/agentes" element={<Agents />} />
              <Route path="/decisiones" element={<Decisions />} />
              <Route path="/alertas" element={<Alerts onChange={setUnread} />} />
              <Route path="/configuracion" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </MetaProvider>
    </BrowserRouter>
  );
}
