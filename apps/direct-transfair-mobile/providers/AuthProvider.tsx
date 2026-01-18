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
  register: (data: RegisterPayload, tenantCode?: string) => Promise<void>; // ✅ Signature mise à jour
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "dt_token";
const USER_KEY = "dt_user";
const TENANT_KEY = "dt_tenant";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") localStorage.setItem(key, val);
    else await SecureStore.setItemAsync(key, val);
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  };

  const logout = async () => {
    try {
      console.log("👋 [AuthProvider] Déconnexion...");
      api.clearToken();
      api.setTenant("DONIKO"); // Reset au défaut
      setToken(null);
      setUser(null);
      await removeStorage(TOKEN_KEY);
      await removeStorage(USER_KEY);
      await removeStorage(TENANT_KEY);
    } catch (e) {
      console.error("Erreur lors du logout", e);
    }
  };

  // --- INITIALISATION AU DÉMARRAGE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);
        const storedTenant = await getStorage(TENANT_KEY);

        // Restaure tenant
        if (storedTenant) {
          api.setTenant(storedTenant);
          console.log("🏢 [AuthProvider] Tenant restauré:", storedTenant);
        } else {
          api.setTenant("DONIKO");
          console.log("ℹ️ [AuthProvider] Pas de tenant stocké, utilisation par défaut (DONIKO)");
        }

        // Restaure session si possible
        if (storedToken && storedUser) {
          api.setToken(storedToken);
          setToken(storedToken);

          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setUser(parsedUser);

          // ✅ IMPORTANT: on ATTEND la vérification /auth/me pour éviter user "fantôme"
          try {
            const me = await api.getMe();
            setUser(me);
            await setStorage(USER_KEY, JSON.stringify(me));
          } catch (err: any) {
            console.log("⚠️ [AuthProvider] Session invalide au démarrage:", err?.response?.data || err?.message);
            await logout();
          }
        }
      } catch (e) {
        console.log("❌ [AuthProvider] Erreur chargement session", e);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- PROTECTION DES ROUTES ---
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments, router]);

  // --- LOGIN ---
  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      const codeToUse =
        tenantCode && tenantCode.trim().length > 0 ? tenantCode.trim().toUpperCase() : "DONIKO";

      api.setTenant(codeToUse);
      console.log(`🔐 [AuthProvider] Tentative de connexion sur le Tenant: "${codeToUse}"`);

      const res: LoginResponse = await api.login(data, codeToUse);

      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
      await setStorage(TENANT_KEY, codeToUse);

      // ✅ Optionnel mais utile: check immédiat (si tenant middleware bloque, tu le sauras tout de suite)
      try {
        const me = await api.getMe();
        setUser(me);
        await setStorage(USER_KEY, JSON.stringify(me));
      } catch (err: any) {
        console.log("⚠️ [AuthProvider] Login OK mais /me KO (tenant/token):", err?.response?.data || err?.message);
        await logout();
        throw err;
      }
    } catch (e: any) {
      console.error("❌ [AuthProvider] Erreur Login:", e?.response?.data || e?.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- REGISTER (Mise à jour) ---
  const register = async (data: RegisterPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      // 1. Définir le Tenant AVANT la requête d'inscription
      const codeToUse = tenantCode && tenantCode.trim().length > 0 ? tenantCode.trim().toUpperCase() : "DONIKO";
      api.setTenant(codeToUse);
      console.log(`📝 [AuthProvider] Inscription sur le Tenant: "${codeToUse}"`);

      // 2. Appel API Register
      // On passe aussi le tenantCode dans le body si le backend le demande explicitement
      await api.register({ ...data, tenantCode: codeToUse });

      // 3. Connexion automatique après inscription
      await login({ email: data.email, password: data.password }, codeToUse);
      
    } catch (e: any) {
        console.error("❌ Erreur Register:", e);
        throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      await setStorage(USER_KEY, JSON.stringify(updatedUser));
      console.log("🔄 [AuthProvider] Profil mis à jour");
    } catch (e) {
      console.log("⚠️ Impossible de rafraîchir l'utilisateur", e);
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