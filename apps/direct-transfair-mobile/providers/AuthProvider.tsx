// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "../services/api";
import type { AuthUser, LoginPayload, RegisterPayload, LoginResponse } from "../services/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;   // Chargement initial (Splash screen)
  isLoading: boolean; // Chargement d'actions (Login/Register)
  isAuthenticated: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  // ✅ AJOUT INDISPENSABLE pour le profil
  refreshUser: () => Promise<void>; 
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "dt_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);   // Au démarrage : true
  const [isLoading, setIsLoading] = useState(false); // Actions : false

  // --- HELPER STORAGE (Web & Mobile) ---
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

  // --- BOOTSTRAP (Chargement initial) ---
  useEffect(() => {
    const bootstrap = async () => {
      try {
        api.setTenant("DONIKO"); // Configuration par défaut
        const stored = await getStorage();
        
        if (stored) {
          setToken(stored);
          api.setToken(stored);
          
          // On vérifie si le token est encore valide en récupérant l'user
          const me = await api.getMe();
          setUser(me);
        }
      } catch (error) {
        console.log("Session expirée ou invalide");
        await logout(); // Nettoyage propre
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  // --- ACTIONS ---

  const login = async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      const res: LoginResponse = await api.login(data);
      const accessToken = res.access_token;

      // 1. Mise à jour API & Stockage
      setToken(accessToken);
      api.setToken(accessToken);
      await setStorage(accessToken);

      // 2. Récupération immédiate du profil complet
      // (Parfois le login ne renvoie pas tout l'objet user, donc on assure avec getMe)
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
      // Auto-login après inscription
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

  // ✅ FONCTION AJOUTÉE : Rafraîchir les données de l'utilisateur sans se déconnecter
  // Utilisée après une mise à jour de profil
  const refreshUser = async () => {
    if (!token) return;
    try {
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      console.log("Profil utilisateur mis à jour dans le contexte.");
    } catch (e) {
      console.error("Erreur lors du rafraîchissement utilisateur", e);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        isLoading, 
        isAuthenticated: !!user, 
        login, 
        register, 
        logout,
        refreshUser // Exporté ici
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé pour utiliser le contexte
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};