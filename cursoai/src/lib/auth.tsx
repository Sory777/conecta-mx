import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDTO } from '../../shared/types';
import { api } from './api';

interface AuthCtx {
  user: UserDTO | null;
  loading: boolean;
  setUser: (u: UserDTO | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, setUser, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

// A learning goal typed before signing in survives the sign-up step.
const PENDING_KEY = 'cursoai.pendingRequest';
export const pendingRequest = {
  set: (q: string) => {
    try {
      sessionStorage.setItem(PENDING_KEY, q);
    } catch {
      /* storage unavailable */
    }
  },
  take: (): string | null => {
    try {
      const v = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      return v;
    } catch {
      return null;
    }
  },
};
