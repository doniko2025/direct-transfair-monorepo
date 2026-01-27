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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  // ✅ CORRECTION 1 : Gestion explicite du Storage WEB vs MOBILE
  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") {
        try { localStorage.setItem(key, val); } catch (e) { console.error("LocalStorage error", e); }
    } else {
        await SecureStore.setItemAsync(key, val);
    }
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") {
        try { localStorage.removeItem(key); } catch (e) {}
    } else {
        await SecureStore.deleteItemAsync(key);
    }
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === "web") {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    } else {
        return await SecureStore.getItemAsync(key);
    }
  };

  // ✅ LOGOUT
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

  // ✅ INITIALISATION AU DÉMARRAGE (CRUCIAL POUR LE WEB)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);
        const storedTenant = await getStorage(TENANT_KEY);

        // 1. Restaurer le Tenant
        if (storedTenant) api.setTenant(storedTenant);
        else api.setTenant("DONIKO");

        // 2. Restaurer le Token et l'injecter dans l'API
        if (storedToken && storedUser) {
          console.log("🔑 Token trouvé (Restoration session)...");
          
          // C'EST ICI QUE CA SE JOUE : On donne le token à Axios immédiatement
          api.setToken(storedToken); 
          setToken(storedToken);
          
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setUser(parsedUser);

          // 3. Vérifier si le token est encore valide
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
  }, []);

  // Protection des routes
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments]);

  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      const codeToUse = tenantCode && tenantCode.trim().length > 0 ? tenantCode.trim().toUpperCase() : "DONIKO";
      
      // 1. Configurer l'API
      api.setTenant(codeToUse);
      const res: LoginResponse = await api.login(data, codeToUse);

      // 2. Sauvegarder Token dans l'instance API
      api.setToken(res.access_token);
      
      // 3. Sauvegarder dans le State React
      setToken(res.access_token);
      setUser(res.user);

      // 4. Persister (Web ou Mobile)
      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
      await setStorage(TENANT_KEY, codeToUse);

      // 5. Rafraîchir pour être sûr d'avoir le bon solde
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
      const codeToUse = tenantCode && tenantCode.trim().length > 0 ? tenantCode.trim().toUpperCase() : "DONIKO";
      api.setTenant(codeToUse);
      await api.register({ ...data, tenantCode: codeToUse } as any);
      await login({ email: data.email, password: data.password }, codeToUse);
    } catch (e: any) {
        console.error("Erreur Register:", e);
        throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      // ✅ Si pas de token dans l'API, on tente de le remettre depuis le state
      if (!api.http.defaults.headers["Authorization"] && token) {
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