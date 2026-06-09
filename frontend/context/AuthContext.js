'use client';

/**
 * CipherVault — Auth Context
 * Provides authentication state and methods to all components.
 * Works seamlessly in both live (backend) and demo (localStorage) modes.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, isDemoMode } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Small delay to let demo mode detection complete
      await new Promise(r => setTimeout(r, 500));

      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await authAPI.getProfile();
          setUser(res.data);
          setIsAuthenticated(true);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { access_token, refresh_token } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    const profileRes = await authAPI.getProfile();
    setUser(profileRes.data);
    setIsAuthenticated(true);
    return profileRes.data;
  }, []);

  const register = useCallback(async (email, username, password) => {
    await authAPI.register({ email, username, password });
    return login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('cv_demo_current_user');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
