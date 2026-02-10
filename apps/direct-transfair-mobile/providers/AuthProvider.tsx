// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter, useSegments } from "expo-router";
import { api } from "../services/api";
import type { AuthUser, LoginPayload, RegisterPayload, LoginResponse } from "../services/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload, tenantCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "dt_token";
const USER_KEY = "dt_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  // --- STORAGE HELPERS ---
  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") {
      try { localStorage.setItem(key, val); } catch {}
    } else {
      await SecureStore.setItemAsync(key, val);
    }
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") {
      try { localStorage.removeItem(key); } catch {}
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === "web") {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return await SecureStore.getItemAsync(key);
  };

  // --- LOGOUT ---
  const logout = async () => {
    try {
      console.log("👋 Déconnexion...");
      api.clearToken();
      setToken(null);
      setUser(null);
      await removeStorage(TOKEN_KEY);
      await removeStorage(USER_KEY);
      router.replace("/(auth)/login");
    } catch (e) {
      console.error("Erreur logout", e);
    }
  };

  // --- INIT SESSION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);

        if (storedToken && storedUser) {
          api.setToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          try {
            const me = await api.getMe();
            setUser(me);
            await setStorage(USER_KEY, JSON.stringify(me));
          } catch {
            console.log("Session expirée");
            await logout();
          }
        }
      } catch (e) {
        console.log("Erreur init auth", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // --- ROUTE GUARD ---
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments]);

  // --- LOGIN ---
  const login = async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      const res: LoginResponse = await api.login(data);

      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
    } catch (e: any) {
      console.error("Erreur Login:", e?.response?.data || e?.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ REGISTER FIXÉ
  const register = async (data: RegisterPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        tenantCode,
      };

      await api.register(payload);
      await login({ email: data.email, password: data.password });
    } catch (e: any) {
      console.error("Erreur Register:", e?.response?.data || e?.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- REFRESH USER ---
  const refreshUser = async () => {
    try {
      if (!token) return;

      api.setToken(token);

      const updatedUser = await api.getMe();

      setUser(updatedUser);
      await setStorage(USER_KEY, JSON.stringify(updatedUser));
    } catch (e) {
      console.log("Erreur refresh user", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refreshUser }}
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
