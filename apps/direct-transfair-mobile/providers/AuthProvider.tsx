// apps/direct-transfair-mobile/providers/AuthProvider.tsx
// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "../services/api";
import type { AuthUser, LoginPayload, RegisterPayload, LoginResponse } from "../services/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  // ✅ UPDATE: Accepte tenantCode
  login: (data: LoginPayload, tenantCode?: string) => Promise<void>; 
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "dt_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // --- HELPER STORAGE ---
  const setStorage = async (val: string) => {
    if (Platform.OS === 'web') localStorage.setItem(TOKEN_KEY, val);
    else await SecureStore.setItemAsync(TOKEN_KEY, val);
  };
  
  const removeStorage = async () => {
    if (Platform.OS === 'web') localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  };

  const getStorage = async () => {
    if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  };

  // --- BOOTSTRAP ---
  useEffect(() => {
    const bootstrap = async () => {
      try {
        api.setTenant("DONIKO"); // Défaut
        const stored = await getStorage();
        
        if (stored) {
          setToken(stored);
          api.setToken(stored);
          const me = await api.getMe();
          setUser(me);
        }
      } catch (error) {
        console.log("Session expirée");
        await logout();
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  // --- ACTIONS ---

  // ✅ Login mis à jour pour accepter tenantCode
  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      // On passe le tenantCode à l'API
      const res: LoginResponse = await api.login(data, tenantCode);
      const accessToken = res.access_token;

      setToken(accessToken);
      api.setToken(accessToken);
      await setStorage(accessToken);

      const me = await api.getMe();
      setUser(me);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterPayload) => {
    setIsLoading(true);
    try {
      await api.register(data);
      await login({ email: data.email, password: data.password });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await removeStorage();
    api.clearToken();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const updatedUser = await api.getMe();
      setUser(updatedUser);
    } catch (e) {
      console.error("Erreur refreshUser", e);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, token, loading, isLoading, 
        isAuthenticated: !!user, 
        login, register, logout, refreshUser 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};