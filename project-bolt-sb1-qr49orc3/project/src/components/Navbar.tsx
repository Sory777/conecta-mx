import { useState } from 'react';
import { Menu, X, Home, Store, Briefcase, QrCode, Shield, DollarSign, Calendar, BarChart3, LogOut, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Business } from '../lib/types';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';

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

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <button onClick={() => go('home')} className="flex items-center" aria-label="Inicio">
          <Logo size={36} showText />
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => go(l.route)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                current === l.route ? 'bg-[#0D47A1] text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <l.icon className="h-4 w-4" /> {l.label}
            </button>
          ))}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          ) : (
            <button
              onClick={() => go('login')}
              className="flex items-center gap-1.5 rounded-lg bg-[#1565C0] px-3 py-2 text-sm font-medium text-white hover:bg-[#0D47A1]"
            >
              <User className="h-4 w-4" /> Acceder
            </button>
          )}
        </nav>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Menú"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 py-2 md:hidden dark:border-slate-700 dark:bg-slate-800">
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => go(l.route)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                current === l.route ? 'bg-[#0D47A1] text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <l.icon className="h-4 w-4" /> {l.label}
            </button>
          ))}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          ) : (
            <button
              onClick={() => go('login')}
              className="flex w-full items-center gap-2 rounded-lg bg-[#1565C0] px-3 py-2.5 text-sm font-medium text-white"
            >
              <User className="h-4 w-4" /> Acceder
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
