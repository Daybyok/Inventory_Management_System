import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '@/api/index';

interface AuthUser {
  id: number;
  username: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
  last_login?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  role: string | null;
  login: (creds: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const role = user?.role || null;
  const hasRole = (roles: string[]) => !!user && roles.includes(user.role);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const data = await api.getMe();
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (creds: { username: string; password: string }) => {
    try {
      const data = await api.login(creds);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, role, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
