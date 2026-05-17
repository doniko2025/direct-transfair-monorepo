// apps/direct-transfair-mobile/services/api.ts
// =========================================================
// DIRECT TRANSF'AIR — API Service v4.0
// ✅ Phone Login + OTP à chaque connexion
// ✅ Multi-Currency (XOF, EUR, USD, GNF, GBP)
// ✅ Push notifications (FCM/APNS) — UserDevice
// ✅ Scheduled Transfers, Rate Alerts, Loyalty
// ✅ Treasury Snapshots, KYC, AML
// ✅ Refresh Token, Rate History, Webhooks
// =========================================================

import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
    "10", "LOCALHOST", "127.0.0.1", "192.168",
    "DFTRANSFER", "UNDEFINED", "NULL", "VERCEL",
    "DIRECT-TRANSFAIR-MONOREPO",
  ];
  if (!raw || blackList.some((bad) => raw.includes(bad))) return PLATFORM_TENANT;
  return raw;
}

function getInitialTenantId(): string {
  return normalizeTenant(process.env.EXPO_PUBLIC_TENANT_ID);
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
    receivedAmount: tx.receivedAmount !== undefined
      ? toNumberSafe(tx.receivedAmount)
      : (tx as unknown as Transaction).receivedAmount,
    exchangeRate: tx.exchangeRate !== undefined
      ? toNumberSafe(tx.exchangeRate)
      : (tx as unknown as Transaction).exchangeRate,
    senderCommission: tx.senderCommission !== undefined
      ? toNumberSafe(tx.senderCommission)
      : undefined,
    loyaltyPointsEarned: tx.loyaltyPointsEarned !== undefined
      ? toNumberSafe(tx.loyaltyPointsEarned)
      : 0,
  };
}

function normalizeWallet(w: unknown): Wallet {
  const ww = (isRecord(w) ? w : {}) as Record<string, unknown>;
  return {
    ...(ww as unknown as Wallet),
    balance: toNumberSafe(ww.balance),
    reservedBalance: ww.reservedBalance !== undefined
      ? toNumberSafe(ww.reservedBalance)
      : 0,
  };
}

function normalizeExchangeRate(r: unknown): ExchangeRate {
  const rr = (isRecord(r) ? r : {}) as Record<string, unknown>;
  return {
    ...(rr as unknown as ExchangeRate),
    pair: String(rr.pair ?? ""),
    rate: toNumberSafe(rr.rate),
    inverseRate: rr.inverseRate !== undefined ? toNumberSafe(rr.inverseRate) : undefined,
    changePercent: rr.changePercent !== undefined ? toNumberSafe(rr.changePercent) : undefined,
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

function isAxios404(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    typeof err.response?.status === "number" &&
    err.response.status === 404
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
    if (typeof errTxt === "string")
      return status ? `${status} - ${errTxt}` : errTxt;
  }
  const fallback = err.message || "Erreur réseau";
  return status ? `${status} - ${fallback}` : fallback;
}

async function tryMany<T>(
  fns: Array<() => Promise<T>>,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (const fn of fns) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isAxios404(e)) break;
    }
  }
  console.error(`API tryMany failed (${label})`, extractAxiosErrorMessage(lastErr));
  throw lastErr;
}

// ============================================================
// API CLASS
// ============================================================

