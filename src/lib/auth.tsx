import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrf } from './api';

export type Role = 'client' | 'staff' | 'admin';
export interface SessionUser { id: number; email: string; name: string; role: Role }

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  demoMode: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  register: (body: { name: string; email: string; password: string; phone?: string }) => Promise<SessionUser>;
  demoSignIn: (role: Role) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser | null; csrfToken: string | null; demoMode: boolean }>('/api/auth/me');
      setUser(me.user);
      setCsrf(me.csrfToken);
      setDemoMode(me.demoMode);
    } catch {
      setUser(null);
      setCsrf(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const accept = (r: { user: SessionUser; csrfToken: string }) => {
    setCsrf(r.csrfToken);
    setUser(r.user);
    return r.user;
  };

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    demoMode,
    refresh,
    signIn: async (email, password) => accept(await api('/api/auth/login', { body: { email, password } })),
    register: async (body) => accept(await api('/api/auth/register', { body })),
    demoSignIn: async (role) => accept(await api('/api/auth/demo', { body: { role } })),
    signOut: async () => {
      await api('/api/auth/logout', { body: {} }).catch(() => undefined);
      setCsrf(null);
      setUser(null);
    },
  }), [user, loading, demoMode, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
