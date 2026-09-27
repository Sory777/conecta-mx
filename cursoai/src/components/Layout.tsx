import type { ReactNode } from 'react';
import { BarChart3, BookOpen, Home, LogOut, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { navigate, type Route } from '../lib/router';

const TABS = [
  { href: '/', label: 'Inicio', icon: Home, match: ['home', 'new'] },
  { href: '/cursos', label: 'Mis cursos', icon: BookOpen, match: ['library', 'course', 'plan', 'diagnosis', 'lesson', 'quiz', 'tutor', 'project'] },
  { href: '/progreso', label: 'Progreso', icon: BarChart3, match: ['progress'] },
  { href: '/perfil', label: 'Perfil', icon: User, match: ['profile'] },
];

export function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2 font-bold text-slate-900" aria-label="CursoAI, inicio">
      <img src="/icon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg tracking-tight">
        Curso<span className="text-brand-600">AI</span>
      </span>
    </a>
  );
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { user, logout } = useAuth();
  const active = (m: string[]) => m.includes(route.name);
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          {user ? (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
              {TABS.map((t) => (
                <a
                  key={t.href}
                  href={`#${t.href}`}
                  aria-current={active(t.match) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${active(t.match) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {t.label}
                </a>
              ))}
              <button
                className="ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </nav>
          ) : (
            <div className="flex gap-2">
              <a href="#/entrar" className="btn-ghost">
                Entrar
              </a>
              <a href="#/registro" className="btn-primary hidden sm:inline-flex">
                Crear cuenta
              </a>
            </div>
          )}
        </div>
      </header>
      <main id="main">{children}</main>
      {user && (
        <nav
          className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Principal"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = active(t.match);
            return (
              <a
                key={t.href}
                href={`#${t.href}`}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-brand-700' : 'text-slate-500'}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t.label}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