class API {
  public http: AxiosInstance;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private tenant: string = getInitialTenantId();
  private isRefreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];

  constructor() {
    const baseURL = buildApiBaseURL();

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });

    console.log("🌐 API Init | URL:", baseURL, "| Tenant:", this.tenant);

    void this.loadPersistedState();

    // ─── REQUEST INTERCEPTOR ─────────────────────────────────
    this.http.interceptors.request.use(async (config) => {
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
          console.warn("AsyncStorage token read error", e);
        }
      }

      console.log("------------------------------------------");
      console.log("🚀", config.method?.toUpperCase(), config.url);
      console.log("🆔 TENANT:", this.tenant);
      console.log("🔑 TOKEN:", this.token
        ? `OUI (${this.token.substring(0, 10)}...)`
        : "NON");
      console.log("------------------------------------------");

      headers.set("x-tenant-id", this.tenant);

      if (this.token && this.token.trim().length > 0) {
        headers.set("Authorization", `Bearer ${this.token.replace(/^"|"$/g, "")}`);
      }

      config.headers = headers;
      return config;
    });

    // ─── RESPONSE INTERCEPTOR (auto-refresh token) ───────────
    this.http.interceptors.response.use(
      (res) => res,
      async (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const method = (err.config?.method ?? "GET").toUpperCase();
          const fullUrl = `${err.config?.baseURL ?? ""}${err.config?.url ?? ""}`;
          const status = err.response?.status;

          // Auto-refresh si 401 et refresh token disponible
          if (status === 401 && this.refreshToken && err.config && !err.config.url?.includes("/auth/refresh")) {
            if (!this.isRefreshing) {
              this.isRefreshing = true;
              try {
                const newToken = await this.attemptTokenRefresh();
                this.token = newToken;
                this.refreshQueue.forEach((cb) => cb(newToken));
                this.refreshQueue = [];
                this.isRefreshing = false;
                // Rejouer la requête originale
                const originalConfig = err.config;
                const headers = ensureAxiosHeaders(originalConfig.headers);
                headers.set("Authorization", `Bearer ${newToken}`);
                originalConfig.headers = headers;
                return this.http.request(originalConfig);
              } catch {
                this.isRefreshing = false;
                this.refreshQueue = [];
                this.clearTokens();
              }
            } else {
              // Mettre en file d'attente pendant le refresh
              return new Promise((resolve) => {
                this.refreshQueue.push((token) => {
                  if (err.config) {
                    const headers = ensureAxiosHeaders(err.config.headers);
                    headers.set("Authorization", `Bearer ${token}`);
                    err.config.headers = headers;
                    resolve(this.http.request(err.config));
                  }
                });
              });
            }
          }

          console.error(
            "❌ HTTP ERROR",
            method,
            fullUrl,
            "| status:",
            status,
            "| msg:",
            extractAxiosErrorMessage(err),
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
      const rt = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (rt) this.refreshToken = rt;
    } catch { /* noop */ }
  }

  private async loadPersistedTenant(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_TENANT);
      this.tenant = normalizeTenant(saved);
      if (this.tenant !== saved) {
        await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, this.tenant);
      }
    } catch {
      console.warn("AsyncStorage tenant read error");
    }
  }

  async setTenant(tenant: string): Promise<void> {
    this.tenant = normalizeTenant(tenant);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, this.tenant);
    } catch { /* noop */ }
  }

  getTenant(): string { return this.tenant; }

  setToken(token: string | null): void { this.token = token; }

  clearToken(): void { this.token = null; }

  private clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    void Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
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
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
    if (refresh_token) {
      this.refreshToken = refresh_token;
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
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

  /**
   * Étape 1 : vérifier l'identifiant + mot de passe → déclenche OTP
   * Accepte email ou numéro de téléphone dans le champ identifier
   */
  async loginStep1(data: LoginPayload): Promise<LoginStep1Response> {
    this.token = null;
    const res = await this.http.post<LoginStep1Response>("/auth/login", data);
    return res.data;
  }

  /**
   * Étape 2 : vérifier l'OTP → retourne le JWT
   */
  async loginStep2(data: VerifyLoginOtpPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login/verify-otp", data);

    if (res.data?.access_token) {
      this.token = res.data.access_token;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);

      if (res.data.refresh_token) {
        this.refreshToken = res.data.refresh_token;
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
      }

      if (res.data?.user?.client?.code) {
        console.log("🎯 Tenant détecté:", res.data.user.client.code);
        await this.setTenant(res.data.user.client.code);
      }
    }

    return res.data;
  }

  /**
   * Login direct (rétrocompatibilité — sans OTP step)
   * Utilisé si le backend n'a pas encore le flow en 2 étapes
   */
  async login(data: LoginPayload): Promise<LoginResponse> {
  this.token = null;
  // ✅ Remapper identifier → email pour le backend
  const payload = { email: data.identifier, password: data.password };
  const res = await this.http.post<LoginResponse>("/auth/login", payload);

  if (res.data?.access_token) {
    this.token = res.data.access_token;
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);

    if (res.data.refresh_token) {
      this.refreshToken = res.data.refresh_token;
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
    }

    if (res.data?.user?.client?.code) {
      await this.setTenant(res.data.user.client.code);
    }
  }

  return res.data;
}

