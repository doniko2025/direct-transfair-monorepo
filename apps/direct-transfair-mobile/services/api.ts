// apps/direct-transfair-mobile/services/api.ts
// =========================================================
// DIRECT TRANSF'AIR — API Service v5.6
// ✅ v5.0 — Hardening production (tout conservé)
// v5.1 — Fix "Application not found" sur Expo/Railway
// ✅ normalizeTenant() — blacklist étendue Railway/Expo
// ✅ secureGet/secureSet/secureDelete — fallback AsyncStorage web
// ✅ loadPersistedState — double tentative SecureStore → AsyncStorage
// ✅ clearTokens — nettoie les deux storages
// ✅ Logs de diagnostic tenant étendus (isDev)
// v5.3 — Fix moulinage declareBankTransfer
// ✅ declareBankTransfer — suppression tryMany (causait double appel)
// ✅ declareBankTransfer — timeout réduit à 15s
// ✅ declareBankTransfer — devise par défaut corrigée XOF
// v5.4 — Ajout getPublicUser(id) : résolution d'identité QR/P2P
// v5.5 — getBrandingByHost() : détection tenant depuis hostname web
//   CORRECTIONS v5.5 :
//   — Suppression du doublon getBrandingByHost() / getClientPublicBranding()
//     qui avait été inséré deux fois (AUTH + WALLETS)
//   — Version unique conservée dans la section WALLETS
// v5.6 — FIX synchronisation refresh token (AuthProvider v6.3)
//   AVANT : register()/applyLoginResult() persistaient le refresh
//   token en storage mais n'avaient aucun moyen de mettre à jour le
//   champ privé `refreshToken` de cette instance — seuls
//   login()/loginStep2()/attemptTokenRefresh() le faisaient. Résultat :
//   pour les sessions issues de l'inscription ou du login v2, le
//   refresh automatique sur 401 (dans l'intercepteur ci-dessous) ne se
//   déclenchait jamais, puisqu'il vérifie this.refreshToken en mémoire.
//   APRÈS : ajout de setRefreshToken(), méthode publique symétrique à
//   setToken(), pour permettre à AuthProvider de synchroniser l'état.
// =========================================================

import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import type {
  Agency,
  Alert,
  AmlFlag,
  ApiKey,
  AuditLog,
  AuthUser,
  Beneficiary,
  ChangePasswordPayload,
  Client,
  ClientSubscriptionStatus,
  CommissionRule,
  CommunicationLog,
  CountryCurrency,
  CreateAgencyPayload,
  CreateBeneficiaryPayload,
  CreateRateAlertPayload,
  CreateScheduledTransferPayload,
  CreateTransactionPayload,
  Currency,
  ExchangeRate,
  ExchangeRateHistory,
  KycDocument,
  LedgerEntry,
  LoginPayload,
  LoginResponse,
  LoginStep1Response,
  LoyaltyConfig,
  LoyaltyTransaction,
  Notification,
  OtpLog,
  PaginatedResponse,
  Promotion,
  RateAlert,
  RefreshTokenResponse,
  RegisterDevicePayload,
  RegisterPayload,
  ScheduledTransfer,
  SubmitKycPayload,
  Transaction,
  TransactionStatus,
  TreasuryOverview,
  TreasurySnapshot,
  UserDevice,
  VerifyLoginOtpPayload,
  Wallet,
  WebhookDelivery,
  WebhookEndpoint,
  Withdrawal,
} from "./types";

// ============================================================
// TYPE HELPERS
// ============================================================

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

// ============================================================
// CONFIG
// ============================================================

const PROD_FALLBACK_BASE_URL =
  "https://direct-transfair-monorepo-production.up.railway.app";

const PLATFORM_TENANT = "DONIKO";

const DEFAULT_API_PREFIX = "/api";

const STORAGE_KEYS = {
  PREFERRED_TENANT: "PREFERRED_TENANT",
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  DEVICE_ID: "deviceId",
} as const;

// ============================================================
// LOGGER — logs sensibles uniquement en dev
// ============================================================

const isDev =
  typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

function devLog(...args: unknown[]): void {
  if (isDev) console.log(...args);
}

function devWarn(...args: unknown[]): void {
  if (isDev) console.warn(...args);
}

// ============================================================
// HELPERS
// ============================================================

function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return normalizeBaseUrl(envUrl);
  return PROD_FALLBACK_BASE_URL;
}

function normalizeTenant(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toUpperCase();

  const blackList = [
    "10",
    "LOCALHOST",
    "127.0.0.1",
    "DFTRANSFER",
    "UNDEFINED",
    "NULL",
    "VERCEL",
    "DIRECT-TRANSFAIR-MONOREPO",
    "DIRECT-TRANSFAIR-BACKEND-PRODUCTION",
    "DIRECT-TRANSFAIR-MOBILE",
    "DIRECT-TRANSFAIR-BACKEND",
    "DIRECT-TRANSFAIR",
    "EXP",
    "EXPO",
  ];

  if (!raw) {
    devLog("🔧 normalizeTenant: vide → DONIKO");
    return PLATFORM_TENANT;
  }

  if (blackList.includes(raw)) {
    devLog(`🔧 normalizeTenant: "${raw}" blacklisté → DONIKO`);
    return PLATFORM_TENANT;
  }

  const badPrefixes = ["192.168.", "192.", "10.", "172.", "EXP://"];
  for (const prefix of badPrefixes) {
    if (raw.startsWith(prefix)) {
      devLog(`🔧 normalizeTenant: "${raw}" préfixe IP → DONIKO`);
      return PLATFORM_TENANT;
    }
  }

  if (/^\d{1,3}$/.test(raw)) {
    devLog(`🔧 normalizeTenant: "${raw}" segment IP isolé → DONIKO`);
    return PLATFORM_TENANT;
  }

  const badSubstrings = [
    "RAILWAY",
    "TRANSFAIR-BACKEND",
    "TRANSFAIR-MOBILE",
    "VERCEL.APP",
    "NETLIFY",
    "ONRENDER",
    "FLY.DEV",
  ];
  for (const sub of badSubstrings) {
    if (raw.includes(sub)) {
      devLog(`🔧 normalizeTenant: "${raw}" contient "${sub}" → DONIKO`);
      return PLATFORM_TENANT;
    }
  }

  devLog(`✅ normalizeTenant: "${raw}" accepté`);
  return raw;
}

function getInitialTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  devLog("🌱 EXPO_PUBLIC_TENANT_ID:", envTenant ?? "(non défini)");
  return normalizeTenant(envTenant);
}

