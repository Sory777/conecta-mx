import { useState } from 'react';
import { Menu, X, Home, Store, Briefcase, QrCode, Shield, DollarSign, Calendar, BarChart3, LogOut, User, Sun, Moon } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Business } from '../lib/types';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';

interface NavbarProps {
  current: string;
  onNavigate: (route: string) => void;
  user: SupabaseUser | null;
  business: Business | null;
  isAdmin: boolean;
  onSignOut: () => void;
}

export function Navbar({ current, onNavigate, user, business, isAdmin, onSignOut }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const go = (r: string) => {
    onNavigate(r);
    setOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
    onNavigate('home');
    setOpen(false);
  };

  const baseLinks = [
    { route: 'home', label: 'Inicio', icon: Home },
    { route: 'directory', label: 'Directorio', icon: Store },
    { route: 'jobs', label: 'Empleo', icon: Briefcase },
    { route: 'events', label: 'Eventos', icon: Calendar },
    { route: 'qr', label: 'QR', icon: QrCode },
    { route: 'plans', label: 'Planes', icon: DollarSign },
  ];

  const links = isAdmin
    ? [...baseLinks, { route: 'admin', label: 'Admin', icon: Shield }]
    : user && business
    ? [...baseLinks.slice(0, 5), { route: 'dashboard', label: 'Mi Panel', icon: BarChart3 }, { route: 'plans', label: 'Planes', icon: DollarSign }]
    : baseLinks;

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="rounded p-2 text-muted transition-colors hover:bg-surface-soft hover:text-ink dark:hover:text-ink-invert"
      aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <button onClick={() => go('home')} className="flex items-center" aria-label="Inicio">
          <Logo size={36} showText />
        </button>
        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => go(l.route)}
              className={`relative flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors ${
                current === l.route ? 'text-gold' : 'text-muted hover:text-ink dark:hover:text-ink-invert'
              }`}
            >
              <l.icon className="h-4 w-4" /> {l.label}
              {current === l.route && <span className="absolute inset-x-2 -bottom-[9px] h-px bg-gold" />}
            </button>
          ))}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-muted hover:text-ink dark:hover:text-ink-invert"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          ) : (
            <button onClick={() => go('login')} className="btn-primary ml-2 px-3 py-2 text-sm">
              <User className="h-4 w-4" /> Acceder
            </button>
          )}
          <span className="ml-1 border-l border-line pl-1">
            <ThemeToggle />
          </span>
        </nav>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded p-2 text-muted hover:bg-surface-soft hover:text-ink dark:hover:text-ink-invert"
            aria-label="Menú"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface px-4 py-2 md:hidden">
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => go(l.route)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2.5 text-sm font-medium ${
                current === l.route ? 'text-gold' : 'text-muted hover:text-ink dark:hover:text-ink-invert'
              }`}
            >
              <l.icon className="h-4 w-4" /> {l.label}
            </button>
          ))}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-sm font-medium text-muted hover:text-ink dark:hover:text-ink-invert"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          ) : (
            <button onClick={() => go('login')} className="btn-primary mt-1 w-full text-sm">
              <User className="h-4 w-4" /> Acceder
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
