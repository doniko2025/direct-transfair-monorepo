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
  login: (data: LoginPayload, tenantCode?: string) => Promise<void>;
  register: (data: RegisterPayload, tenantCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "dt_token";
const USER_KEY = "dt_user";
const TENANT_KEY = "dt_tenant";

function normalizeTenant(input?: string | null): string | null {
  const t = (input ?? "").trim().toUpperCase();
  return t.length > 0 ? t : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, val);
      } catch (e) {
        console.error("LocalStorage error", e);
      }
    } else {
      await SecureStore.setItemAsync(key, val);
    }
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {
        // noop
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return await SecureStore.getItemAsync(key);
  };

  const logout = async () => {
    try {
      console.log("👋 [AuthProvider] Déconnexion...");

      api.clearToken();
      api.setTenant("DONIKO");

      setToken(null);
      setUser(null);

      await removeStorage(TOKEN_KEY);
      await removeStorage(USER_KEY);
      await removeStorage(TENANT_KEY);

      router.replace("/(auth)/login");
    } catch (e) {
      console.error("Erreur critique logout", e);
      setUser(null);
      router.replace("/(auth)/login");
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);
        const storedTenant = await getStorage(TENANT_KEY);

        const restoredTenant = normalizeTenant(storedTenant) ?? "DONIKO";
        api.setTenant(restoredTenant);

        if (storedToken && storedUser) {
          console.log("🔑 Token trouvé (Restoration session)...");
          api.setToken(storedToken);
          setToken(storedToken);

          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setUser(parsedUser);

          try {
            const me = await api.getMe();
            setUser(me);
            await setStorage(USER_KEY, JSON.stringify(me));
          } catch (err: any) {
            console.log("⚠️ Session expirée ou invalide:", err?.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments, router]);

  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      const inputTenant = normalizeTenant(tenantCode);

      // 1) On laisse passer le login même sans tenant (super-admin / auto-detect)
      // NB: si ton backend exige x-tenant-id même sur /auth/login, garde DONIKO ici.
      if (inputTenant) api.setTenant(inputTenant);

      const res: LoginResponse = await api.login(data, inputTenant ?? undefined);

      // 2) Token
      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      // 3) ✅ Résolution tenant définitive
      // - si code fourni => on le garde
      // - sinon => on prend user.client.code (retourné par le backend)
      const tenantFromUser = normalizeTenant(res.user.client?.code);
      const finalTenant =
        inputTenant ??
        tenantFromUser ??
        (res.user.role === "SUPER_ADMIN" ? "DONIKO" : null);

      if (!finalTenant) {
        // Compte société sans code et backend ne renvoie pas client.code
        throw new Error(
          "Code Société requis pour ce compte (impossible de déduire la société)."
        );
      }

      api.setTenant(finalTenant);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
      await setStorage(TENANT_KEY, finalTenant);

      // 4) Rafraîchir user (solde, etc.) avec le bon tenant
      try {
        const me = await api.getMe();
        setUser(me);
        await setStorage(USER_KEY, JSON.stringify(me));
      } catch (err: any) {
        await logout();
        throw err;
      }
    } catch (e: any) {
      console.error("Erreur Login:", e?.response?.data || e?.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      const inputTenant = normalizeTenant(tenantCode) ?? "DONIKO";
      api.setTenant(inputTenant);

      await api.register({ ...data, tenantCode: inputTenant });
      await login({ email: data.email, password: data.password }, inputTenant);
    } catch (e: any) {
      console.error("Erreur Register:", e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      if (token) {
        // ✅ Toujours resynchroniser le token dans l'API (plus fiable que defaults.headers)
        api.setToken(token);
      }
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      await setStorage(USER_KEY, JSON.stringify(updatedUser));
      console.log("🔄 User rafraîchi via API, nouveau solde :", updatedUser.balance);
    } catch (e) {
      console.log("Impossible de rafraîchir l'utilisateur", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
