// apps/direct-transfair-mobile/services/api.ts
// =========================================================
// ✅ phase 7 : code de la société système lu dans services/platformConfig.ts (plus de « DONIKO » écrit en dur) ; aucun taux de secours.
// DIRECT TRANSF'AIR — API Service v6.2
// ✅ v6.2 : RECONSTRUCTION des méthodes qui manquaient dans ce fichier alors que les écrans les appellent (la copie du
//    dépôt s'arrêtait à getPromotions : 35 méthodes absentes → erreur de compilation et plantage à l'exécution des écrans
//    trésorerie, agences, sociétés, utilisateurs, virements B2B, commissions, taux). Sections ajoutées en fin de classe :
//    TRÉSORERIE ADMIN, TRÉSORERIE AGENCE ⇄ SOCIÉTÉ, VIREMENTS B2B, TRANSACTIONS ADMIN, AGENCES, SOCIÉTÉS, UTILISATEURS,
//    RETRAITS, COMMISSIONS, TAUX (admin), PROFIL ADMIN. Chemins et corps repris des contrôleurs du backend.
//    IDEMPOTENCE : adminRefillAgency, agentRemitToAdmin et adminCollectFromAgency envoient un en-tête Idempotency-Key
//    (services/idempotency.ts, runOnce) : un double appui ou un nouvel essai après coupure ne recharge / ne remet / ne
//    collecte plus deux fois. Aucune méthode existante modifiée.
// ✅ v6.1 : les refus attendus (HTTP 4xx : mauvais identifiants, compte réservé au portail web…) sont journalisés en
//    console.warn au lieu de console.error — en développement, console.error ouvre un bandeau rouge « HTTP ERROR »
//    qui laissait croire à une panne. Les pannes réelles (5xx, réseau) restent en console.error. Rien d'autre modifié.
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
//
// v5.7 — Ajout updateMyCompanyName() : self-service COMPANY_ADMIN pour
//   corriger le nom de sa propre société depuis l'écran de profil
//   (voir PATCH /clients/me/company-name côté backend).
//
// v5.8 — Ajout de 2 méthodes pour la trésorerie agence ⇄ société,
//   section "AGENCY TREASURY" nouvelle, juste après TREASURY (ADMIN) :
//   - agentRemitToAdmin(amount, note?)     → POST /transactions/agency/remit
//   - adminCollectFromAgency(agencyId, amount, note) → POST /transactions/agency/collect
//   Aucune méthode existante modifiée. Backend : voir
//   agency-treasury.controller.ts (fichier indépendant).
//
// v5.9 — Ajout de 4 méthodes pour la recharge wallet (carte / Orange
//   Money / Sendwave), section "RECHARGE WALLET" nouvelle, juste après
//   WALLETS. Backend : voir recharge.service.ts + payments.controller.ts.
//   Aucune méthode existante modifiée.
// v6.0 — 🔥 CORRIGÉ « Application not found » à la connexion : l'URL du serveur
//   n'est plus décidée ici. buildApiBaseURL() passe par
//   services/serverConfig.ts, qui lit EXPO_PUBLIC_API_URL, puis app.json,
//   puis l'URL de production Render, et REFUSE toute URL de l'ancien
//   hébergeur Railway (supprimé). Avant, l'URL de secours codée en dur
//   pointait vers Railway : un build sans variable d'environnement
//   appelait un serveur inexistant. Aucune autre méthode modifiée.
// v6.1 — 🔥 CORRIGÉ : l'appel POST /auth/refresh a maintenant son propre délai (15 s, EXPO_PUBLIC_REFRESH_TIMEOUT_MS)
//   au lieu des 30 s communs : un serveur qui ne répond pas ne fige plus la restauration de session pendant 1 minute.
// =========================================================

