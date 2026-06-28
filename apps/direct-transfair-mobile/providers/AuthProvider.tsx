// apps/direct-transfair-mobile/providers/AuthProvider.tsx
// =========================================================
// AUTH PROVIDER v6.2 — Direct Transf'air
// ✅ v6.1 conservé intégralement
// ✅ v6.2 : biometricLogin() déclenche VRAIMENT Face ID / Touch ID
//   AVANT de rafraîchir le token.
//   AVANT : api.refreshAccessToken() appelé sans prompt → biométrie
//           jamais déclenchée, toggle purement décoratif.
//   APRÈS : promptBiometrics() appelé en premier → si l'utilisateur
//           annule ou échoue, on throw sans jamais toucher au token.
//           Si succès → refreshAccessToken() → user hydraté.
// =========================================================

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { useRouter, useSegments } from "expo-router";
import { api } from "../services/api";
import { registerCurrentDeviceIfNeeded } from "../services/deviceRegistration";
import { getCurrencyByCountry } from "../data/countries";
import { promptBiometrics } from "../hooks/useBiometrics"; // ✅ v6.2
import type {
  AuthUser, LoginPayload, RegisterPayload, LoginResponse,
} from "../services/types";

type AuthContextValue = {
  user:      AuthUser | null;
  token:     string | null;
  isLoading: boolean;
  login:              (data: LoginPayload) => Promise<void>;
  register:           (data: RegisterPayload, tenantCode?: string) => Promise<AuthUser | null>;
  logout:             () => Promise<void>;
  refreshUser:        () => Promise<void>;
  biometricLogin:     () => Promise<void>;
  loginWithPhoneOtp:  (userId: string, code: string) => Promise<void>;
  applyLoginResult: (
    accessToken:  string,
    refreshToken: string | null | undefined,
    rawUser:      any,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY  = "dt_token";
const USER_KEY   = "dt_user";
const TENANT_KEY = "dt_tenant";

const RESERVED_HOST_PREFIXES = new Set(["www", "app", "mobile"]);

const CLOUD_HOST_SUFFIXES = [
  ".vercel.app",
  ".up.railway.app",
  ".netlify.app",
  ".onrender.com",
  ".fly.dev",
  ".railway.app",
];

function isCloudDeploymentHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "localhost") return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  return CLOUD_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

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
      qp["tenant"], qp["tenantCode"], qp["t"],
      qp["code"], qp["company"], qp["x-tenant-id"],
    ];
    for (const c of candidates) {
      const t = normalizeTenant(c);
      if (t) return t;
    }
    const host = typeof parsed.hostname === "string" ? parsed.hostname : "";
    if (host && !isCloudDeploymentHost(host)) {
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

const injectCurrencyToUser = (u: AuthUser): AuthUser => {
  if (!u) return u;
  const uAny = u as any;
  const countryName = uAny.country || uAny.agency?.country || "Sénégal";
  const officialCurrency = getCurrencyByCountry(countryName, "XOF");
  return { ...u, currency: officialCurrency } as unknown as AuthUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router   = useRouter();
  const segments = useSegments();

  const tokenRef       = useRef<string | null>(null);
  const tenantReadyRef = useRef(false);

  useEffect(() => { tokenRef.current = token; }, [token]);

  // ─── Storage helpers ─────────────────────────────────────
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

  // ─── Tenant ───────────────────────────────────────────────
  const applyTenant = async (nextTenant: string): Promise<void> => {
    const normalized = normalizeTenant(nextTenant);
    if (!normalized) return;
    if (api.getTenant() === normalized) return;
    api.setTenant(normalized);
    await setStorage(TENANT_KEY, normalized);
  };

  const ensureTenantReady = async (): Promise<void> => {
    if (tenantReadyRef.current) return;
    let initialUrl: string | null = null;
    try { initialUrl = await Linking.getInitialURL(); } catch { initialUrl = null; }

    let fromUrl: string | null = null;
    if (initialUrl) {
      fromUrl = extractTenantFromUrl(initialUrl);
    } else if (Platform.OS === "web") {
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

  // ─── Logout ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      api.clearToken();
      setToken(null);
      setUser(null);
      tokenRef.current = null;
      await removeStorage(TOKEN_KEY);
      await removeStorage(USER_KEY);
      // ✅ Le refresh token est intentionnellement conservé pour
      // permettre la reconnexion biométrique après logout.
      router.replace("/(auth)/login-v2");
    } catch (e) {
      console.error("Erreur logout", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ─── Init ─────────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        await ensureTenantReady();
        const storedToken   = await getStorage(TOKEN_KEY);
        const storedUserRaw = await getStorage(USER_KEY);

        if (storedToken && storedUserRaw) {
          const storedUser = JSON.parse(storedUserRaw) as AuthUser;
          const clientCode = (storedUser as any)?.client?.code;
          if (clientCode) await applyTenant(clientCode);

          api.setToken(storedToken);
          setToken(storedToken);
          tokenRef.current = storedToken;
          setUser(injectCurrencyToUser(storedUser));

          try {
            const me = await api.getMe();
            const enrichedMe = injectCurrencyToUser(me);
            const meCode = (me as any)?.client?.code;
            if (meCode) await applyTenant(meCode);
            setUser(enrichedMe);
            await setStorage(USER_KEY, JSON.stringify(enrichedMe));
            void registerCurrentDeviceIfNeeded();
          } catch (e: any) {
            const status = e?.response?.status;
            if (status === 401 || status === 403) await logout();
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

  // ─── Guard navigation ─────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup    = segments[0] === "(auth)";
    const isLegalScreen  = segments[1] === "terms" || segments[1] === "privacy-policy" || segments[1] === "assistance";
    const isVerifyScreen = segments[1] === "verify-contact";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login-v2");
      return;
    }

    const needsVerification =
      user &&
      !inAuthGroup &&
      !isVerifyScreen &&
      (!(user as any).isEmailVerified);

    if (needsVerification) {
      router.replace({
        pathname: "/(auth)/verify-contact",
        params: {
          userId:        (user as any).id,
          emailVerified: (user as any).isEmailVerified ? "1" : "0",
          phoneVerified: (user as any).isPhoneVerified ? "1" : "0",
          hasPhone:      (user as any).phone           ? "1" : "0",
        },
      } as any);
      return;
    }

    if (user && inAuthGroup && !isLegalScreen && !isVerifyScreen) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments, router]);

  // ─── applyLoginResult ─────────────────────────────────────
  const applyLoginResult = useCallback(async (
    accessToken:  string,
    refreshToken: string | null | undefined,
    rawUser:      any,
  ) => {
    const clientCode = rawUser?.client?.code;
    if (clientCode) await applyTenant(clientCode);

    api.setToken(accessToken);
    setToken(accessToken);
    tokenRef.current = accessToken;

    const enrichedUser = injectCurrencyToUser(rawUser as AuthUser);
    setUser(enrichedUser);

    await setStorage(TOKEN_KEY, accessToken);
    await setStorage(USER_KEY, JSON.stringify(enrichedUser));
    if (refreshToken) {
      await setStorage("refreshToken", refreshToken);
    }

    void registerCurrentDeviceIfNeeded();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Login ────────────────────────────────────────────────
  const login = useCallback(async (data: LoginPayload) => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const res: LoginResponse = await api.login(data);
      const clientCode = (res.user as any)?.client?.code;
      if (clientCode) await applyTenant(clientCode);
      api.setToken(res.access_token);
      setToken(res.access_token);
      tokenRef.current = res.access_token;
      const enrichedUser = injectCurrencyToUser(res.user);
      setUser(enrichedUser);
      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
      void registerCurrentDeviceIfNeeded();
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Register ─────────────────────────────────────────────
  const register = useCallback(async (
    data: RegisterPayload,
    tenantCode?: string,
  ): Promise<AuthUser | null> => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const activeTenant =
        normalizeTenant(tenantCode) ?? normalizeTenant(api.getTenant());
      const payload: RegisterPayload & { tenantCode?: string } = {
        ...data,
        ...(activeTenant && activeTenant !== "DONIKO" ? { tenantCode: activeTenant } : {}),
      };
      const res = await api.register(payload);
      if (res && typeof res.access_token === "string" && res.access_token.length > 0) {
        api.setToken(res.access_token);
        setToken(res.access_token);
        tokenRef.current = res.access_token;
        const enrichedUser = injectCurrencyToUser(res.user);
        setUser(enrichedUser);
        await setStorage(TOKEN_KEY, res.access_token);
        await setStorage(USER_KEY, JSON.stringify(enrichedUser));
        if (res.refresh_token) {
          await setStorage("refreshToken", res.refresh_token);
        }
        void registerCurrentDeviceIfNeeded();
        return enrichedUser;
      }
      await login({ identifier: data.email ?? data.phone ?? "", password: data.password });
      return null;
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login]);

  // ─── refreshUser ─────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      api.setToken(currentToken);
      const updatedUser  = await api.getMe();
      const enrichedUser = injectCurrencyToUser(updatedUser);
      setUser(enrichedUser);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
    } catch (e: any) {
      const status = (e as any)?.response?.status;
      if (status === 401 || status === 403) await logout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── biometricLogin ───────────────────────────────────────
  // ✅ v6.2 : promptBiometrics() déclenché EN PREMIER.
  // Avant : token rafraîchi silencieusement sans aucune vérif
  //         biométrique → Face ID / Touch ID jamais affiché.
  // Après : si l'utilisateur annule ou que le scan échoue,
  //         on throw immédiatement, le token n'est jamais touché.
  const biometricLogin = useCallback(async () => {
    // ── Étape 1 : Déclencher le prompt natif Face ID / Touch ID ──
    const ok = await promptBiometrics("Connectez-vous avec Face ID / Touch ID");
    if (!ok) {
      throw new Error("Authentification biométrique annulée ou échouée");
    }

    // ── Étape 2 : Biométrie validée → rafraîchir le token ──
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const result   = await api.refreshAccessToken();
      const newToken = result.access_token;

      api.setToken(newToken);
      setToken(newToken);
      tokenRef.current = newToken;

      const me = await api.getMe();
      const enrichedUser = injectCurrencyToUser(me);

      const clientCode = (me as any)?.client?.code;
      if (clientCode) await applyTenant(clientCode);

      setUser(enrichedUser);
      await setStorage(TOKEN_KEY, newToken);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
      void registerCurrentDeviceIfNeeded();
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── loginWithPhoneOtp ────────────────────────────────────
  const loginWithPhoneOtp = useCallback(async (userId: string, code: string) => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: LoginResponse = await (api as any).loginStep2({ userId, code });

      const clientCode = (res.user as any)?.client?.code;
      if (clientCode) await applyTenant(clientCode);

      api.setToken(res.access_token);
      setToken(res.access_token);
      tokenRef.current = res.access_token;

      const enrichedUser = injectCurrencyToUser(res.user);
      setUser(enrichedUser);

      await setStorage(TOKEN_KEY, res.access_token);
      await setStorage(USER_KEY, JSON.stringify(enrichedUser));
      void registerCurrentDeviceIfNeeded();
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login, register, logout, refreshUser, biometricLogin,
      loginWithPhoneOtp,
      applyLoginResult,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};