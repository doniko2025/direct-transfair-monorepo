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
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; 
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "dt_token";
const USER_KEY = "dt_user"; 
const TENANT_KEY = "dt_tenant"; // ✅ Nouvelle clé pour stocker la société

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();

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

  // --- INITIALISATION AU DÉMARRAGE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);
        const storedTenant = await getStorage(TENANT_KEY); // ✅ On récupère le code société

        // ✅ Si on a un code société stocké, on le configure dans l'API immédiatement
        if (storedTenant) {
            api.setTenant(storedTenant);
            console.log("Tenant restauré:", storedTenant);
        }

        if (storedToken && storedUser) {
          api.setToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // On vérifie si le token est toujours valide
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

  // --- PROTECTION DES ROUTES ---
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      // Pas connecté -> Login
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Connecté -> Home
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments]);

  // --- LOGIN ---
  const login = async (data: LoginPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      // 1. Configurer le Tenant
      const codeToUse = tenantCode || "DONIKO"; // Valeur par défaut si vide
      api.setTenant(codeToUse);
      
      // 2. Appel API Login
      const res: LoginResponse = await api.login(data, codeToUse);
      
      // 3. Sauvegarde des données
      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      
      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
      await setStorage(TENANT_KEY, codeToUse); // ✅ Sauvegarde du Tenant
      
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
    api.setTenant("DONIKO"); // Reset au défaut
    setToken(null);
    setUser(null);
    await removeStorage(TOKEN_KEY);
    await removeStorage(USER_KEY);
    await removeStorage(TENANT_KEY); // ✅ Nettoyage
  };

  const refreshUser = async () => {
    try {
        const updatedUser = await api.getMe(); 
        setUser(updatedUser);
        await setStorage(USER_KEY, JSON.stringify(updatedUser));
        console.log("Profil mis à jour");
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