import type { UserSession } from "./sessionLabel";
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { getApiBaseUrl } from "./serverConfig";
import { runOnce } from "./idempotency";
import { getPlatformCode } from "./platformConfig";

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
import type {
  MerchantMe,
  MerchantProfileInput,
  MerchantSummary,
  Paged,
  PaymentRequestView,
  PayoutMethod,
  PayoutView,
} from "./merchantTypes";

// ============================================================
// TYPE HELPERS
// ============================================================

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

// ============================================================
// CONFIG
// ============================================================

const PLATFORM_TENANT = getPlatformCode(); // ✅ phase 7 : plus de code de société en dur

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
    devLog("🔧 normalizeTenant: vide → plateforme");
    return PLATFORM_TENANT;
  }

  if (blackList.includes(raw)) {
    devLog(`🔧 normalizeTenant: "${raw}" blacklisté → plateforme`);
    return PLATFORM_TENANT;
  }

  const badPrefixes = ["192.168.", "192.", "10.", "172.", "EXP://"];
  for (const prefix of badPrefixes) {
    if (raw.startsWith(prefix)) {
      devLog(`🔧 normalizeTenant: "${raw}" préfixe IP → plateforme`);
      return PLATFORM_TENANT;
    }
  }

  if (/^\d{1,3}$/.test(raw)) {
    devLog(`🔧 normalizeTenant: "${raw}" segment IP isolé → plateforme`);
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
      devLog(`🔧 normalizeTenant: "${raw}" contient "${sub}" → plateforme`);
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
  return getApiBaseUrl();
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

// ── Assistance : demandes et litiges du client ────────────────────────
export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED";
export interface SupportTicketItem {
  id: string;
  subject: string;
  message: string;
  category: string | null;
  status: SupportTicketStatus;
  isDispute: boolean;
  transactionId: string | null;
  outcome: "ACCEPTED" | "REJECTED" | "INFO" | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SupportTicketReplyItem {
  id: string;
  message: string;
  createdAt: string;
  fromMe: boolean;
  author: { name: string; isStaff: boolean };
}

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

          (status !== undefined && status < 500 ? console.warn : console.error)(
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
    const rt = Number(process.env.EXPO_PUBLIC_REFRESH_TIMEOUT_MS);
    const res = await this.http.post<RefreshTokenResponse>(
      "/auth/refresh",
      { refresh_token: this.refreshToken },
      { timeout: Number.isFinite(rt) && rt >= 3000 ? rt : 15_000 },
    );
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

  // ============================================================
  // SESSIONS ACTIVES — « Appareils connectés » (GET/DELETE /auth/sessions)
  // ============================================================

  async getSessions(): Promise<UserSession[]> {
    const res = await this.http.get<unknown>("/auth/sessions");
    return unwrapArray<UserSession>(res.data);
  }

  async revokeSession(sessionId: string): Promise<{ success: true; wasCurrent: boolean }> {
    const res = await this.http.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
    return res.data as { success: true; wasCurrent: boolean };
  }

  async revokeOtherSessions(): Promise<{ success: true; revoked: number }> {
    const res = await this.http.post("/auth/sessions/revoke-others");
    return res.data as { success: true; revoked: number };
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
  // USERS (public)
  // ============================================================

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
        { headers: { "x-tenant-id": PLATFORM_TENANT } },
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
      { headers: { "x-tenant-id": PLATFORM_TENANT } },
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
  // RECHARGE WALLET — ✅ v5.9 (nouveau)
  // Carte : mock backend (succès immédiat). Orange Money : polling
  // via getRechargeStatus le temps de la simulation (~2s). Sendwave :
  // pas de résolution auto — appeler getRechargeStatus après
  // confirmation admin. Voir recharge.service.ts (backend).
  // ============================================================

  /** Moyens de recharge ouverts par la société du client (réglage « Recharge »). */
  async getRechargeOptions(): Promise<{ methods: string[]; simulated: boolean; blocked: boolean }> {
    const res = await this.http.get<{ methods?: string[]; simulated?: boolean; blocked?: boolean }>(
      "/payments/recharge/options",
    );
    const d = res.data ?? {};
    return {
      methods: Array.isArray(d.methods) ? d.methods.map(String) : [],
      simulated: d.simulated !== false,
      blocked: d.blocked === true,
    };
  }

  async rechargeByCard(payload: {
    amount: number;
    currency: Currency | string;
    cardholderName: string;
    cardNumber: string;
    expiry: string;
  }): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/payments/recharge/card", payload);
    return normalizeTransaction(res.data);
  }

  async rechargeByOrangeMoney(
    amount: number,
    currency: Currency | string,
    momoPhone: string,
    simulateSuccess?: boolean,
  ): Promise<{ transactionId: string; status?: string; providerRef?: string; message?: string }> {
    const res = await this.http.post("/payments/recharge/orange-money", {
      amount,
      currency,
      momoPhone,
      simulateSuccess,
    });
    return res.data;
  }

  async rechargeBySendwave(
    amount: number,
    currency: Currency | string,
  ): Promise<{ transactionId: string; status?: string; providerRef?: string; message?: string }> {
    const res = await this.http.post("/payments/recharge/sendwave", { amount, currency });
    return res.data;
  }

  async getRechargeStatus(transactionId: string): Promise<Transaction> {
    const res = await this.http.get<Transaction>(
      `/payments/recharge/${transactionId}/status`,
    );
    return normalizeTransaction(res.data);
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
    /** Comptes séparés : « client » = opérations du compte client, « merchant » = encaissements et retraits du commerce. Sans valeur : tout. */
    space?: "client" | "merchant";
  }): Promise<Transaction[]> {
    const res = await this.http.get<unknown>("/transactions", { params });
    return unwrapArray<unknown>(res.data).map(normalizeTransaction);
  }

  // ── Assistance (demandes et litiges du client) ──────────────────────
  async getMyTickets(): Promise<SupportTicketItem[]> {
    const res = await this.http.get<{ items?: SupportTicketItem[] }>("/support/tickets");
    return Array.isArray(res.data?.items) ? res.data.items : [];
  }

  async getMyTicket(id: string): Promise<{ ticket: SupportTicketItem; replies: SupportTicketReplyItem[] }> {
    const res = await this.http.get<{ ticket: SupportTicketItem; replies: SupportTicketReplyItem[] }>(`/support/tickets/${encodeURIComponent(id)}`);
    return res.data;
  }

  async openTicket(input: { subject: string; message: string; category?: string; transactionId?: string }): Promise<SupportTicketItem> {
    const res = await this.http.post<SupportTicketItem>("/support/tickets", input);
    return res.data;
  }

  async replyMyTicket(id: string, message: string): Promise<{ ticket: SupportTicketItem; replies: SupportTicketReplyItem[] }> {
    const res = await this.http.post<{ ticket: SupportTicketItem; replies: SupportTicketReplyItem[] }>(`/support/tickets/${encodeURIComponent(id)}/reply`, { message });
    return res.data;
  }

  async getTransaction(id: string): Promise<Transaction> {
    const res = await this.http.get<Transaction>(`/transactions/${id}`);
    return normalizeTransaction(res.data);
  }

  // PATCH /transactions/:id/cancel
  async cancelTransaction(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/${id}/cancel`);
    return normalizeTransaction(res.data);
  }

  // ============================================================
  // VIREMENTS PROGRAMMÉS
  // ============================================================

  async getScheduledTransfers(): Promise<ScheduledTransfer[]> {
    const res = await this.http.get<unknown>("/scheduled-transfers");
    return unwrapArray<ScheduledTransfer>(res.data);
  }

  async createScheduledTransfer(
    data: CreateScheduledTransferPayload,
  ): Promise<ScheduledTransfer> {
    const res = await this.http.post<ScheduledTransfer>("/scheduled-transfers", data);
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
  // TAUX DE CHANGE
  // ============================================================

  // GET /exchange-rates (public) — taux publiés par la plateforme. Aucun taux de secours : en cas d'échec la liste est
  // vide et les écrans n'affichent aucune estimation (jamais un taux inventé sur une app d'argent).
  async getExchangeRates(): Promise<ExchangeRate[]> {
    try {
      const res = await this.http.get<unknown>("/exchange-rates");
      const list = unwrapArray<unknown>(res.data).map(normalizeExchangeRate);
      if (list.length > 0) return list;
      throw new Error("Réponse vide");
    } catch {
      devLog("⚠️ getExchangeRates: API indisponible → aucun taux affiché");
      return [];
    }
  }

  // GET /exchange-rates/:pair/history
  async getExchangeRateHistory(
    pair: string,
    params?: { from?: string; to?: string; limit?: number },
  ): Promise<ExchangeRateHistory[]> {
    try {
      const res = await this.http.get<unknown>(`/exchange-rates/${pair}/history`, { params });
      return unwrapArray<ExchangeRateHistory>(res.data);
    } catch {
      return [];
    }
  }

  // POST /exchange-rates/convert — conversion calculée par le serveur avec le taux en vigueur.
  // Aucun taux n'est écrit dans l'application : si le serveur ne répond pas, l'erreur est remontée à l'écran
  // (qui affiche « conversion indisponible ») au lieu d'afficher un montant inventé.
  async convertAmount(
    amount: number,
    from: Currency | string,
    to: Currency | string,
  ): Promise<{ amount: number; rate: number; convertedAmount: number }> {
    const res = await this.http.post<{
      amount: number;
      rate: number;
      convertedAmount: number;
    }>("/exchange-rates/convert", { amount, from, to });
    return res.data;
  }

  // ============================================================
  // ALERTES TAUX DE CHANGE — /rate-alerts
  // ============================================================

  async getRateAlerts(): Promise<RateAlert[]> {
    const res = await this.http.get<unknown>("/rate-alerts");
    return unwrapArray<RateAlert>(res.data);
  }

  async createRateAlert(data: CreateRateAlertPayload): Promise<RateAlert> {
    const res = await this.http.post<RateAlert>("/rate-alerts", data);
    return res.data;
  }

  async deleteRateAlert(id: string): Promise<void> {
    await this.http.delete(`/rate-alerts/${id}`);
  }

  // ============================================================
  // TRÉSORERIE ADMIN — ✅ v6.2 (reconstruit)
  // ============================================================

  // POST /transactions/admin/fund-self — auto-alimentation du wallet de l'admin société (peut être coupée côté serveur
  // par ALLOW_SELF_FUNDING=false : le refus 403 est alors remonté tel quel).
  async adminFundSelf(
    amount: number,
    currency: Currency | string = "XOF",
  ): Promise<unknown> {
    const res = await this.http.post("/transactions/admin/fund-self", {
      amount,
      currency: String(currency).toUpperCase(),
    });
    return res.data;
  }

  // POST /transactions/admin/refill-agency — recharge de la caisse d'une agence depuis le wallet de la société.
  // ✅ idempotent : même agence + même montant + même devise tant que l'issue est incertaine = même clé.
  async adminRefillAgency(
    agencyId: string,
    amount: number,
    currency: Currency | string = "XOF",
  ): Promise<unknown> {
    const body = { agencyId, amount, currency: String(currency).toUpperCase() };
    return runOnce(`refill:${JSON.stringify(body)}`, async (key) => {
      const res = await this.http.post("/transactions/admin/refill-agency", body, {
        headers: { "Idempotency-Key": key },
      });
      return res.data as unknown;
    });
  }

  // ============================================================
  // TRÉSORERIE AGENCE ⇄ SOCIÉTÉ — ✅ v5.8 (reconstruit)
  // ============================================================

  // POST /transactions/agency/remit — l'agent remet du cash à l'admin (débit caisse agence, crédit société).
  async agentRemitToAdmin(amount: number, note?: string): Promise<unknown> {
    const body = { amount, ...(note ? { note } : {}) };
    return runOnce(`remit:${JSON.stringify(body)}`, async (key) => {
      const res = await this.http.post("/transactions/agency/remit", body, {
        headers: { "Idempotency-Key": key },
      });
      return res.data as unknown;
    });
  }

  // POST /transactions/agency/collect — l'admin retire du cash d'une caisse d'agence (note obligatoire côté serveur).
  async adminCollectFromAgency(
    agencyId: string,
    amount: number,
    note: string,
  ): Promise<unknown> {
    const body = { agencyId, amount, note };
    return runOnce(`collect:${JSON.stringify(body)}`, async (key) => {
      const res = await this.http.post("/transactions/agency/collect", body, {
        headers: { "Idempotency-Key": key },
      });
      return res.data as unknown;
    });
  }

  // ============================================================
  // VIREMENTS B2B (société → plateforme) — ✅ v5.3 (reconstruit)
  // v5.3 : un seul appel (pas de tryMany : il provoquait un double appel), délai 15 s, devise par défaut XOF.
  // ============================================================

  async declareBankTransfer(
    amount: number,
    ref?: string,
    currency: Currency | string = "XOF",
  ): Promise<Transaction> {
    const res = await this.http.post<Transaction>(
      "/transactions/b2b/declare",
      { amount, ref, currency: String(currency).toUpperCase() },
      { timeout: 15_000 },
    );
    return normalizeTransaction(res.data);
  }

  async validateBankTransfer(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/b2b/validate/${id}`, {});
    return normalizeTransaction(res.data);
  }

  async rejectBankTransfer(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/b2b/reject/${id}`, {});
    return normalizeTransaction(res.data);
  }

  // ============================================================
  // TRANSACTIONS ADMIN — ✅ v6.2 (reconstruit)
  // ============================================================

  // GET /transactions/admin — toutes les opérations de la société (Super Admin : de la plateforme).
  async adminGetTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<unknown>("/transactions/admin");
    return unwrapArray<unknown>(res.data).map(normalizeTransaction);
  }

  // PATCH /transactions/admin/status/:id — VALIDATED / PAID / CANCELLED / FAILED (remboursement côté serveur).
  async adminUpdateTransactionStatus(
    id: string,
    status: TransactionStatus | string,
  ): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/admin/status/${id}`, { status });
    return normalizeTransaction(res.data);
  }

  // ============================================================
  // AGENCES — ✅ v6.2 (reconstruit)
  // ============================================================

  async getAgencies(): Promise<Agency[]> {
    const res = await this.http.get<unknown>("/agencies");
    return unwrapArray<Agency>(res.data);
  }

  async getAgency(id: string): Promise<Agency> {
    const res = await this.http.get<Agency>(`/agencies/${id}`);
    return res.data;
  }

  async createAgency(data: CreateAgencyPayload): Promise<Agency> {
    const res = await this.http.post<Agency>("/agencies", normalizeAgencyPayload(data));
    return res.data;
  }

  async updateAgency(
    id: string,
    data: Partial<CreateAgencyPayload> & Record<string, unknown>,
  ): Promise<Agency> {
    const res = await this.http.patch<Agency>(`/agencies/${id}`, data);
    return res.data;
  }

  async deleteAgency(id: string): Promise<unknown> {
    const res = await this.http.delete<unknown>(`/agencies/${id}`);
    return res.data;
  }

  // ============================================================
  // SOCIÉTÉS (clients SaaS) — ✅ v6.2 (reconstruit)
  // ============================================================

  async getClients(): Promise<Client[]> {
    const res = await this.http.get<unknown>("/clients");
    return unwrapArray<Client>(res.data);
  }

  async getClient(id: number): Promise<Client> {
    const res = await this.http.get<Client>(`/clients/${id}`);
    return res.data;
  }

  async createClient(data: Record<string, unknown>): Promise<Client> {
    const res = await this.http.post<Client>("/clients", data);
    return res.data;
  }

  async updateClient(id: number, data: Record<string, unknown>): Promise<Client> {
    const res = await this.http.patch<Client>(`/clients/${id}`, data);
    return res.data;
  }

  async updateClientStatus(id: number, status: ClientSubscriptionStatus): Promise<Client> {
    const res = await this.http.patch<Client>(`/clients/${id}/status`, { status });
    return res.data;
  }

  async deleteClient(id: number): Promise<unknown> {
    const res = await this.http.delete<unknown>(`/clients/${id}`);
    return res.data;
  }

  // ============================================================
  // UTILISATEURS — ✅ v6.2 (reconstruit)
  // ============================================================

  async getUsers(): Promise<AuthUser[]> {
    const res = await this.http.get<unknown>("/users");
    return unwrapArray<AuthUser>(res.data);
  }

  async createUser(data: Record<string, unknown>): Promise<AuthUser> {
    const res = await this.http.post<AuthUser>("/users", data);
    return res.data;
  }

  async suspendUser(id: string | number, reason?: string): Promise<unknown> {
    const res = await this.http.patch<unknown>(
      `/users/${id}/suspend`,
      reason ? { reason } : {},
    );
    return res.data;
  }

  async reactivateUser(id: string | number): Promise<unknown> {
    const res = await this.http.patch<unknown>(`/users/${id}/reactivate`, {});
    return res.data;
  }

  // ============================================================
  // RETRAITS — ✅ v6.2 (reconstruit)
  // GET /withdrawals : selon le rôle — admin : ceux de la société, agent : ceux qu'il a payés, client : les siens.
  // ============================================================

  async getWithdrawals(): Promise<Withdrawal[]> {
    const res = await this.http.get<unknown>("/withdrawals");
    return unwrapArray<Withdrawal>(res.data);
  }

  // ============================================================
  // COMMISSIONS — ✅ v6.2 (reconstruit)
  // GET/POST /commissions (admin société). POST : règle de partage (sourceType/destType/senderShare/payerShare) ou, avec
  // payoutMethod, frais par méthode de paiement (feeRate / fixedFee).
  // ============================================================

  // GET /fees-admin/mine — tarif de la société par mode d'envoi (+ « charged » : faux = mode gratuit selon ses paramètres).
  async getMyFees(): Promise<{
    company: { id: number; name: string; code: string };
    methods: { payoutMethod: string; label: string; charged: boolean; feeRate: number; fixedFee: number }[];
  }> {
    const res = await this.http.get("/fees-admin/mine");
    return res.data as any;
  }

  // PATCH /fees-admin/:method — COMPANY_ADMIN uniquement.
  async setFeeMethod(method: string, values: { feeRate: number; fixedFee: number }): Promise<unknown> {
    const res = await this.http.patch(`/fees-admin/${encodeURIComponent(method)}`, values);
    return res.data;
  }

  async getCommissionRules(): Promise<CommissionRule[]> {
    const res = await this.http.get<unknown>("/commissions");
    return unwrapArray<CommissionRule>(res.data);
  }

  async saveCommissionRule(data: Record<string, unknown>): Promise<unknown> {
    const res = await this.http.post<unknown>("/commissions", data);
    return res.data;
  }

  // ============================================================
  // TAUX DE CHANGE (admin) — ✅ v6.2 (reconstruit)
  // POST /rates { pair, rate } — Super Admin uniquement (route conservée pour l'app mobile ; l'historique et le garde-fou
  // de variation sont dans /rates-admin, utilisé par le back-office web).
  // ============================================================

  async updateExchangeRate(pair: string, rate: number): Promise<unknown> {
    const res = await this.http.post<unknown>("/rates", { pair, rate });
    return res.data;
  }

  // ============================================================
  // PROFIL ADMIN — ✅ v5.7 (reconstruit)
  // PATCH /clients/me/company-name — l'admin société corrige le nom de sa propre société.
  // ============================================================

  async updateMyCompanyName(name: string): Promise<unknown> {
    const res = await this.http.patch<unknown>("/clients/me/company-name", { name });
    return res.data;
  }
  // ============================================================
  // MARCHAND (lot 11) — compte marchand, encaissements par téléphone / QR code, retraits.
  // Le code secret (6 chiffres) est envoyé dans le corps de la requête, jamais dans l'URL, et n'est jamais stocké.
  // ============================================================

  async getMerchantMe(): Promise<MerchantMe> {
    return (await this.http.get<MerchantMe>("/merchants/me")).data;
  }

  async activateMerchant(input: MerchantProfileInput & { pin: string }): Promise<MerchantMe> {
    return (await this.http.post<MerchantMe>("/merchants/activate", input)).data;
  }

  async updateMerchantProfile(input: { businessName?: string; category?: string; address?: string; city?: string }): Promise<MerchantMe> {
    return (await this.http.patch<MerchantMe>("/merchants/me", input)).data;
  }

  async changeMerchantDestination(input: { pin: string; orangeMoneyPhone?: string; bankHolderName?: string; bankIban?: string; bankBic?: string }): Promise<MerchantMe> {
    return (await this.http.put<MerchantMe>("/merchants/me/destination", input)).data;
  }

  async getMerchantSummary(): Promise<MerchantSummary> {
    return (await this.http.get<MerchantSummary>("/merchants/me/summary")).data;
  }

  async requestMerchantPayout(input: { pin: string; amount: number; method: PayoutMethod; currency?: string }): Promise<PayoutView> {
    return (await this.http.post<PayoutView>("/merchants/payouts", input)).data;
  }

  async listMerchantPayouts(page = 1): Promise<Paged<PayoutView>> {
    return (await this.http.get<Paged<PayoutView>>(`/merchants/payouts?page=${page}`)).data;
  }

  // ── Encaissements (marchand) ──
  async createPhonePayment(input: { amount: number; payerPhone: string; currency?: string; note?: string }): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>("/merchant-payments/phone", input)).data;
  }

  async createQrPayment(input: { amount: number; currency?: string; note?: string }): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>("/merchant-payments/qr", input)).data;
  }

  async listMerchantPayments(params: { status?: string; page?: number } = {}): Promise<Paged<PaymentRequestView>> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.page) q.set("page", String(params.page));
    const qs = q.toString();
    return (await this.http.get<Paged<PaymentRequestView>>(`/merchant-payments${qs ? `?${qs}` : ""}`)).data;
  }

  async getPaymentRequest(id: string): Promise<PaymentRequestView> {
    return (await this.http.get<PaymentRequestView>(`/merchant-payments/${encodeURIComponent(id)}`)).data;
  }

  async cancelPaymentRequest(id: string): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>(`/merchant-payments/${encodeURIComponent(id)}/cancel`, {})).data;
  }

  // ── Paiement (client, ou marchand qui paie un autre marchand) ──
  async getIncomingPayments(): Promise<PaymentRequestView[]> {
    const res = await this.http.get<{ data?: PaymentRequestView[] }>("/merchant-payments/incoming");
    return Array.isArray(res.data?.data) ? res.data.data : [];
  }

  async previewQrPayment(payload: string): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>("/merchant-payments/qr/preview", { payload })).data;
  }

  async payQr(payload: string, pin: string): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>("/merchant-payments/qr/pay", { payload, pin })).data;
  }

  async payPaymentRequest(id: string, pin: string): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>(`/merchant-payments/${encodeURIComponent(id)}/pay`, { pin })).data;
  }

  async declinePaymentRequest(id: string): Promise<PaymentRequestView> {
    return (await this.http.post<PaymentRequestView>(`/merchant-payments/${encodeURIComponent(id)}/decline`, {})).data;
  }
}

export const api = new API();
