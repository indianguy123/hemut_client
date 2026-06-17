'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getToken, setToken, removeToken, getStoredUser, setStoredUser, getAuthHeaders, StoredUser } from '@/lib/auth';
import { xhrGet } from '@/lib/xhr';
import { API } from '@/lib/constants';

interface AuthContextType {
  user: StoredUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: StoredUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const savedToken = getToken();
    const savedUser = getStoredUser();
    if (savedToken && savedUser) {
      setTokenState(savedToken);
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: StoredUser) => {
    setToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) return;

    try {
      const { promise } = xhrGet<StoredUser>(API.ME, getAuthHeaders());
      const response = await promise;
      setUser(response.data);
      setStoredUser(response.data);
    } catch {
      // Token might be expired
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
