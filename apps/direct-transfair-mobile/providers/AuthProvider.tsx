// apps/direct-transfair-mobile/providers/AuthProvider.tsx
// =========================================================
// ✅ phase 7 : le code de la société système est lu dans services/platformConfig.ts (plus de « DONIKO » en dur).
// AUTH PROVIDER v7.1 — Direct Transf'air
// ✅ v7.1 : 🔥 CORRIGÉ « le chargement tourne sans fin » au démarrage. La restauration de session attendait
//   GET /auth/me (puis, sur 401, POST /auth/refresh) AVANT d'afficher quoi que ce soit : avec un serveur qui se
//   réveille (Render gratuit) ou qui ne répond pas, l'écran de chargement restait bloqué 30 à 60 s, voire plus.
//   Désormais la session enregistrée (déjà vérifiée localement : rôle client) est restaurée tout de suite, l'écran
//   s'affiche, et la validation auprès du serveur se fait en arrière-plan : 401/403 ⇒ déconnexion propre ; serveur
//   injoignable ⇒ on garde la session, sans blocage. Garde-fou : le chargement initial ne dépasse jamais
//   INIT_MAX_WAIT_MS.
// ✅ v6.1, v6.2, v6.3 conservés intégralement
// ✅ v7.0 : (phase 5) l'app mobile est réservée aux clients wallet
//   (rôle USER). Toute session d'un autre rôle (SUPER_ADMIN,
//   COMPANY_ADMIN, AGENT) est refusée et fermée, quel que soit le chemin
//   de connexion (mot de passe, OTP, biométrie, inscription) et aussi à
//   la restauration d'une session enregistrée par une ancienne version
//   de l'app. Le backend refuse déjà ces rôles sans l'en-tête
//   `x-app-client: web` ; ce contrôle côté app est une seconde barrière
//   (déploiement progressif, session déjà stockée).
// ✅ v6.3 : FIX synchronisation refresh token en mémoire
//
//   PROBLÈME RÉSOLU (v6.3) :
//   register() et applyLoginResult() persistaient le refresh token
//   en storage (setStorage("refreshToken", ...)) mais ne mettaient
//   jamais à jour le champ privé `refreshToken` de l'instance `api`
//   — seuls login()/loginStep2()/attemptTokenRefresh() (internes à
//   la classe API) le faisaient. Résultat : pour toute session issue
//   de l'inscription ou de la connexion v2 (login-v2.tsx →
//   applyLoginResult), `api`'s refreshToken restait `null` en
//   mémoire. Conséquence concrète : l'intercepteur axios qui doit
//   rafraîchir automatiquement le token sur un 401 ne se déclenchait
//   jamais pour ces sessions (il vérifie `this.refreshToken` en
//   mémoire, pas le storage) — un token expiré menait directement à
//   un logout silencieux au lieu d'un rafraîchissement transparent.
//
//   FIX — api.setRefreshToken(...) appelé en plus de setStorage(),
//   partout où un refresh token est reçu hors de login()/loginStep2().
//   Nécessite l'ajout de la méthode publique setRefreshToken() dans
//   api.ts (voir patch fourni séparément).
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
import { isPlatformCode } from "../services/platformConfig";
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

// ─── v7.0 : app réservée aux clients (rôle USER) ──────────
const CLIENT_ROLE = "USER";

const WEB_PORTAL_REQUIRED_MESSAGE =
  "Ce compte est réservé au portail web. L'application mobile est réservée " +
  "aux clients : connectez-vous depuis le portail web de votre société.";

function isClientRole(u: unknown): boolean {
  return (u as { role?: string } | null | undefined)?.role === CLIENT_ROLE;
}

class WebPortalRequiredError extends Error {
  readonly code = "USE_WEB_PORTAL";
  constructor() {
    super(WEB_PORTAL_REQUIRED_MESSAGE);
    this.name = "WebPortalRequiredError";
  }
}

const injectCurrencyToUser = (u: AuthUser): AuthUser => {
  if (!u) return u;
  const uAny = u as any;
  const countryName = uAny.country || uAny.agency?.country || "Sénégal";
  const officialCurrency = getCurrencyByCountry(countryName, "XOF");
  return { ...u, currency: officialCurrency } as unknown as AuthUser;
};

