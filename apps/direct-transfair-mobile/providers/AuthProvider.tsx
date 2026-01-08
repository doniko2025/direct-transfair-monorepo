// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter, useSegments } from "expo-router"; // ✅ Ajout du router pour redirection
import { api } from "../services/api";
import type { AuthUser, LoginPayload, RegisterPayload, LoginResponse } from "../services/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginPayload, tenantCode?: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "dt_token";
const USER_KEY = "dt_user"; // ✅ On garde aussi le user en cache pour l'affichage immédiat

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();

  // --- STORAGE HELPERS ---
  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === 'web') localStorage.setItem(key, val);
    else await SecureStore.setItemAsync(key, val);
  };
  
  const removeStorage = async (key: string) => {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  };

  // --- INITIALISATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);

        if (storedToken && storedUser) {
          api.setToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          // Vérification silencieuse en arrière-plan (ne bloque pas l'UI)
          api.getMe().catch(() => logout()); 
        }
      } catch (e) {
        console.log("Erreur chargement session", e);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // --- REDIRECTION AUTOMATIQUE ---
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      // Pas connecté -> Login
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Connecté -> Accueil
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments]);


  // --- ACTIONS ---
  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      if (tenantCode) api.setTenant(tenantCode);
      
      const res: LoginResponse = await api.login(data, tenantCode);
      
      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
      
      // La redirection sera gérée par le useEffect
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
    api.clearToken();
    setToken(null);
    setUser(null);
    await removeStorage(TOKEN_KEY);
    await removeStorage(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};