function buildApiBaseURL(): string {
  const base = getBaseUrl();
  const envPrefix = (process.env.EXPO_PUBLIC_API_PREFIX ?? "").trim();
  const prefix = envPrefix.length > 0 ? envPrefix : DEFAULT_API_PREFIX;
  const p = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return `${base}${p}`;
}

function ensureAxiosHeaders(
  headers: InternalAxiosRequestConfig["headers"],
): AxiosHeaders {
  if (!headers) return new AxiosHeaders();
  if (headers instanceof AxiosHeaders) return headers;
  return new AxiosHeaders(headers as Record<string, string>);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as T[];
  return [];
}

function toNumberSafe(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (isRecord(value) && typeof value.toString === "function") {
    const n = Number(value.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeTransaction(t: unknown): Transaction {
  const tx = (isRecord(t) ? t : {}) as Record<string, unknown>;
  return {
    ...(tx as unknown as Transaction),
    amount: toNumberSafe(tx.amount),
    fees: toNumberSafe(tx.fees),
    total: toNumberSafe(tx.total),
    receivedAmount:
      tx.receivedAmount !== undefined
        ? toNumberSafe(tx.receivedAmount)
        : (tx as unknown as Transaction).receivedAmount,
    exchangeRate:
      tx.exchangeRate !== undefined
        ? toNumberSafe(tx.exchangeRate)
        : (tx as unknown as Transaction).exchangeRate,
    senderCommission:
      tx.senderCommission !== undefined
        ? toNumberSafe(tx.senderCommission)
        : undefined,
    loyaltyPointsEarned:
      tx.loyaltyPointsEarned !== undefined
        ? toNumberSafe(tx.loyaltyPointsEarned)
        : 0,
  };
}

function normalizeWallet(w: unknown): Wallet {
  const ww = (isRecord(w) ? w : {}) as Record<string, unknown>;
  return {
    ...(ww as unknown as Wallet),
    balance: toNumberSafe(ww.balance),
    reservedBalance:
      ww.reservedBalance !== undefined ? toNumberSafe(ww.reservedBalance) : 0,
  };
}

function normalizeExchangeRate(r: unknown): ExchangeRate {
  const rr = (isRecord(r) ? r : {}) as Record<string, unknown>;
  return {
    ...(rr as unknown as ExchangeRate),
    pair: String(rr.pair ?? ""),
    rate: toNumberSafe(rr.rate),
    inverseRate:
      rr.inverseRate !== undefined ? toNumberSafe(rr.inverseRate) : undefined,
    changePercent:
      rr.changePercent !== undefined ? toNumberSafe(rr.changePercent) : undefined,
    updatedAt: rr.updatedAt ? String(rr.updatedAt) : undefined,
  };
}

function normalizeTreasurySnapshot(s: unknown): TreasurySnapshot {
  const ss = (isRecord(s) ? s : {}) as Record<string, unknown>;
  return {
    ...(ss as unknown as TreasurySnapshot),
    totalSent: toNumberSafe(ss.totalSent),
    totalReceived: toNumberSafe(ss.totalReceived),
    totalFees: toNumberSafe(ss.totalFees),
    totalCommission: toNumberSafe(ss.totalCommission),
    openingBalance: toNumberSafe(ss.openingBalance),
    closingBalance: toNumberSafe(ss.closingBalance),
  };
}

function normalizeAgencyPayload(data: CreateAgencyPayload): CreateAgencyPayload {
  return data;
}

function isAxios401(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    typeof err.response?.status === "number" &&
    err.response.status === 401
  );
}

function shouldFallback(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 404 || status === 405 || status === 501;
}

function extractAxiosErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return String(err);
  const status = err.response?.status;
  const data = err.response?.data;
  if (isRecord(data)) {
    const msg = data.message;
    if (typeof msg === "string" && msg.trim())
      return status ? `${status} - ${msg}` : msg;
    if (Array.isArray(msg) && typeof msg[0] === "string")
      return status ? `${status} - ${msg[0]}` : msg[0];
    const errTxt = data.error;
    if (typeof errTxt === "string") return status ? `${status} - ${errTxt}` : errTxt;
  }
  const fallback = err.message || "Erreur réseau";
  return status ? `${status} - ${fallback}` : fallback;
}

async function tryMany<T>(fns: Array<() => Promise<T>>, label: string): Promise<T> {
  let lastErr: unknown;
  for (const fn of fns) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!shouldFallback(e)) break;
    }
  }
  console.error(`API tryMany failed (${label})`, extractAxiosErrorMessage(lastErr));
  throw lastErr;
}

// ============================================================
// SECURE STORAGE — SecureStore + fallback AsyncStorage (web/Expo)
// ============================================================

async function secureGet(key: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val) {
      devLog(`🔐 secureGet[${key}]: SecureStore OK`);
      return val;
    }
  } catch {
    devWarn(`🔐 secureGet[${key}]: SecureStore indisponible → AsyncStorage`);
  }
  try {
    const val = await AsyncStorage.getItem(key);
    if (val) devLog(`🔐 secureGet[${key}]: AsyncStorage OK`);
    return val;
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    devLog(`🔐 secureSet[${key}]: SecureStore OK`);
    return;
  } catch {
    devWarn(`🔐 secureSet[${key}]: SecureStore indisponible → AsyncStorage`);
  }
  try {
    await AsyncStorage.setItem(key, value);
    devLog(`🔐 secureSet[${key}]: AsyncStorage OK`);
  } catch (e) {
    devWarn(`🔐 secureSet[${key}]: échec total`, e);
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch { /* noop */ }
  try {
    await AsyncStorage.removeItem(key);
  } catch { /* noop */ }
}

// ============================================================
// API CLASS
// ============================================================

class API {
  public http: AxiosInstance;
  public uploadHttp: AxiosInstance;

  private token: string | null = null;
  private refreshToken: string | null = null;
  private tenant: string = getInitialTenantId();

