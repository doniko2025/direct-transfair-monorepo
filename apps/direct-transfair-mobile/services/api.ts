// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  Agency,
  AuthUser,
  Beneficiary,
  Client,
  ClientSubscriptionStatus,
  CreateAgencyPayload,
  CreateBeneficiaryPayload,
  CreateTransactionPayload,
  ExchangeRate,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  Transaction,
  TransactionStatus,
} from "./types";

// ============================================================
// PROD-SAFE CONFIG
// ============================================================

const PROD_FALLBACK_BASE_URL =
  "https://direct-transfair-monorepo-production.up.railway.app";

const PLATFORM_TENANT = "DONIKO";

const DEFAULT_API_PREFIX = "/api";

const STORAGE_KEYS = {
  PREFERRED_TENANT: "PREFERRED_TENANT",
} as const;

// ============================================================
// HELPERS
// ============================================================

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  const noTrailingSlash = trimmed.replace(/\/+$/, "");
  return noTrailingSlash.replace(/\/api$/, "");
}

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return normalizeBaseUrl(envUrl);
  }
  return PROD_FALLBACK_BASE_URL;
}

function normalizeTenant(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toUpperCase();
  const blackList = [
    "10",
    "LOCALHOST",
    "127.0.0.1",
    "192.168",
    "DFTRANSFER",
    "UNDEFINED",
    "NULL",
    "VERCEL",
    "DIRECT-TRANSFAIR-MONOREPO",
  ];

  if (!raw || blackList.some((bad) => raw.includes(bad))) {
    return "DONIKO";
  }
  return raw;
}

function getInitialTenantId(): string {
  return normalizeTenant(process.env.EXPO_PUBLIC_TENANT_ID);
}

function getApiPrefix(): string {
  const envPrefix = (process.env.EXPO_PUBLIC_API_PREFIX ?? "").trim();
  if (envPrefix.length === 0) return DEFAULT_API_PREFIX;
  return envPrefix;
}

function buildApiBaseURL(): string {
  const base = getBaseUrl();
  const prefix = getApiPrefix();
  if (!prefix) return base;
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return `${base}${normalizedPrefix}`;
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
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data as T[];
  }
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
  };
}

function normalizeExchangeRate(r: unknown): ExchangeRate {
  const rr = (isRecord(r) ? r : {}) as Record<string, unknown>;
  return {
    pair: String(rr.pair ?? ""),
    rate: toNumberSafe(rr.rate),
    updatedAt: rr.updatedAt ? String(rr.updatedAt) : undefined,
  };
}