// ✅ v7.1 : durée maximale du chargement initial (configurable : EXPO_PUBLIC_AUTH_INIT_MAX_WAIT_MS)
const INIT_MAX_WAIT_MS = (() => {
  const n = Number(process.env.EXPO_PUBLIC_AUTH_INIT_MAX_WAIT_MS);
  return Number.isFinite(n) && n >= 2000 && n <= 60000 ? n : 8000;
})();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router   = useRouter();
  // Cast : le type « tuple » inféré par expo-router refuse segments[1] (TS2493)
  const segments = useSegments() as string[];

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

  // ─── v7.0 : fermeture d'une session qui n'est pas celle d'un client ───
  // Révoque la session côté serveur (si un jeton est connu), efface les
  // jetons et la session locale — y compris le refresh token (contrairement
  // à logout(), qui le garde pour la reconnexion biométrique d'un client).
  const closeForeignSession = useCallback(async (accessToken?: string | null) => {
    try {
      if (accessToken) api.setToken(accessToken);
      await api.logout(); // POST /auth/logout puis effacement des jetons de l'instance api
    } catch { /* la session expirera côté serveur */ }
    api.clearToken();
    setToken(null);
    setUser(null);
    tokenRef.current = null;
    await removeStorage(TOKEN_KEY);
    await removeStorage(USER_KEY);
    await removeStorage("refreshToken");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Init ─────────────────────────────────────────────────
  useEffect(() => {
    // ✅ v7.1 : garde-fou — quoi qu'il arrive, l'écran de chargement initial ne dépasse pas INIT_MAX_WAIT_MS
    const capTimer = setTimeout(() => setIsLoading(false), INIT_MAX_WAIT_MS);
    const initAuth = async () => {
      try {
        await ensureTenantReady();
        const storedToken   = await getStorage(TOKEN_KEY);
        const storedUserRaw = await getStorage(USER_KEY);

        if (storedToken && storedUserRaw) {
          const storedUser = JSON.parse(storedUserRaw) as AuthUser;

          // ✅ v7.0 : session enregistrée par une ancienne version de l'app
          // pour un agent / admin → fermée, retour à l'écran de connexion.
          if (!isClientRole(storedUser)) {
            await closeForeignSession(storedToken);
            return;
          }

          const clientCode = (storedUser as any)?.client?.code;
          if (clientCode) await applyTenant(clientCode);

          api.setToken(storedToken);
          setToken(storedToken);
          tokenRef.current = storedToken;
          setUser(injectCurrencyToUser(storedUser));

          // ✅ v7.1 : validation serveur en arrière-plan (ne bloque plus l'affichage)
          void (async () => {
            try {
              const me = await api.getMe();
              if (!isClientRole(me)) {
                await closeForeignSession(storedToken);
                return;
              }
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
          })();
        }
      } catch (e) {
        console.log("Erreur init auth", e);
      } finally {
        clearTimeout(capTimer);
        setIsLoading(false);
      }
    };
    void initAuth();
    return () => clearTimeout(capTimer);
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
    // ✅ v7.0 : l'app ne sert que les clients wallet
    if (!isClientRole(rawUser)) {
      await closeForeignSession(accessToken);
      throw new WebPortalRequiredError();
    }

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
      api.setRefreshToken(refreshToken); // ✅ v6.3 — synchronise l'instance api
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
      if (!isClientRole(res.user)) { // ✅ v7.0
        await closeForeignSession(res.access_token);
        throw new WebPortalRequiredError();
      }
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
        ...(activeTenant && !isPlatformCode(activeTenant) ? { tenantCode: activeTenant } : {}),
      };
      const res = await api.register(payload);
      if (res && typeof res.access_token === "string" && res.access_token.length > 0) {
        if (!isClientRole(res.user)) { // ✅ v7.0
          await closeForeignSession(res.access_token);
          throw new WebPortalRequiredError();
        }
        api.setToken(res.access_token);
        setToken(res.access_token);
        tokenRef.current = res.access_token;
        const enrichedUser = injectCurrencyToUser(res.user);
        setUser(enrichedUser);
        await setStorage(TOKEN_KEY, res.access_token);
        await setStorage(USER_KEY, JSON.stringify(enrichedUser));
        if (res.refresh_token) {
          await setStorage("refreshToken", res.refresh_token);
          api.setRefreshToken(res.refresh_token); // ✅ v6.3 — synchronise l'instance api
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
      if (!isClientRole(updatedUser)) { // ✅ v7.0
        await closeForeignSession(currentToken);
        await logout();
        return;
      }
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
      if (!isClientRole(me)) { // ✅ v7.0
        await closeForeignSession(newToken);
        throw new WebPortalRequiredError();
      }
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

      if (!isClientRole(res.user)) { // ✅ v7.0
        await closeForeignSession(res.access_token);
        throw new WebPortalRequiredError();
      }

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