async logout(): Promise<void> {
  try {
    await this.http.post("/auth/logout");
  } catch { /* noop */ } finally {
    this.clearTokens();
  }
}
  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");
    if (res.data?.client?.code) await this.setTenant(res.data.client.code);
    return res.data;
  }

  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const res = await this.http.patch<AuthUser>("/auth/me", data);
    return res.data;
  }

  async changePassword(data: ChangePasswordPayload): Promise<void> {
  const old = (data.oldPassword ?? data.currentPassword ?? "").trim();
  const nw  = (data.newPassword ?? data.password ?? "").trim();

  // ✅ Le backend attend exactement oldPass + newPass (auth.controller.ts)
  await this.http.patch("/auth/change-password", {
    oldPass: old,
    newPass: nw,
  });
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
    const res = await this.http.get<unknown>("/notifications", { params });
    return unwrapArray<Notification>(res.data);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.http.patch(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.http.patch("/notifications/read-all");
  }

  async getUnreadNotificationsCount(): Promise<number> {
    const res = await this.http.get<{ count: number }>("/notifications/unread-count");
    return toNumberSafe(res.data?.count);
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

  // ============================================================
  // WALLETS
  // ============================================================

  async getMyWallets(): Promise<Wallet[]> {
    const res = await this.http.get<unknown>("/wallets/me");
    return unwrapArray<Wallet>(res.data).map(normalizeWallet);
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

  /**
   * Snapshot de trésorerie pour les 5 devises (Super Admin + Company Admin)
   */
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
        async () => this.http.post<unknown>("/transactions/admin/refill-agency", payload),
        async () => this.http.post<unknown>(`/admin/agencies/${agencyId}/refill`, payload),
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
    // ✅ /treasury/admin/inject — body JSON avec Content-Type explicite
    const payload = { currency: String(currency).toUpperCase(), amount: Number(amount) };
    try {
      const res = await this.http.post("/treasury/admin/inject", payload, {
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch {
      const data = await tryMany<AxiosResponse<unknown>>(
        [
          async () => this.http.post<unknown>("/transactions/admin/fund-self", payload),
          async () => this.http.post<unknown>("/admin/fund-self", payload),
          async () => this.http.post<unknown>("/admin/treasury/fund-self", payload),
        ],
        "adminFundSelf",
      );
      return data.data;
    }
  }

  async declareBankTransfer(
    amount: number,
    refBancaire?: string,
    currency: Currency | string = "EUR",
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
    const res = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/transactions/b2b/declare", payload),
        async () => this.http.post<unknown>("/transactions/declare-bank-transfer", payload),
      ],
      "declareBankTransfer",
    );
    return res.data;
  }

  // ============================================================
  // AGENCIES
  // ============================================================

  /**
   * Récupère les agences.
   * - SuperAdmin (tenant DONIKO) : platformHeaders() → toutes les agences
   * - CompanyAdmin : headers normaux → agences de son client uniquement
   * Le backend filtre selon x-tenant-id.
   */
  async getAgencies(params?: {
  page?: number;
  limit?: number;
  country?: string;
  currency?: string;
}): Promise<Agency[]> {

  const headers = {
    "x-tenant-id": this.tenant,
  };

  const res = await tryMany<AxiosResponse<unknown>>(
    [
      () => this.http.get<unknown>("/agencies", { params, headers }),
      () => this.http.get<unknown>("/admin/agencies", { params, headers }),
    ],
    "getAgencies",
  );

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
    const res = await this.http.patch<Beneficiary>(`/beneficiaries/${id}/favorite`);
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
          const res = await this.http.patch<Transaction>(`/transactions/${id}/cancel`);
          return normalizeTransaction(res.data);
        },
        async () => {
          const res = await this.http.post<Transaction>(`/transactions/${id}/cancel`);
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
        async () => this.http.post<ScheduledTransfer>("/scheduled-transfers", data),
        async () => this.http.post<ScheduledTransfer>("/transactions/scheduled", data),
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
    const res = await this.http.get<unknown>("/withdrawals", { params });
    return unwrapArray<Withdrawal>(res.data);
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
          this.http.patch<Transaction>(`/transactions/admin/status/${id}`, { status }),
      ],
      "adminUpdateTransactionStatus",
    );
    return normalizeTransaction(data.data);
  }

  async validateBankTransfer(id: string): Promise<Transaction> {
    const data = await tryMany<AxiosResponse<Transaction>>(
      [
        async () => this.http.patch<Transaction>(`/transactions/b2b/validate/${id}`),
        async () => this.http.post<Transaction>(`/transactions/${id}/validate`),
      ],
      "validateBankTransfer",
    );
    return normalizeTransaction(data.data);
  }

  async rejectBankTransfer(id: string): Promise<Transaction> {
    const data = await tryMany<AxiosResponse<Transaction>>(
      [
        async () => this.http.patch<Transaction>(`/transactions/b2b/reject/${id}`),
        async () => this.http.post<Transaction>(`/transactions/${id}/reject`),
      ],
      "rejectBankTransfer",
    );
    return normalizeTransaction(data.data);
  }

  // ============================================================
  // TAUX DE CHANGE
  // ============================================================

  async getExchangeRates(): Promise<ExchangeRate[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/rates"),
        async () => this.http.get<unknown>("/exchange-rates"),
      ],
      "getExchangeRates",
    );
    return unwrapArray<unknown>(data.data).map(normalizeExchangeRate);
  }

  async getExchangeRateHistory(
    pair: string,
    params?: { from?: string; to?: string; limit?: number },
  ): Promise<ExchangeRateHistory[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>(`/rates/${pair}/history`, { params }),
        async () => this.http.get<unknown>(`/exchange-rates/${pair}/history`, { params }),
      ],
      "getExchangeRateHistory",
    );
    return unwrapArray<ExchangeRateHistory>(data.data);
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
    const res = await this.http.post<{
      amount: number;
      rate: number;
      convertedAmount: number;
    }>("/rates/convert", { amount, from, to });
    return res.data;
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
      // Fallback statique pour les 5 devises supportées
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

  async reviewAmlFlag(
    id: string,
    resolution: string,
  ): Promise<AmlFlag> {
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

  async validatePromoCode(code: string, amount?: number, currency?: string): Promise<Promotion | null> {
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
        () => this.http.patch<Client>(`/clients/${id}/status`, payloadA, { headers }),
        () => this.http.patch<Client>(`/admin/clients/${id}/status`, payloadA, { headers }),
        () => this.http.patch<Client>(`/saas/clients/${id}/status`, payloadA, { headers }),
        () => this.http.patch<Client>(`/clients/${id}`, payloadB, { headers }),
        () => this.http.patch<Client>(`/admin/clients/${id}`, payloadB, { headers }),
        () => this.http.patch<Client>(`/saas/clients/${id}`, payloadB, { headers }),
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
    const res = await this.http.get<unknown>(`/webhooks/${endpointId}/deliveries`, {
      params,
    });
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