function normalizeAgencyPayload(data: CreateAgencyPayload): CreateAgencyPayload {
  const type = (data as unknown as { type?: string }).type;
  if (type === "PRIVATE") {
    return { ...data, type: "SUBSIDIARY" as CreateAgencyPayload["type"] };
  }
  return data;
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
  private tenant: string = getInitialTenantId();

  constructor() {
    const baseURL = buildApiBaseURL();

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });

    console.log("🌐 API Init | URL:", baseURL, "| Tenant:", this.tenant);

    void this.loadPersistedTenant();

    // ─── REQUEST INTERCEPTOR (bloc mis à jour) ───────────────
    this.http.interceptors.request.use(async (config) => {
      const headers = ensureAxiosHeaders(config.headers);

      if (!this.tenant || this.tenant === PLATFORM_TENANT) {
        await this.loadPersistedTenant();
      }

      if (!this.token) {
        try {
          const savedToken =
            (await AsyncStorage.getItem("accessToken")) ??
            (await AsyncStorage.getItem("token"));
          if (savedToken) {
            this.token = savedToken;
          }
        } catch (e) {
          console.warn("Erreur de lecture du token dans AsyncStorage", e);
        }
      }

      // 🔍 LOG DE DIAGNOSTIC CHIRURGICAL
      console.log("------------------------------------------");
      console.log("🚀 ENVOI REQUÊTE :", config.method?.toUpperCase(), config.url);
      console.log("🆔 TENANT ACTUEL :", this.tenant);
      console.log(
        "🔑 TOKEN PRÉSENT :",
        this.token
          ? "OUI (Commence par: " + this.token.substring(0, 10) + "...)"
          : "NON",
      );
      console.log("------------------------------------------");

      headers.set("x-tenant-id", this.tenant);

      if (this.token && this.token.trim().length > 0) {
        const cleanToken = this.token.replace(/^"|"$/g, "");
        headers.set("Authorization", `Bearer ${cleanToken}`);
      }

      config.headers = headers;
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const method = (err.config?.method ?? "GET").toUpperCase();
          const fullUrl = `${err.config?.baseURL ?? ""}${err.config?.url ?? ""}`;
          const status = err.response?.status;
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

  // -----------------------------
  // Tenant / Token
  // -----------------------------

  private async loadPersistedTenant(): Promise<void> {
    try {
      const savedTenant = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_TENANT);
      this.tenant = normalizeTenant(savedTenant);
      if (this.tenant !== savedTenant) {
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
    } catch {
      // noop
    }
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

  private platformHeaders(): Record<string, string> {
    return { "x-tenant-id": PLATFORM_TENANT };
  }

  // ==========================================================
  // AUTH
  // ==========================================================

  async register(data: RegisterPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/register", data);
    return res.data;
  }

  // ─── LOGIN (bloc mis à jour) ──────────────────────────────
  async login(data: LoginPayload): Promise<LoginResponse> {
    // 🛡️ Force la suppression d'un éventuel vieux token corrompu avant de tenter le login
    this.token = null;
    
    // 🚀 Tentative de connexion
    const res = await this.http.post<LoginResponse>("/auth/login", data);

    if (res.data?.access_token) {
      this.token = res.data.access_token;
      // ✅ On mémorise immédiatement le nouveau token
      await AsyncStorage.setItem("accessToken", res.data.access_token);

      // ✅ SYNC TENANT : Si le user renvoyé a un code client, on l'utilise DIRECTEMENT
      if (res.data?.user?.client?.code) {
        console.log("🎯 Nouveau Tenant détecté :", res.data.user.client.code);
        await this.setTenant(res.data.user.client.code);
      }
    }

    return res.data;
  }

  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");

    // ✅ On s'assure que le tenant est toujours à jour au redémarrage
    if (res.data?.client?.code) {
      await this.setTenant(res.data.client.code);
    }

    return res.data;
  }

  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const res = await this.http.patch<AuthUser>("/auth/me", data);
    return res.data;
  }

  async findAccount(
    identifier: string,
  ): Promise<{ userId: string; channels: Array<"EMAIL" | "PHONE"> }> {
    const res = await this.http.post("/auth/find-account", { identifier });
    return res.data as { userId: string; channels: Array<"EMAIL" | "PHONE"> };
  }

  async sendOtp(userId: string, channel: "EMAIL" | "PHONE"): Promise<void> {
    await this.http.post("/auth/send-otp", { userId, channel });
  }

  async verifyOtp(userId: string, code: string, type: string = "PASSWORD_RESET"): Promise<void> {
    await this.http.post("/auth/verify-otp", { userId, code, type });
  }

  async resetPassword(userId: string, code: string, newPassword: string): Promise<void> {
    await this.http.post("/auth/reset-password", { userId, code, newPassword });
  }

  // ✅ NOUVELLE FONCTION : Changement de mot de passe depuis le profil
  async changePassword(oldPass: string, newPass: string): Promise<void> {
    await this.http.patch("/auth/change-password", { oldPass, newPass });
  }

  // ==========================================================
  // USERS (ADMIN)
  // ==========================================================

  async getUsers(): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/users"),
        async () => this.http.get<unknown>("/admin/users"),
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

  // ==========================================================
  // TREASURY (ADMIN)
  // ==========================================================

  async adminRefillAgency(agencyId: string, amount: number): Promise<unknown> {
    const payload = { agencyId, amount };
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/transactions/admin/refill-agency", payload),
        async () => this.http.post<unknown>(`/admin/agencies/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/agencies/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/admin/agency/${agencyId}/refill`, payload),
      ],
      "adminRefillAgency",
    );
    return data.data;
  }

  async adminFundSelf(amount: number): Promise<unknown> {
    const payload = { amount };
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/transactions/admin/fund-self", payload),
        async () => this.http.post<unknown>("/admin/fund-self", payload),
        async () => this.http.post<unknown>("/admin/treasury/fund-self", payload),
        async () => this.http.post<unknown>("/wallet/fund", payload),
      ],
      "adminFundSelf",
    );
    return data.data;
  }

  // ==========================================================
  // AGENCIES
  // ==========================================================

  async getAgencies(): Promise<Agency[]> {
    const res = await this.http.get<unknown>("/agencies");
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

  async updateAgency(id: string, data: Partial<CreateAgencyPayload>): Promise<unknown> {
    const safe =
      (data as unknown as { type?: string })?.type !== undefined
        ? normalizeAgencyPayload(data as CreateAgencyPayload)
        : data;
    const res = await this.http.patch(`/agencies/${id}`, safe);
    return res.data;
  }

  async deleteAgency(id: string): Promise<void> {
    await this.http.delete(`/agencies/${id}`);
  }

  // ==========================================================
  // BENEFICIARIES
  // ==========================================================

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

  // ==========================================================
  // TRANSACTIONS
  // ==========================================================

  async createTransaction(data: CreateTransactionPayload): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions", data);
    return normalizeTransaction(res.data);
  }

  async getTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<unknown>("/transactions");
    const list = unwrapArray<unknown>(res.data);
    return list.map(normalizeTransaction);
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

  async depositAgent(data: { amount: number; userPhone: string }): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions/deposit", data);
    return normalizeTransaction(res.data);
  }

  // ==========================================================
  // WITHDRAWALS
  // ==========================================================

  async requestWithdrawal(data: {
    amount?: number;
    transactionId?: string;
  }): Promise<unknown> {
    const res = await this.http.post("/withdrawals", data);
    return res.data;
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

  // ==========================================================
  // ADMIN TRANSACTIONS
  // ==========================================================

  async adminGetTransactions(): Promise<Transaction[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/transactions/admin"),
        async () => this.http.get<unknown>("/transactions/admin/all"),
      ],
      "adminGetTransactions",
    );
    const list = unwrapArray<unknown>(data.data);
    return list.map(normalizeTransaction);
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

  async declareBankTransfer(amount: number, refBancaire?: string): Promise<unknown> {
    const reference = (refBancaire ?? "").trim();
    const payload = {
      amount,
      ref: reference,
      refBancaire: reference,
      reference,
      method: "BANK_TRANSFER",
      paymentMethod: "BANK_TRANSFER",
    };
    const res = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/transactions/b2b/declare", payload),
        async () =>
          this.http.post<unknown>("/transactions/declare-bank-transfer", payload),
      ],
      "declareBankTransfer",
    );
    return res.data;
  }

  // ==========================================================
  // EXCHANGE RATES & COMMISSIONS
  // ==========================================================

  async getExchangeRates(): Promise<ExchangeRate[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/rates"),
        async () => this.http.get<unknown>("/exchange-rates"),
      ],
      "getExchangeRates",
    );
    const list = unwrapArray<unknown>(data.data);
    return list.map(normalizeExchangeRate);
  }

  async updateExchangeRate(pair: string, rate: number): Promise<void> {
    await tryMany<void>(
      [
        async () => {
          await this.http.post("/rates", { pair, rate });
        },
        async () => {
          await this.http.patch(`/rates/${pair}`, { rate });
        },
      ],
      "updateExchangeRate",
    );
  }

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

  async saveCommissionRule(payload: unknown): Promise<unknown> {
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

  // ==========================================================
  // SAAS CLIENTS (Sociétés)
  // ==========================================================

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
        () =>
          this.http.patch<Client>(`/admin/clients/${id}/status`, payloadA, { headers }),
        () =>
          this.http.patch<Client>(`/saas/clients/${id}/status`, payloadA, { headers }),
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
}

export const api = new API();