import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { storage } from './storage';
import type { Business } from './types';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase.from('businesses').select('*').eq('user_id', session.user.id).maybeSingle();
        if (active && data) setBusiness(data as Business);
        const adminStatus = await storage.isAdmin().catch(() => false);
        if (active) setIsAdmin(adminStatus);
      }
      if (active) setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setBusiness(null);
          setIsAdmin(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session.user);
          const { data } = await supabase.from('businesses').select('*').eq('user_id', session.user.id).maybeSingle();
          setBusiness(data as Business | null);
          const adminStatus = await storage.isAdmin().catch(() => false);
          setIsAdmin(adminStatus);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setBusiness(null);
    setIsAdmin(false);
  };

  const refreshBusiness = async () => {
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id).maybeSingle();
    setBusiness(data as Business | null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, isAdmin, signUp, signIn, signOut, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
