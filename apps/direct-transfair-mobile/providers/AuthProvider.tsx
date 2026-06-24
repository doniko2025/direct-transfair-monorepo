// apps/direct-transfair-mobile/providers/AuthProvider.tsx
// =========================================================
// AUTH PROVIDER v6.0 — Direct Transf'air
// ✅ v5.4 : écrans légaux/modaux accessibles à tous (isLegalScreen)
// ✅ v5.5 : loginWithPhoneOtp(userId, code)
// ✅ v5.6 : FIX enregistrement appareil (registerCurrentDeviceIfNeeded)
// ✅ v6.0 : Guard navigation renforcé + applyLoginResult()
//
//   applyLoginResult(accessToken, refreshToken?, user) :
//     Méthode publique permettant à login-v2.tsx de compléter
//     une connexion v2 sans passer par login().
//     Hydrate correctement : api.setToken(), setToken(), tokenRef,
//     setUser(), stockage SecureStore/localStorage, tenant, device.
//     NÉCESSAIRE car storeTokens() dans login-v2 appelait api.setToken()
//     mais ne mettait pas à jour tokenRef.current → refreshUser()
//     lisait tokenRef === null → retournait sans rien faire → guard muet.
//
//   Guard navigation v6.0 :
//     isVerifyScreen   : évite les boucles si user sur verify-contact
//     needsVerification: redirige si email ou téléphone non vérifié
//     login redirect   : /(auth)/login → /(auth)/login-v2
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
import type {
  AuthUser, LoginPayload, RegisterPayload, LoginResponse,
} from "../services/types";

type AuthContextValue = {
  user:      AuthUser | null;
  token:     string | null;
  isLoading: boolean;
  login:              (data: LoginPayload) => Promise<void>;
  register:           (data: RegisterPayload, tenantCode?: string) => Promise<void>;
  logout:             () => Promise<void>;
  refreshUser:        () => Promise<void>;
  biometricLogin:     () => Promise<void>;
  /** ✅ v5.5 : étape 2 connexion par téléphone — vérifie le code OTP et ouvre la session */
  loginWithPhoneOtp:  (userId: string, code: string) => Promise<void>;
  /**
   * ✅ v6.0 : Hydrate AuthProvider depuis une connexion externe (login-v2.tsx)
   * Appelé après v2Auth.loginPassword / verifyOtpLogin pour que le guard
   * voie le changement d'état et redirige vers home.
   */
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
      // ✅ NE PAS supprimer le refresh token ici
      // → il est conservé pour permettre la reconnexion biométrique
      router.replace("/(auth)/login-v2"); // ✅ v6.0 : login → login-v2
    } catch (e) {
      console.error("Erreur logout", e);
    }
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
            // ✅ v5.6 — session existante restaurée avec succès
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

    const inAuthGroup = segments[0] === "(auth)";

    // ✅ v5.4 : écrans légaux/modaux accessibles à tous
    const isLegalScreen =
      segments[1] === "terms" ||
      segments[1] === "privacy-policy" ||
      segments[1] === "assistance";

    // ✅ v6.0 : écran de vérification — évite les boucles de redirection
    const isVerifyScreen = segments[1] === "verify-contact";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login-v2"); // ✅ v6.0 : login → login-v2
      return;
    }

    // ✅ v6.0 : Bloquer l'accès à l'app si email ou téléphone non vérifié.
    // Condition : user connecté, pas dans le groupe auth, pas sur verify-contact.
    // Le téléphone est requis uniquement si l'utilisateur en a un (field non nul).
    const needsVerification =
      user &&
      !inAuthGroup &&
      !isVerifyScreen &&
      (
        !(user as any).isEmailVerified ||
        ((user as any).phone && !(user as any).isPhoneVerified)
      );

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
  // ✅ v6.0 : Hydrate AuthProvider depuis une connexion externe.
  // Appelé par login-v2.tsx après loginPassword() ou verifyOtpLogin()
  // pour que le guard voie le changement d'état et redirige vers home.
  // Remplace le pattern storeTokens() + refreshUser() qui était cassé
  // (refreshUser lisait tokenRef.current === null et retournait tôt).
  const applyLoginResult = useCallback(async (
    accessToken:  string,
    refreshToken: string | null | undefined,
    rawUser:      any,
  ) => {
    const clientCode = rawUser?.client?.code;
    if (clientCode) await applyTenant(clientCode);

    // Met à jour l'instance API
    api.setToken(accessToken);

    // Met à jour l'état React ET la ref synchrone
    setToken(accessToken);
    tokenRef.current = accessToken;

    // Enrichit et hydrate le user
    const enrichedUser = injectCurrencyToUser(rawUser as AuthUser);
    setUser(enrichedUser);

    // Persiste dans SecureStore / localStorage
    await setStorage(TOKEN_KEY, accessToken);
    await setStorage(USER_KEY, JSON.stringify(enrichedUser));
    if (refreshToken) {
      await setStorage("refreshToken", refreshToken);
    }

    // Enregistre l'appareil (fire-and-forget, ne bloque jamais)
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
      // ✅ v5.6 — fire-and-forget, ne bloque jamais la connexion
      void registerCurrentDeviceIfNeeded();
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Register ─────────────────────────────────────────────
  const register = useCallback(async (data: RegisterPayload, tenantCode?: string) => {
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
        // ✅ v5.6 — fire-and-forget
        void registerCurrentDeviceIfNeeded();
        return;
      }
      await login({ identifier: data.email ?? data.phone ?? "", password: data.password });
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
  const biometricLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureTenantReady();
      const result = await api.refreshAccessToken();
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
      // ✅ v5.6 — fire-and-forget
      void registerCurrentDeviceIfNeeded();
    } catch (e: unknown) {
      throw e;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── loginWithPhoneOtp ────────────────────────────────────
  // ✅ v5.5 : étape 2 de la connexion par téléphone.
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
      // ✅ v5.6 — fire-and-forget
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
      applyLoginResult, // ✅ v6.0
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