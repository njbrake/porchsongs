import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '@/api';
import type { AuthConfig, AuthUser } from '@/types';
import { isPremiumAuth } from '@/extensions';

type AuthState = 'loading' | 'login' | 'ready';

interface AuthContextValue {
  authState: AuthState;
  authConfig: AuthConfig | null;
  currentAuthUser: AuthUser | null;
  isPremium: boolean;
  handleLogin: (user: AuthUser) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [currentAuthUser, setCurrentAuthUser] = useState<AuthUser | null>(null);

  const isPremium = isPremiumAuth(authConfig);

  // Check auth requirement on mount
  useEffect(() => {
    api.getAuthConfig()
      .then((config) => {
        setAuthConfig(config);
        if (!config.required) {
          setAuthState('ready');
        } else {
          api.tryRestoreSession().then((user) => {
            if (user) {
              setCurrentAuthUser(user);
              setAuthState('ready');
            } else {
              setAuthState('login');
            }
          });
        }
      })
      .catch(() => {
        setAuthState('ready');
      });
  }, []);

  // Listen for logout events (e.g. 401 from expired/changed token)
  useEffect(() => {
    const handler = () => {
      if (authConfig?.required) {
        api.logout();
        setCurrentAuthUser(null);
        setAuthState('login');
      }
    };
    window.addEventListener('porchsongs-logout', handler);
    return () => window.removeEventListener('porchsongs-logout', handler);
  }, [authConfig]);

  const handleLogout = useCallback(() => {
    api.logout();
    setCurrentAuthUser(null);
    setAuthState('login');
  }, []);

  const handleLogin = useCallback((user: AuthUser) => {
    setCurrentAuthUser(user);
    setAuthState('ready');
  }, []);

  return (
    <AuthContext value={{
      authState,
      authConfig,
      currentAuthUser,
      isPremium,
      handleLogin,
      handleLogout,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
