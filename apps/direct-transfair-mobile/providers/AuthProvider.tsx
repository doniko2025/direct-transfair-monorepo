// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter, useSegments } from "expo-router";
import { api } from "../services/api";
import { getCurrencyByCountry } from "../data/countries";
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
const TENANT_KEY = "dt_tenant";
const RESERVED_HOST_PREFIXES = new Set(["www", "app", "mobile"]);

function normalizeTenant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9_-]/g, "");
  if (!cleaned) return null;
  return cleaned;
}

function extractTenantFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams ?? {};
    const candidates: unknown[] = [qp["tenant"], qp["tenantCode"], qp["t"], qp["code"], qp["company"], qp["x-tenant-id"]];
    for (const c of candidates) { const t = normalizeTenant(c); if (t) return t; }
    
    const host = typeof parsed.hostname === "string" ? parsed.hostname : "";
    if (host) {
      const firstLabel = host.split(".")[0] ?? "";
      const lower = firstLabel.toLowerCase();
      if (firstLabel && !RESERVED_HOST_PREFIXES.has(lower)) {
        const t = normalizeTenant(firstLabel);
        if (t) return t;
      }
    }
  } catch {}
  return null;
}

// ✅ Fonction utilitaire cruciale : Injecte la devise officielle dans l'objet utilisateur
const injectCurrencyToUser = (u: AuthUser): AuthUser => {
  if (!u) return u;
  const uAny = u as any; // Bypass TS strict
  const countryName = uAny.country || uAny.agency?.country || "Sénégal";
  const officialCurrency = getCurrencyByCountry(countryName, "XOF");
  return { ...u, currency: officialCurrency } as unknown as AuthUser;
};
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();
  const tenantReadyRef = useRef(false);

  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") { try { localStorage.setItem(key, val); } catch {} }
    else { await SecureStore.setItemAsync(key, val); }
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") { try { localStorage.removeItem(key); } catch {} } 
    else { await SecureStore.deleteItemAsync(key); }
  };

  const getStorage = async (key: string) => {
    if (Platform.OS === "web") { try { return localStorage.getItem(key); } catch { return null; } }
    return await SecureStore.getItemAsync(key);
  };

  const applyTenant = async (nextTenant: string): Promise<void> => {
    const normalized = normalizeTenant(nextTenant);
    if (!normalized) return;
    const prev = api.getTenant();
    if (prev === normalized) return;
    api.setTenant(normalized);
    await setStorage(TENANT_KEY, normalized);
  };

  const ensureTenantReady = async (): Promise<void> => {
    if (tenantReadyRef.current) return;
    let initialUrl: string | null = null;
    try { initialUrl = await Linking.getInitialURL(); } catch { initialUrl = null; }

    let fromUrl: string | null = null;
    if (initialUrl) { fromUrl = extractTenantFromUrl(initialUrl); } 
    else if (Platform.OS === "web") {
      try {
        const href = typeof window !== "undefined" ? String(window.location.href ?? "") : "";
        fromUrl = href ? extractTenantFromUrl(href) : null;
      } catch { fromUrl = null; }
    }

    const stored = normalizeTenant(await getStorage(TENANT_KEY));
    const finalTenant = fromUrl ?? stored ?? null;
    
    if (finalTenant) await applyTenant(finalTenant);
    tenantReadyRef.current = true;
  };

  const logout = async () => {
    try {
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        await ensureTenantReady();
        const storedToken = await getStorage(TOKEN_KEY);
        const storedUserRaw = await getStorage(USER_KEY);

        if (storedToken && storedUserRaw) {
          api.setToken(storedToken);
          setToken(storedToken);
          
          const storedUser = JSON.parse(storedUserRaw) as AuthUser;
          setUser(injectCurrencyToUser(storedUser)); // Injection à l'hydratation

          try {
            const me = await api.getMe();
            const enrichedMe = injectCurrencyToUser(me); // Injection API fraîche
            setUser(enrichedMe);
            await setStorage(USER_KEY, JSON.stringify(enrichedMe));
          } catch {
            await logout();
          }
        }
      } catch (e) {
        console.log("Erreur init auth", e);
      } finally {
        setIsLoading(false);
      }
    };
    void initAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) router.replace("/(auth)/login");
    else if (user && inAuthGroup) router.replace("/(tabs)/home");
  }, [user, isLoading, segments, router]);

  const login = async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const res: LoginResponse = await api.login(data);
      api.setToken(res.access_token);
      setToken(res.access_token);
      
      const enrichedUser = injectCurrencyToUser(res.user); // Injection au login
      setUser(enrichedUser);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterPayload, tenantCode?: string) => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const activeTenant = normalizeTenant(tenantCode) ?? normalizeTenant(api.getTenant());
      const payload: RegisterPayload & { tenantCode?: string } = {
        ...data,
        ...(activeTenant && activeTenant !== "DONIKO" ? { tenantCode: activeTenant } : {}),
      };

      const res = await api.register(payload);
      if (res && typeof res.access_token === "string" && res.access_token.length > 0) {
        api.setToken(res.access_token);
        setToken(res.access_token);
        const enrichedUser = injectCurrencyToUser(res.user);
        setUser(enrichedUser);
        await setStorage(TOKEN_KEY, res.access_token);
        await setStorage(USER_KEY, JSON.stringify(enrichedUser));
        return;
      }
      // ✅
await login({ identifier: data.email ?? data.phone ?? "", password: data.password });
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      if (!token) return;
      api.setToken(token);
      const updatedUser = await api.getMe();
      const enrichedUser = injectCurrencyToUser(updatedUser); // Injection au refresh
      setUser(enrichedUser);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
    } catch (e) {
      console.log("Erreur refresh user", e);
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