  private isRefreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];
  private refreshPromise: Promise<string> | null = null;
  private initPromise: Promise<void>;

  constructor() {
    const baseURL = buildApiBaseURL();

    this.http = this.createHttp(30_000);
    this.uploadHttp = this.createHttp(120_000);

    devLog("🌐 API Init | URL:", baseURL, "| Tenant initial:", this.tenant);

    this.initPromise = this.loadPersistedState();

    this.setupInterceptors(this.http);
    this.setupInterceptors(this.uploadHttp);
  }

  private createHttp(timeout: number): AxiosInstance {
    return axios.create({
      baseURL: buildApiBaseURL(),
      timeout,
      headers: { "Content-Type": "application/json" },
    });
  }

  private setupInterceptors(instance: AxiosInstance): void {
    instance.interceptors.request.use(async (config) => {
      await this.initPromise;

      const headers = ensureAxiosHeaders(config.headers);

      if (!this.tenant || this.tenant === PLATFORM_TENANT) {
        await this.loadPersistedTenant();
      }

      if (!this.token) {
        try {
          const saved =
            (await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) ??
            (await AsyncStorage.getItem("token"));
          if (saved) this.token = saved;
        } catch (e) {
          devWarn("AsyncStorage token read error", e);
        }
      }

      devLog("------------------------------------------");
      devLog("🚀", config.method?.toUpperCase(), config.url);
      devLog("🆔 TENANT ENVOYÉ:", this.tenant);
      devLog("🔑 TOKEN:", this.token ? `OUI (${this.token.substring(0, 12)}...)` : "NON");
      devLog("🌍 BASE URL:", config.baseURL);
      devLog("------------------------------------------");

      headers.set("x-tenant-id", this.tenant);

      if (this.token && this.token.trim().length > 0) {
        headers.set(
          "Authorization",
          `Bearer ${this.token.replace(/^"|"$/g, "")}`,
        );
      }

      config.headers = headers;
      return config;
    });

    instance.interceptors.response.use(
      (res) => res,
      async (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const method = (err.config?.method ?? "GET").toUpperCase();
          const fullUrl = `${err.config?.baseURL ?? ""}${err.config?.url ?? ""}`;
          const status = err.response?.status;

          const originalConfig = err.config as RetryableRequestConfig | undefined;

          if (
            status === 401 &&
            this.refreshToken &&
            originalConfig &&
            !originalConfig._retry &&
            !originalConfig.url?.includes("/auth/refresh")
          ) {
            originalConfig._retry = true;

            try {
              if (!this.refreshPromise) {
                this.refreshPromise = this.attemptTokenRefresh().finally(() => {
                  this.refreshPromise = null;
                });
              }

              const newToken = await this.refreshPromise;
              this.token = newToken;

              for (const cb of this.refreshQueue) {
                try { cb(newToken); } catch (e) {
                  devWarn("Refresh queue callback failed", e);
                }
              }
              this.refreshQueue = [];

              const headers = ensureAxiosHeaders(originalConfig.headers);
              headers.set("Authorization", `Bearer ${newToken}`);
              originalConfig.headers = headers;
              return instance.request(originalConfig);
            } catch {
              this.refreshQueue = [];
              await this.clearTokens();
            }
          } else if (
            status === 401 &&
            this.refreshPromise &&
            originalConfig &&
            !originalConfig._retry
          ) {
            return new Promise((resolve) => {
              this.refreshQueue.push((token) => {
                if (originalConfig) {
                  const headers = ensureAxiosHeaders(originalConfig.headers);
                  headers.set("Authorization", `Bearer ${token}`);
                  originalConfig.headers = headers;
                  resolve(instance.request(originalConfig));
                }
              });
            });
          }

          console.error(
            "❌ HTTP ERROR",
            method,
            fullUrl,
            "| status:", status,
            "| tenant:", this.tenant,
            "| msg:", extractAxiosErrorMessage(err),
          );
        } else {
          console.error("❌ HTTP ERROR (non-axios)", String(err));
        }
        return Promise.reject(err);
      },
    );
  }

  // ============================================================
  // TENANT / TOKEN / STATE
  // ============================================================

  private async loadPersistedState(): Promise<void> {
    await this.loadPersistedTenant();
    try {
      const rt = await secureGet(STORAGE_KEYS.REFRESH_TOKEN);
      if (rt) {
        this.refreshToken = rt;
        devLog("🔐 refreshToken chargé depuis storage");
        return;
      }
    } catch { /* SecureStore indisponible */ }
    try {
      const rt = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (rt) {
        this.refreshToken = rt;
        devLog("🔐 refreshToken chargé depuis AsyncStorage (fallback)");
      }
    } catch { /* noop */ }
  }

  private async loadPersistedTenant(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_TENANT);
      devLog("📦 loadPersistedTenant — valeur brute:", saved ?? "(vide)");
      this.tenant = normalizeTenant(saved);
      devLog("📦 loadPersistedTenant — normalisé:", this.tenant);
      if (this.tenant !== saved) {
        await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, this.tenant);
      }
    } catch {
      devWarn("AsyncStorage tenant read error");
    }
  }

  async setTenant(tenant: string): Promise<void> {
    const normalized = normalizeTenant(tenant);
    devLog("🎯 setTenant:", tenant, "→", normalized);
    this.tenant = normalized;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, normalized);
    } catch { /* noop */ }
  }

  getTenant(): string {
    return this.tenant;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // ✅ v5.6 — permet à AuthProvider de synchroniser le refresh token en
  // mémoire après register()/applyLoginResult(), qui ne passent pas par
  // login()/loginStep2() (les seuls endroits qui le faisaient jusqu'ici).
  // Sans ça, this.refreshToken restait null en mémoire même si le
  // refresh token était bien persisté en storage — et le refresh
  // automatique sur 401 (dans l'intercepteur ci-dessus) ne se
  // déclenchait donc jamais pour les sessions issues de l'inscription
  // ou du login v2.
  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }

  private async clearTokens(): Promise<void> {
    this.token = null;
    this.refreshToken = null;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      secureDelete(STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  }

  private platformHeaders(): Record<string, string> {
    return { "x-tenant-id": PLATFORM_TENANT };
  }

  private async attemptTokenRefresh(): Promise<string> {
    const res = await this.http.post<RefreshTokenResponse>("/auth/refresh", {
      refresh_token: this.refreshToken,
    });
    const { access_token, refresh_token } = res.data;
    this.token = access_token;
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
    if (refresh_token) {
      this.refreshToken = refresh_token;
      await secureSet(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
    }
    return access_token;
  }

  // ============================================================
  // AUTH
  // ============================================================

  async register(data: RegisterPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/register", data);
    return res.data;
  }

  async loginStep1(data: LoginPayload): Promise<LoginStep1Response> {
    this.token = null;
    const res = await this.http.post<LoginStep1Response>("/auth/login", data);
    return res.data;
  }

  // ✅ v6.4 — Connexion par téléphone : envoie un OTP 4 chiffres par SMS
  async loginByPhone(phone: string): Promise<{ userId: string; maskedPhone: string }> {
    const res = await this.http.post<{ userId: string; maskedPhone: string }>(
      "/auth/login-by-phone",
      { phone },
    );
    return res.data;
  }

  async loginStep2(data: VerifyLoginOtpPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login/verify-otp", data);

    if (res.data?.access_token) {
      this.token = res.data.access_token;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);

      if (res.data.refresh_token) {
        this.refreshToken = res.data.refresh_token;
        await secureSet(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
      }

      if (res.data?.user?.client?.code) {
        devLog("🎯 Tenant détecté via loginStep2:", res.data.user.client.code);
        await this.setTenant(res.data.user.client.code);
      }
    }

    return res.data;
  }

  async login(data: LoginPayload): Promise<LoginResponse> {
    this.token = null;
    const payload = { email: data.identifier, password: data.password };
    const res = await this.http.post<LoginResponse>("/auth/login", payload);

    if (res.data?.access_token) {
      this.token = res.data.access_token;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);

      if (res.data.refresh_token) {
        this.refreshToken = res.data.refresh_token;
        await secureSet(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
      }

      if (res.data?.user?.client?.code) {
        devLog("🎯 Tenant détecté via login:", res.data.user.client.code);
        await this.setTenant(res.data.user.client.code);
      }
    }

    return res.data;
  }

  async logout(): Promise<void> {
    try {
      await this.http.post("/auth/logout");
    } catch { /* noop */ } finally {
      await this.clearTokens();
    }
  }

  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");
    if (res.data?.client?.code) {
      devLog("🎯 Tenant mis à jour via getMe:", res.data.client.code);
      await this.setTenant(res.data.client.code);
    }
    return res.data;
  }

  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const res = await this.http.patch<AuthUser>("/auth/me", data);
    return res.data;
  }

  async changePassword(data: ChangePasswordPayload): Promise<void> {
    const old = (data.oldPassword ?? data.currentPassword ?? "").trim();
    const nw = (data.newPassword ?? data.password ?? "").trim();
    await this.http.patch("/auth/change-password", { oldPass: old, newPass: nw });
  }

  async findAccount(
    identifier: string,
  ): Promise<{ userId: string; channels: Array<"EMAIL" | "PHONE"> }> {
    const res = await this.http.post("/auth/find-account", { identifier });
    return res.data as { userId: string; channels: Array<"EMAIL" | "PHONE"> };
  }

  async sendOtp(
    userId: string,
    channel: "EMAIL" | "PHONE",
    purpose?: string,
  ): Promise<void> {
    await this.http.post("/auth/send-otp", { userId, channel, purpose });
  }

  async verifyOtp(
    userId: string,
    code: string,
    type: string = "PASSWORD_RESET",
  ): Promise<void> {
    await this.http.post("/auth/verify-otp", { userId, code, type });
  }

  async resetPassword(
    userId: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await this.http.post("/auth/reset-password", { userId, code, newPassword });
  }

  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    const res = await this.http.post<RefreshTokenResponse>("/auth/refresh", {
      refresh_token: this.refreshToken,
    });
    if (res.data.access_token) {
      this.token = res.data.access_token;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);
    }
    return res.data;
  }

  // ============================================================
  // DEVICES (Push FCM/APNS)
  // ============================================================

  async registerDevice(data: RegisterDevicePayload): Promise<UserDevice> {
    const res = await this.http.post<UserDevice>("/auth/devices", data);
    return res.data;
  }

  async getDevices(): Promise<UserDevice[]> {
    const res = await this.http.get<unknown>("/auth/devices");
    return unwrapArray<UserDevice>(res.data);
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.http.delete(`/auth/devices/${deviceId}`);
  }

  async trustDevice(deviceId: string, otpCode: string): Promise<UserDevice> {
    const res = await this.http.post<UserDevice>(`/auth/devices/${deviceId}/trust`, {
      code: otpCode,
    });
    return res.data;
  }

  // ============================================================
  // OTP LOGS
  // ============================================================

  async getOtpLogs(): Promise<OtpLog[]> {
    const res = await this.http.get<unknown>("/auth/otp-logs");
    return unwrapArray<OtpLog>(res.data);
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  async getNotifications(params?: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Notification[]> {
    try {
      const res = await this.http.get<unknown>("/notifications", { params });
      return unwrapArray<Notification>(res.data);
    } catch {
      return [];
    }
  }

  // ============================================================
  // USERS (ADMIN)
  // ============================================================

  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/users", { params }),
        async () => this.http.get<unknown>("/admin/users", { params }),
      ],
      "getUsers",
    );
    return unwrapArray<unknown>(data.data);
  }

  async createUser(payload: unknown): Promise<unknown> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/users", payload),
        async () => this.http.post<unknown>("/admin/users", payload),
      ],
      "createUser",
    );
    return data.data;
  }

  async suspendUser(userId: string, reason?: string): Promise<unknown> {
    const res = await this.http.patch(`/users/${userId}/suspend`, { reason });
    return res.data;
  }

  async reactivateUser(userId: string): Promise<unknown> {
    const res = await this.http.patch(`/users/${userId}/reactivate`);
    return res.data;
  }

  // ✅ v5.4 — Résolution d'identité publique pour le flux QR / P2P
  async getPublicUser(id: string): Promise<{
    id: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    primaryCurrency?: string;
  }> {
    const res = await this.http.get(`/users/public/${id}`);
    return res.data as {
      id: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      primaryCurrency?: string;
    };
  }

  // ============================================================
  // WALLETS
  // ============================================================

  async getMyWallets(): Promise<Wallet[]> {
    const res = await this.http.get<unknown>("/wallets/me");
    return unwrapArray<Wallet>(res.data).map(normalizeWallet);
  }

  // ✅ v5.5 — Branding depuis un hostname (sous-domaine ou domaine custom)
  // Appelé par TenantProvider.tsx au démarrage si Platform.OS === 'web'
  // GET /branding/by-host?host=flash.direct-transfer.com
  async getBrandingByHost(host: string): Promise<{
    code:           string;
    name:           string;
    logoUrl:        string | null;
    primaryColor:   string;
    secondaryColor: string;
    tagline:        string | null;
    fontFamily:     string | null;
    splashBgColor:  string | null;
    welcomeMessage: string | null;
    subdomain:      string | null;
    customDomain:   string | null;
    isActive:       boolean;
  } | null> {
    try {
      const res = await this.http.get(
        `/branding/by-host?host=${encodeURIComponent(host)}`,
        { headers: { "x-tenant-id": "DONIKO" } },
      );
      return res.data ?? null;
    } catch (e) {
      devLog(`⚠️ getBrandingByHost("${host}"): non trouvé →`, extractAxiosErrorMessage(e));
      return null;
    }
  }

  async getClientPublicBranding(code: string): Promise<any> {
    const res = await this.http.get(
      `/branding/${code.trim().toUpperCase()}`,
      { headers: { "x-tenant-id": "DONIKO" } },
    );
    return res.data;
  }

  async getWalletLedger(
    walletId: string,
    params?: { page?: number; limit?: number; from?: string; to?: string },
  ): Promise<LedgerEntry[]> {
    const res = await this.http.get<unknown>(`/wallets/${walletId}/ledger`, { params });
    return unwrapArray<LedgerEntry>(res.data);
  }

  // ============================================================
  // TREASURY (ADMIN)
  // ============================================================

  async getTreasuryOverview(params?: {
    date?: string;
    clientId?: number;
  }): Promise<TreasuryOverview[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/treasury/overview", { params }),
        async () => this.http.get<unknown>("/admin/treasury/overview", { params }),
      ],
      "getTreasuryOverview",
    );
    return unwrapArray<TreasuryOverview>(data.data);
  }

  async getTreasurySnapshots(params?: {
    currency?: Currency | string;
    from?: string;
    to?: string;
    clientId?: number;
  }): Promise<TreasurySnapshot[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/treasury/snapshots", { params }),
        async () => this.http.get<unknown>("/admin/treasury/snapshots", { params }),
      ],
      "getTreasurySnapshots",
    );
    return unwrapArray<unknown>(data.data).map(normalizeTreasurySnapshot);
  }

  async adminRefillAgency(
    agencyId: string,
    amount: number,
    currency: Currency | string = "XOF",
  ): Promise<unknown> {
    const payload = { agencyId, amount, currency };
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () =>
          this.http.post<unknown>("/transactions/admin/refill-agency", payload),
        async () =>
          this.http.post<unknown>(`/admin/agencies/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/agencies/${agencyId}/refill`, payload),
      ],
      "adminRefillAgency",
    );
    return data.data;
  }

  async adminFundSelf(
    amount: number,
    currency: Currency | string = "XOF",
  ): Promise<unknown> {
    const payload = {
      currency: String(currency).toUpperCase(),
      amount: Number(amount),
    };
    try {
      const res = await this.http.post("/treasury/admin/inject", payload, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch {
      const data = await tryMany<AxiosResponse<unknown>>(
        [
          async () =>
            this.http.post<unknown>("/transactions/admin/fund-self", payload),
          async () => this.http.post<unknown>("/admin/fund-self", payload),
          async () => this.http.post<unknown>("/admin/treasury/fund-self", payload),
        ],
        "adminFundSelf",
      );
      return data.data;
    }
  }

  // ✅ FIX v5.3 — un seul appel direct, timeout 15s, pas de retry
  async declareBankTransfer(
    amount: number,
    refBancaire?: string,
    currency: Currency | string = "XOF",
  ): Promise<unknown> {
    const reference = (refBancaire ?? "").trim();
    const payload = {
      amount,
      currency,
      ref: reference,
      refBancaire: reference,
      reference,
      method: "BANK_TRANSFER",
      paymentMethod: "BANK_TRANSFER",
    };
    const res = await this.http.post<unknown>(
      "/transactions/b2b/declare",
      payload,
      { timeout: 15_000 },
    );
    return res.data;
  }

  // ============================================================
  // AGENCIES
  // ============================================================

  async getAgencies(params?: {
    page?: number;
    limit?: number;
    country?: string;
    currency?: string;
  }): Promise<Agency[]> {
    const headers = { "x-tenant-id": this.tenant };
    const res = await this.http.get<unknown>("/agencies", { params, headers });
    return unwrapArray<Agency>(res.data);
  }

  async getAgency(id: string): Promise<Agency> {
    const res = await this.http.get<Agency>(`/agencies/${id}`);
    return res.data;
  }

  async createAgency(data: CreateAgencyPayload): Promise<unknown> {
    const safe = normalizeAgencyPayload(data);
    const res = await this.http.post("/agencies", safe);
    return res.data;
  }

  async updateAgency(
    id: string,
    data: Partial<CreateAgencyPayload>,
  ): Promise<unknown> {
    const res = await this.http.patch(`/agencies/${id}`, data);
    return res.data;
  }

  async deleteAgency(id: string): Promise<void> {
    await this.http.delete(`/agencies/${id}`);
  }

  async getAgencyWallets(agencyId: string): Promise<Wallet[]> {
    const res = await this.http.get<unknown>(`/agencies/${agencyId}/wallets`);
    return unwrapArray<Wallet>(res.data).map(normalizeWallet);
  }

  // ============================================================
  // BENEFICIARIES
  // ============================================================

  async getBeneficiaries(): Promise<Beneficiary[]> {
    const res = await this.http.get<unknown>("/beneficiaries");
    return unwrapArray<Beneficiary>(res.data);
  }

  async getBeneficiary(id: string): Promise<Beneficiary> {
    const res = await this.http.get<Beneficiary>(`/beneficiaries/${id}`);
    return res.data;
  }

  async createBeneficiary(data: CreateBeneficiaryPayload): Promise<Beneficiary> {
    const res = await this.http.post<Beneficiary>("/beneficiaries", data);
    return res.data;
  }

  async updateBeneficiary(
    id: string,
    data: Partial<CreateBeneficiaryPayload>,
  ): Promise<Beneficiary> {
    const res = await this.http.patch<Beneficiary>(`/beneficiaries/${id}`, data);
    return res.data;
  }

  async deleteBeneficiary(id: string): Promise<{ deleted: true; id: string }> {
    const res = await this.http.delete<{ deleted: true; id: string }>(
      `/beneficiaries/${id}`,
    );
    return res.data;
  }

  async toggleFavoriteBeneficiary(id: string): Promise<Beneficiary> {
    const res = await this.http.patch<Beneficiary>(
      `/beneficiaries/${id}/favorite`,
    );
    return res.data;
  }

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  async createTransaction(data: CreateTransactionPayload): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions", data);
    return normalizeTransaction(res.data);
  }

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    status?: TransactionStatus | string;
    currency?: Currency | string;
    from?: string;
    to?: string;
  }): Promise<Transaction[]> {
    const res = await this.http.get<unknown>("/transactions", { params });
    return unwrapArray<unknown>(res.data).map(normalizeTransaction);
  }

  async getTransaction(id: string): Promise<Transaction> {
    const res = await this.http.get<Transaction>(`/transactions/${id}`);
    return normalizeTransaction(res.data);
  }

  async cancelTransaction(id: string): Promise<Transaction> {
    return tryMany<Transaction>(
      [
        async () => {
          const res = await this.http.patch<Transaction>(
            `/transactions/${id}/cancel`,
          );
          return normalizeTransaction(res.data);
        },
        async () => {
          const res = await this.http.post<Transaction>(
            `/transactions/${id}/cancel`,
          );
          return normalizeTransaction(res.data);
        },
      ],
      "cancelTransaction",
    );
  }

  async depositAgent(data: {
    amount: number;
    userPhone: string;
    currency?: Currency | string;
  }): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions/deposit", data);
    return normalizeTransaction(res.data);
  }

  // ============================================================
  // VIREMENTS PROGRAMMÉS
  // ============================================================

  async getScheduledTransfers(): Promise<ScheduledTransfer[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/scheduled-transfers"),
        async () => this.http.get<unknown>("/transactions/scheduled"),
      ],
      "getScheduledTransfers",
    );
    return unwrapArray<ScheduledTransfer>(data.data);
  }

  async createScheduledTransfer(
    data: CreateScheduledTransferPayload,
  ): Promise<ScheduledTransfer> {
    const res = await tryMany<AxiosResponse<ScheduledTransfer>>(
      [
        async () =>
          this.http.post<ScheduledTransfer>("/scheduled-transfers", data),
        async () =>
          this.http.post<ScheduledTransfer>("/transactions/scheduled", data),
      ],
      "createScheduledTransfer",
    );
    return res.data;
  }

  async pauseScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    const res = await this.http.patch<ScheduledTransfer>(
      `/scheduled-transfers/${id}/pause`,
    );
    return res.data;
  }

  async resumeScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    const res = await this.http.patch<ScheduledTransfer>(
      `/scheduled-transfers/${id}/resume`,
    );
    return res.data;
  }

  async cancelScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    const res = await this.http.patch<ScheduledTransfer>(
      `/scheduled-transfers/${id}/cancel`,
    );
    return res.data;
  }

  // ============================================================
  // WITHDRAWALS
  // ============================================================

  async requestWithdrawal(data: {
    amount?: number;
    transactionId?: string;
    currency?: Currency | string;
  }): Promise<unknown> {
    const res = await this.http.post("/withdrawals", data);
    return res.data;
  }

  async getWithdrawals(params?: {
    page?: number;
    limit?: number;
  }): Promise<Withdrawal[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/withdrawals",    { params }),
        async () => this.http.get<unknown>("/withdrawals/me", { params }),
      ],
      "getWithdrawals",
    );
    return unwrapArray<Withdrawal>(data.data);
  }

  async checkWithdrawalCode(code: string): Promise<unknown> {
    return tryMany<unknown>(
      [
        async () => {
          const res = await this.http.post("/withdrawals/agent/check", { code });
          return res.data;
        },
        async () => {
          const res = await this.http.post("/withdrawals/check", { code });
          return res.data;
        },
      ],
      "checkWithdrawalCode",
    );
  }

  async processWithdrawalPayment(code: string): Promise<unknown> {
    return tryMany<unknown>(
      [
        async () => {
          const res = await this.http.post("/withdrawals/agent/pay", { code });
          return res.data;
        },
        async () => {
          const res = await this.http.post("/withdrawals/pay", { code });
          return res.data;
        },
      ],
      "processWithdrawalPayment",
    );
  }

  // ============================================================
  // ADMIN TRANSACTIONS
  // ============================================================

  async adminGetTransactions(params?: {
    page?: number;
    limit?: number;
    status?: TransactionStatus | string;
    currency?: Currency | string;
    from?: string;
    to?: string;
  }): Promise<Transaction[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/transactions/admin", { params }),
        async () => this.http.get<unknown>("/transactions/admin/all", { params }),
      ],
      "adminGetTransactions",
    );
    return unwrapArray<unknown>(data.data).map(normalizeTransaction);
  }

  async adminUpdateTransactionStatus(
    id: string,
    status: TransactionStatus | string,
  ): Promise<Transaction> {
    const data = await tryMany<AxiosResponse<Transaction>>(
      [
        async () =>
          this.http.patch<Transaction>(`/transactions/${id}/status`, { status }),
        async () =>
          this.http.patch<Transaction>(
            `/transactions/admin/status/${id}`,
            { status },
          ),
      ],
      "adminUpdateTransactionStatus",
    );
    return normalizeTransaction(data.data);
  }

  async validateBankTransfer(id: string): Promise<Transaction> {
    const data = await tryMany<AxiosResponse<Transaction>>(
      [
        async () =>
          this.http.patch<Transaction>(`/transactions/b2b/validate/${id}`),
        async () =>
          this.http.post<Transaction>(`/transactions/${id}/validate`),
      ],
      "validateBankTransfer",
    );
    return normalizeTransaction(data.data);
  }

  async rejectBankTransfer(id: string): Promise<Transaction> {
    const data = await tryMany<AxiosResponse<Transaction>>(
      [
        async () =>
          this.http.patch<Transaction>(`/transactions/b2b/reject/${id}`),
        async () =>
          this.http.post<Transaction>(`/transactions/${id}/reject`),
      ],
      "rejectBankTransfer",
    );
    return normalizeTransaction(data.data);
  }

  // ============================================================
  // TAUX DE CHANGE
  // ============================================================

  async getExchangeRates(): Promise<ExchangeRate[]> {
    try {
      const data = await tryMany<AxiosResponse<unknown>>(
        [
          async () => this.http.get<unknown>("/rates"),
          async () => this.http.get<unknown>("/exchange-rates"),
          async () => this.http.get<unknown>("/exchange-rates/all"),
          async () => this.http.get<unknown>("/rates/all"),
        ],
        "getExchangeRates",
      );
      const list = unwrapArray<unknown>(data.data).map(normalizeExchangeRate);
      if (list.length > 0) return list;
      throw new Error("Réponse vide");
    } catch {
      devLog("⚠️ getExchangeRates: API indisponible → taux de secours");
      return [
        { pair: "EUR_XOF", rate: 655.957, inverseRate: 1 / 655.957 },
        { pair: "EUR_GNF", rate: 9600,    inverseRate: 1 / 9600    },
        { pair: "EUR_USD", rate: 1.08,    inverseRate: 1 / 1.08    },
        { pair: "EUR_GBP", rate: 0.85,    inverseRate: 1 / 0.85    },
        { pair: "USD_XOF", rate: 607.55,  inverseRate: 1 / 607.55  },
        { pair: "GBP_XOF", rate: 771.71,  inverseRate: 1 / 771.71  },
        { pair: "XOF_GNF", rate: 14.63,   inverseRate: 1 / 14.63   },
      ].map(normalizeExchangeRate);
    }
  }

  async getExchangeRateHistory(
    pair: string,
    params?: { from?: string; to?: string; limit?: number },
  ): Promise<ExchangeRateHistory[]> {
    try {
      const data = await tryMany<AxiosResponse<unknown>>(
        [
          async () => this.http.get<unknown>(`/rates/${pair}/history`, { params }),
          async () =>
            this.http.get<unknown>(`/exchange-rates/${pair}/history`, { params }),
        ],
        "getExchangeRateHistory",
      );
      return unwrapArray<ExchangeRateHistory>(data.data);
    } catch {
      return [];
    }
  }

  async updateExchangeRate(pair: string, rate: number): Promise<void> {
    await tryMany<void>(
      [
        async () => { await this.http.post("/rates", { pair, rate }); },
        async () => { await this.http.patch(`/rates/${pair}`, { rate }); },
      ],
      "updateExchangeRate",
    );
  }

  async convertAmount(
    amount: number,
    from: Currency | string,
    to: Currency | string,
  ): Promise<{ amount: number; rate: number; convertedAmount: number }> {
    try {
      const res = await this.http.post<{
        amount: number;
        rate: number;
        convertedAmount: number;
      }>("/rates/convert", { amount, from, to });
      return res.data;
    } catch {
      devLog("⚠️ convertAmount: API indisponible → calcul local");
      const RATES: Record<string, number> = {
        "EUR_XOF": 655.957, "EUR_GNF": 9600,   "EUR_USD": 1.08,  "EUR_GBP": 0.85,
        "USD_XOF": 607.55,  "USD_GNF": 8889,   "GBP_XOF": 771.71,
        "XOF_EUR": 1 / 655.957, "GNF_EUR": 1 / 9600,
        "XOF_GNF": 14.63,       "GNF_XOF": 1 / 14.63,
        "GBP_EUR": 1 / 0.85,    "USD_EUR": 1 / 1.08,
      };
      const key = `${String(from).toUpperCase()}_${String(to).toUpperCase()}`;
      const rate = RATES[key] ?? (String(from) === String(to) ? 1 : 1);
      const convertedAmount = Math.round(amount * rate * 100) / 100;
      return { amount, rate, convertedAmount };
    }
  }

  // ============================================================
  // ALERTES TAUX DE CHANGE
  // ============================================================

  async getRateAlerts(): Promise<RateAlert[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/rate-alerts"),
        async () => this.http.get<unknown>("/rates/alerts"),
      ],
      "getRateAlerts",
    );
    return unwrapArray<RateAlert>(data.data);
  }

  async createRateAlert(data: CreateRateAlertPayload): Promise<RateAlert> {
    const res = await tryMany<AxiosResponse<RateAlert>>(
      [
        async () => this.http.post<RateAlert>("/rate-alerts", data),
        async () => this.http.post<RateAlert>("/rates/alerts", data),
      ],
      "createRateAlert",
    );
    return res.data;
  }

  async deleteRateAlert(id: string): Promise<void> {
    await tryMany<void>(
      [
        async () => { await this.http.delete(`/rate-alerts/${id}`); },
        async () => { await this.http.delete(`/rates/alerts/${id}`); },
      ],
      "deleteRateAlert",
    );
  }

  // ============================================================
  // COMMISSIONS
  // ============================================================

  async getCommissionRules(): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/commissions"),
        async () => this.http.get<unknown>("/commissions/rules"),
      ],
      "getCommissionRules",
    );
    return unwrapArray<unknown>(data.data);
  }

  async saveCommissionRule(payload: CommissionRule): Promise<unknown> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/commissions", payload),
        async () => this.http.post<unknown>("/commissions/rules", payload),
      ],
      "saveCommissionRule",
    );
    return data.data;
  }

  async getCommissionHistory(period: string): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () =>
          this.http.get<unknown>(
            `/commissions/history?period=${encodeURIComponent(period)}`,
          ),
      ],
      "getCommissionHistory",
    );
    return unwrapArray<unknown>(data.data);
  }

  // ============================================================
  // KYC
  // ============================================================

  async getMyKycDocuments(): Promise<KycDocument[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/kyc"),
        async () => this.http.get<unknown>("/kyc/documents"),
      ],
      "getMyKycDocuments",
    );
    return unwrapArray<KycDocument>(data.data);
  }

  async submitKycDocument(data: SubmitKycPayload): Promise<KycDocument> {
    const res = await tryMany<AxiosResponse<KycDocument>>(
      [
        async () => this.http.post<KycDocument>("/kyc", data),
        async () => this.http.post<KycDocument>("/kyc/documents", data),
      ],
      "submitKycDocument",
    );
    return res.data;
  }

  // ============================================================
  // FIDÉLITÉ
  // ============================================================

  async getLoyaltyBalance(): Promise<{
    points: number;
    tier: string;
    nextTierPoints: number;
  }> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/loyalty/balance"),
        async () => this.http.get<unknown>("/loyalty"),
      ],
      "getLoyaltyBalance",
    );
    return data.data as { points: number; tier: string; nextTierPoints: number };
  }

  async getLoyaltyHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<LoyaltyTransaction[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/loyalty/history", { params }),
        async () => this.http.get<unknown>("/loyalty/transactions", { params }),
      ],
      "getLoyaltyHistory",
    );
    return unwrapArray<LoyaltyTransaction>(data.data);
  }

  async getLoyaltyConfig(): Promise<LoyaltyConfig | null> {
    try {
      const res = await this.http.get<LoyaltyConfig>("/loyalty/config");
      return res.data;
    } catch {
      return null;
    }
  }

  // ============================================================
  // COUNTRY CURRENCY MAP
  // ============================================================

  async getCountryCurrencies(): Promise<CountryCurrency[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/country-currencies"),
        async () => this.http.get<unknown>("/rates/countries"),
      ],
      "getCountryCurrencies",
    );
    return unwrapArray<CountryCurrency>(data.data);
  }

  async getCurrencyForCountry(countryCode: string): Promise<string> {
    try {
      const res = await this.http.get<{ currencyCode: string }>(
        `/country-currencies/${countryCode.toUpperCase()}`,
      );
      return res.data.currencyCode;
    } catch {
      const map: Record<string, string> = {
        FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", BE: "EUR", PT: "EUR",
        NL: "EUR", AT: "EUR", FI: "EUR", IE: "EUR", LU: "EUR", GR: "EUR",
        GB: "GBP", GG: "GBP", JE: "GBP",
        US: "USD", SV: "USD", PA: "USD",
        GN: "GNF",
        SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", BJ: "XOF",
        TG: "XOF", NE: "XOF", GW: "XOF",
      };
      return map[countryCode.toUpperCase()] ?? "XOF";
    }
  }

  // ============================================================
  // COMMUNICATIONS (Admin)
  // ============================================================

  async getCommunicationLogs(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }): Promise<CommunicationLog[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/admin/communications", { params }),
        async () => this.http.get<unknown>("/communications", { params }),
      ],
      "getCommunicationLogs",
    );
    return unwrapArray<CommunicationLog>(data.data);
  }

  // ============================================================
  // AML (Admin)
  // ============================================================

  async getAmlFlags(params?: {
    page?: number;
    limit?: number;
    isReviewed?: boolean;
  }): Promise<AmlFlag[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/admin/aml", { params }),
        async () => this.http.get<unknown>("/aml/flags", { params }),
      ],
      "getAmlFlags",
    );
    return unwrapArray<AmlFlag>(data.data);
  }

  async reviewAmlFlag(id: string, resolution: string): Promise<AmlFlag> {
    const res = await this.http.patch<AmlFlag>(`/admin/aml/${id}/review`, {
      resolution,
    });
    return res.data;
  }

  // ============================================================
  // ALERTES (Admin)
  // ============================================================

  async getAlerts(params?: {
    isResolved?: boolean;
    severity?: string;
    page?: number;
  }): Promise<Alert[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/admin/alerts", { params }),
        async () => this.http.get<unknown>("/alerts", { params }),
      ],
      "getAlerts",
    );
    return unwrapArray<Alert>(data.data);
  }

  async resolveAlert(id: string): Promise<Alert> {
    const res = await this.http.patch<Alert>(`/admin/alerts/${id}/resolve`);
    return res.data;
  }

  // ============================================================
  // AUDIT LOGS (Admin)
  // ============================================================

  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
  }): Promise<AuditLog[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/admin/audit-logs", { params }),
        async () => this.http.get<unknown>("/audit-logs", { params }),
      ],
      "getAuditLogs",
    );
    return unwrapArray<AuditLog>(data.data);
  }

  // ============================================================
  // PROMOTIONS
  // ============================================================

  async validatePromoCode(
    code: string,
    amount?: number,
    currency?: string,
  ): Promise<Promotion | null> {
    try {
      const res = await this.http.post<Promotion>("/promotions/validate", {
        code,
        amount,
        currency,
      });
      return res.data;
    } catch {
      return null;
    }
  }

  async getPromotions(): Promise<Promotion[]> {
    const res = await this.http.get<unknown>("/promotions");
    return unwrapArray<Promotion>(res.data);
  }

  // ============================================================
  // SAAS CLIENTS (Sociétés)
  // ============================================================

  async getClients(): Promise<unknown[]> {
    const headers = this.platformHeaders();
    const res = await tryMany<AxiosResponse<unknown>>(
      [
        () => this.http.get("/clients", { headers }),
        () => this.http.get("/admin/clients", { headers }),
        () => this.http.get("/saas/clients", { headers }),
      ],
      "getClients",
    );
    return unwrapArray(res.data);
  }

  async getClient(id: number): Promise<Client> {
    const headers = this.platformHeaders();
    const res = await tryMany<AxiosResponse<Client>>(
      [
        () => this.http.get<Client>(`/clients/${id}`, { headers }),
        () => this.http.get<Client>(`/admin/clients/${id}`, { headers }),
        () => this.http.get<Client>(`/saas/clients/${id}`, { headers }),
      ],
      "getClient",
    );
    return res.data;
  }

  async createClient(data: unknown): Promise<unknown> {
    const headers = this.platformHeaders();
    try {
      const res = await tryMany<AxiosResponse<unknown>>(
        [
          () => this.http.post("/clients", data, { headers }),
          () => this.http.post("/admin/clients", data, { headers }),
          () => this.http.post("/saas/clients", data, { headers }),
        ],
        "createClient",
      );
      return res.data;
    } catch (e) {
      console.error("createClient failed:", extractAxiosErrorMessage(e));
      throw e;
    }
  }

  async updateClient(id: number | string, data: unknown): Promise<unknown> {
    const headers = this.platformHeaders();
    const res = await this.http.patch(`/clients/${id}`, data, { headers });
    return res.data;
  }

  async updateClientStatus(
    id: number,
    status: ClientSubscriptionStatus,
  ): Promise<Client> {
    const headers = this.platformHeaders();
    const payloadA = { status };
    const payloadB = { subscriptionStatus: status, status };

    const res = await tryMany<AxiosResponse<Client>>(
      [
        () =>
          this.http.patch<Client>(`/clients/${id}/status`, payloadA, { headers }),
        () =>
          this.http.patch<Client>(
            `/admin/clients/${id}/status`,
            payloadA,
            { headers },
          ),
        () =>
          this.http.patch<Client>(
            `/saas/clients/${id}/status`,
            payloadA,
            { headers },
          ),
        () => this.http.patch<Client>(`/clients/${id}`, payloadB, { headers }),
        () =>
          this.http.patch<Client>(`/admin/clients/${id}`, payloadB, { headers }),
        () =>
          this.http.patch<Client>(`/saas/clients/${id}`, payloadB, { headers }),
      ],
      "updateClientStatus",
    );
    return res.data;
  }

  async deleteClient(id: number | string): Promise<unknown> {
    const headers = this.platformHeaders();
    const res = await this.http.delete(`/clients/${id}`, { headers });
    return res.data;
  }

  async getClientWallets(clientId: number): Promise<Wallet[]> {
    const headers = this.platformHeaders();
    const res = await this.http.get<unknown>(`/clients/${clientId}/wallets`, {
      headers,
    });
    return unwrapArray<Wallet>(res.data).map(normalizeWallet);
  }

  // ============================================================
  // WEBHOOKS (Admin)
  // ============================================================

  async getWebhookEndpoints(): Promise<WebhookEndpoint[]> {
    const res = await this.http.get<unknown>("/webhooks");
    return unwrapArray<WebhookEndpoint>(res.data);
  }

  async createWebhookEndpoint(data: {
    url: string;
    events: string[];
  }): Promise<WebhookEndpoint> {
    const res = await this.http.post<WebhookEndpoint>("/webhooks", data);
    return res.data;
  }

  async deleteWebhookEndpoint(id: string): Promise<void> {
    await this.http.delete(`/webhooks/${id}`);
  }

  async getWebhookDeliveries(
    endpointId: string,
    params?: { page?: number; limit?: number },
  ): Promise<WebhookDelivery[]> {
    const res = await this.http.get<unknown>(
      `/webhooks/${endpointId}/deliveries`,
      { params },
    );
    return unwrapArray<WebhookDelivery>(res.data);
  }

  // ============================================================
  // API KEYS (Admin)
  // ============================================================

  async getApiKeys(): Promise<ApiKey[]> {
    const res = await this.http.get<unknown>("/api-keys");
    return unwrapArray<ApiKey>(res.data);
  }

  async createApiKey(data: {
    name: string;
    scopes: string[];
    expiresAt?: string;
    ipWhitelist?: string[];
  }): Promise<ApiKey & { key: string }> {
    const res = await this.http.post<ApiKey & { key: string }>("/api-keys", data);
    return res.data;
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.http.delete(`/api-keys/${id}`);
  }
}

export const api = new API();