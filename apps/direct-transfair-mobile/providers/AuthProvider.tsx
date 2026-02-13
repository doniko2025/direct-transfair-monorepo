// apps/direct-transfair-mobile/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter, useSegments } from "expo-router";
import { api } from "../services/api";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  LoginResponse,
} from "../services/types";

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
    const candidates: unknown[] = [
      qp["tenant"],
      qp["tenantCode"],
      qp["t"],
      qp["code"],
      qp["company"],
      qp["x-tenant-id"],
    ];

    for (const c of candidates) {
      const t = normalizeTenant(c);
      if (t) return t;
    }

    const host = typeof parsed.hostname === "string" ? parsed.hostname : "";
    if (host) {
      const firstLabel = host.split(".")[0] ?? "";
      const lower = firstLabel.toLowerCase();
      if (firstLabel && !RESERVED_HOST_PREFIXES.has(lower)) {
        const t = normalizeTenant(firstLabel);
        if (t) return t;
      }
    }

    // On évite d'interpréter n'importe quel path comme tenant
    const path = typeof parsed.path === "string" ? parsed.path : "";
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const head = parts[0]?.toLowerCase();
      if (head === "t" || head === "tenant") {
        const t = normalizeTenant(parts[1]);
        if (t) return t;
      }
    }
  } catch {
    // noop
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  const tenantReadyRef = useRef(false);

  // --- STORAGE HELPERS ---
  const setStorage = async (key: string, val: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, val);
      } catch {}
    } else {
      await SecureStore.setItemAsync(key, val);
    }
  };

  const removeStorage = async (key: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {}
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

  // --- TENANT INIT / RESOLVE ---
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

    // 1) Tenant depuis URL initiale
    let initialUrl: string | null = null;
    try {
      initialUrl = await Linking.getInitialURL();
    } catch {
      initialUrl = null;
    }

    let fromUrl: string | null = null;
    if (initialUrl) {
      fromUrl = extractTenantFromUrl(initialUrl);
    } else if (Platform.OS === "web") {
      try {
        const href =
          typeof window !== "undefined" ? String(window.location.href ?? "") : "";
        fromUrl = href ? extractTenantFromUrl(href) : null;
      } catch {
        fromUrl = null;
      }
    }

    // 2) Sinon tenant persisté
    const stored = normalizeTenant(await getStorage(TENANT_KEY));

    // 3) Choix final
    const finalTenant = fromUrl ?? stored ?? null;
    if (finalTenant) {
      await applyTenant(finalTenant);
    } else {
      tenantReadyRef.current = true;
      return;
    }

    tenantReadyRef.current = true;
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

  // --- TENANT LISTENER ---
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const t = extractTenantFromUrl(url);
      if (!t) return;

      const prev = api.getTenant();
      const next = normalizeTenant(t);
      if (!next || next === prev) return;

      void (async () => {
        await applyTenant(next);
        if (user) {
          await logout();
        }
      })();
    });

    return () => {
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- INIT SESSION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await ensureTenantReady();

        const storedToken = await getStorage(TOKEN_KEY);
        const storedUser = await getStorage(USER_KEY);

        if (storedToken && storedUser) {
          api.setToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);

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

    void initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [user, isLoading, segments, router]);

  // --- LOGIN ---
  const login = async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      await ensureTenantReady();

      const res: LoginResponse = await api.login(data);

      api.setToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(res.user));
    } catch (e: unknown) {
      console.error("Erreur Login:", (e as any)?.response?.data || (e as any)?.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // --- REGISTER ---
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
        setUser(res.user);

        await setStorage(TOKEN_KEY, res.access_token);
        await setStorage(USER_KEY, JSON.stringify(res.user));
        return;
      }

      await login({ email: data.email, password: (data as any).password });
    } catch (e: unknown) {
      console.error("Erreur Register:", (e as any)?.response?.data || (e as any)?.message);
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