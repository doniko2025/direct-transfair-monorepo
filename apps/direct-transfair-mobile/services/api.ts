// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  Agency,
  AuthUser,
  Beneficiary,
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

// Clés AsyncStorage
const STORAGE_KEYS = {
  PREFERRED_TENANT: "PREFERRED_TENANT",
} as const;

// ============================================================
// HELPERS (strict, no exotic deps)
// ============================================================

function normalizeBaseUrl(input: string): string {
  const trimmed = (input ?? "").trim();

  // retire trailing slash
  let url = trimmed.replace(/\/+$/, "");

  // ✅ FIX DÉFINITIF: retire /api autant de fois que nécessaire (évite /api/api)
  // ex: https://x/api -> https://x
  // ex: https://x/api/api -> https://x
  url = url.replace(/(\/api)+$/i, "");

  return url;
}

function buildApiBaseUrl(rawBase: string): string {
  const base = normalizeBaseUrl(rawBase);
  return `${base}/api`;
}

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // ✅ PRIORITÉ ABSOLUE À L'ENV
  if (envUrl && envUrl.trim().length > 0) {
    return normalizeBaseUrl(envUrl);
  }

  // ✅ Fallback DEV uniquement
  if (__DEV__) {
    if (Platform.OS === "web") return "http://localhost:3000";
    if (Platform.OS === "android") return "http://10.0.2.2:3000";
    if (Platform.OS === "ios") return "http://localhost:3000";
  }

  // ✅ Sécurité PROD
  return normalizeBaseUrl(PROD_FALLBACK_BASE_URL);
}

function getInitialTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID;

  // 🛡️ protection : vide ou "10" => DONIKO
  if (!envTenant || envTenant.trim() === "" || envTenant.trim() === "10") {
    return "DONIKO";
  }

  return envTenant.trim();
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
    if (typeof msg === "string" && msg.trim()) {
      return status ? `${status} - ${msg}` : msg;
    }
    if (Array.isArray(msg) && typeof msg[0] === "string" && msg[0].trim()) {
      return status ? `${status} - ${msg[0]}` : msg[0];
    }
    const errTxt = data.error;
    if (typeof errTxt === "string" && errTxt.trim()) {
      return status ? `${status} - ${errTxt}` : errTxt;
    }
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

  // eslint-disable-next-line no-console
  console.error(`API tryMany failed (${label})`, lastErr);
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
    // ✅ baseURL robuste, impossible d'avoir /api/api même si env est mal formée
    const baseURL = buildApiBaseUrl(getBaseUrl());

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });

    // eslint-disable-next-line no-console
    console.log("🌐 API Init | baseURL:", baseURL, "| tenant:", this.tenant);

    // Charger tenant persisté (non bloquant)
    void this.loadPersistedTenant();

    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);

      const safeTenant =
        !this.tenant || this.tenant === "10" ? "DONIKO" : this.tenant;

      headers.set("x-tenant-id", safeTenant);

      if (this.token && this.token.trim().length > 0) {
        const cleanToken = this.token.replace(/^"|"$/g, "");
        headers.set("Authorization", `Bearer ${cleanToken}`);
      }

      config.headers = headers;
      return config;
    });
  }

  // -----------------------------
  // Tenant / Token
  // -----------------------------

  private async loadPersistedTenant(): Promise<void> {
    try {
      const savedTenant = await AsyncStorage.getItem(
        STORAGE_KEYS.PREFERRED_TENANT,
      );

      if (!savedTenant || savedTenant === "10") {
        this.tenant = "DONIKO";
        await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, "DONIKO");
        return;
      }

      this.tenant = savedTenant.trim();
    } catch {
      // eslint-disable-next-line no-console
      console.warn("AsyncStorage tenant read error");
    }
  }

  async setTenant(tenant: string): Promise<void> {
    const safeTenant =
      tenant === "10" || tenant.trim() === "" ? "DONIKO" : tenant;
    this.tenant = safeTenant;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_TENANT, safeTenant);
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

  // ==========================================================
  // AUTH
  // ==========================================================

  async register(data: RegisterPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/register", data);
    return res.data;
  }

  async login(data: LoginPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login", data);
    return res.data;
  }

  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");
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

  // ==========================================================
  // USERS (ADMIN)
  // ==========================================================

  async getUsers(): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [async () => this.http.get<unknown>("/users"), async () => this.http.get<unknown>("/admin/users")],
      "getUsers",
    );
    return unwrapArray<unknown>(data.data);
  }

  async createUser(payload: unknown): Promise<unknown> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [async () => this.http.post<unknown>("/users", payload), async () => this.http.post<unknown>("/admin/users", payload)],
      "createUser",
    );
    return data.data;
  }

  // ==========================================================
  // TREASURY (ADMIN)
  // ==========================================================

  async adminRefillAgency(agencyId: string, amount: number): Promise<unknown> {
    const payload = { amount };
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>(`/admin/agencies/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/agencies/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/admin/agency/${agencyId}/refill`, payload),
        async () => this.http.post<unknown>(`/admin/agencies/refill/${agencyId}`, payload),
      ],
      "adminRefillAgency",
    );
    return data.data;
  }

  async adminFundSelf(amount: number): Promise<unknown> {
    const payload = { amount };
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/admin/fund-self", payload),
        async () => this.http.post<unknown>("/admin/treasury/fund-self", payload),
        async () => this.http.post<unknown>("/wallet/fund", payload),
        async () => this.http.post<unknown>("/treasury/fund-self", payload),
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

  async updateAgency(
    id: string,
    data: Partial<CreateAgencyPayload>,
  ): Promise<unknown> {
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

  async createBeneficiary(
    data: CreateBeneficiaryPayload,
  ): Promise<Beneficiary> {
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
  // TRANSACTIONS (USER)
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
  }): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions/deposit", data);
    return normalizeTransaction(res.data);
  }

  // ==========================================================
  // WITHDRAWALS (AGENT)
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
        async () => this.http.get<unknown>("/transactions/admin/all-transactions"),
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
        async () => this.http.patch<Transaction>(`/transactions/${id}/status`, { status }),
        async () => this.http.patch<Transaction>(`/transactions/admin/status/${id}`, { status }),
        async () => this.http.patch<Transaction>(`/transactions/admin/${id}/status`, { status }),
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
        async () => this.http.patch<Transaction>(`/transactions/${id}/validate`),
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
        async () => this.http.patch<Transaction>(`/transactions/${id}/reject`),
      ],
      "rejectBankTransfer",
    );

    return normalizeTransaction(data.data);
  }

  // ==========================================================
  // B2B / FACTURES
  // ==========================================================

  async declareBankTransfer(
    amount: number,
    refBancaire?: string,
  ): Promise<unknown> {
    const reference = (refBancaire ?? "").trim();

    const payload = {
      amount,
      refBancaire: reference,
      reference,
      method: "BANK_TRANSFER",
      paymentMethod: "BANK_TRANSFER",
    };

    const res = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/transactions/b2b/declare", payload),
        async () => this.http.post<unknown>("/transactions/b2b/declare-bank-transfer", payload),
        async () => this.http.post<unknown>("/transactions/declare-bank-transfer", payload),
        async () => this.http.post<unknown>("/bank-transfers/declare", payload),
        async () => this.http.post<unknown>("/payments/bank-transfer/declare", payload),
      ],
      "declareBankTransfer",
    );

    return res.data;
  }

  // ==========================================================
  // EXCHANGE RATES (ADMIN)
  // ==========================================================

  async getExchangeRates(): Promise<ExchangeRate[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>("/rates"),
        async () => this.http.get<unknown>("/exchange-rates"),
        async () => this.http.get<unknown>("/fx/rates"),
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
        async () => {
          await this.http.post("/exchange-rates", { pair, rate });
        },
      ],
      "updateExchangeRate",
    );
  }

  // ==========================================================
  // COMMISSIONS (ADMIN)
  // ==========================================================

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

  async saveCommissionRule(payload: {
    sourceType: string;
    destType: string;
    senderShare: number;
    payerShare: number;
  }): Promise<unknown> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.post<unknown>("/commissions", payload),
        async () => this.http.post<unknown>("/commissions/rules", payload),
        async () => this.http.patch<unknown>("/commissions", payload),
      ],
      "saveCommissionRule",
    );

    return data.data;
  }

  async getCommissionHistory(period: string): Promise<unknown[]> {
    const data = await tryMany<AxiosResponse<unknown>>(
      [
        async () => this.http.get<unknown>(`/commissions/history?period=${encodeURIComponent(period)}`),
        async () => this.http.get<unknown>(`/commissions/logs?period=${encodeURIComponent(period)}`),
      ],
      "getCommissionHistory",
    );

    return unwrapArray<unknown>(data.data);
  }

  // ==========================================================
  // SAAS CLIENTS (SOCIÉTÉS)
  // ==========================================================

  async getClients(): Promise<unknown[]> {
    const res = await this.http.get<unknown>("/clients");
    return unwrapArray<unknown>(res.data);
  }

  async createClient(data: unknown): Promise<unknown> {
    // ✅ la création SaaS doit passer par le tenant "plateforme"
    const headers = { "x-tenant-id": "DONIKO" };

    try {
      const res = await tryMany<AxiosResponse<unknown>>(
        [
          async () => this.http.post<unknown>("/clients", data, { headers }),
          async () => this.http.post<unknown>("/admin/clients", data, { headers }),
          async () => this.http.post<unknown>("/super-admin/clients", data, { headers }),
          async () => this.http.post<unknown>("/saas/clients", data, { headers }),
        ],
        "createClient",
      );

      return res.data;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("createClient failed:", extractAxiosErrorMessage(e));
      throw e;
    }
  }

  async updateClient(id: number, data: unknown): Promise<unknown> {
    const res = await this.http.patch(`/clients/${id}`, data);
    return res.data;
  }

  async deleteClient(id: number): Promise<unknown> {
    const res = await this.http.delete(`/clients/${id}`);
    return res.data;
  }
}

export const api = new API();
