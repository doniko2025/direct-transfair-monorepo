// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

// ⚠️ Adaptez l'IP si besoin
const LOCAL_IP = "localhost";

import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  Beneficiary,
  CreateBeneficiaryPayload,
  Transaction,
  CreateTransactionPayload,
  AuthUser,
  Agency,
  CreateAgencyPayload,
} from "./types";

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return `http://${LOCAL_IP}:3000`;
}

function ensureAxiosHeaders(
  headers: InternalAxiosRequestConfig["headers"]
): AxiosHeaders {
  // ✅ Robustesse : headers peut être undefined selon Axios + plateformes
  if (!headers) return new AxiosHeaders();
  if (headers instanceof AxiosHeaders) return headers;
  return new AxiosHeaders(headers as Record<string, string>);
}

// ✅ Robustesse : certains endpoints peuvent renvoyer soit un tableau,
// soit un wrapper { data: [...] } (selon intercepteurs/middlewares)
function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as any).data)
  ) {
    return (payload as any).data as T[];
  }
  return [];
}

function toNumberSafe(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma Decimal peut arriver déjà "stringifié" via toJSON, sinon fallback :
  try {
    const asAny = value as any;
    if (asAny && typeof asAny === "object" && typeof asAny.toString === "function") {
      const n = Number(asAny.toString());
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    // noop
  }
  return 0;
}

// ✅ Normalisation non destructive : conserve tous les champs,
// mais garantit amount/fees/total en number (utile UI)
function normalizeTransaction(t: any): Transaction {
  return {
    ...t,
    amount: toNumberSafe(t?.amount),
    fees: toNumberSafe(t?.fees),
    total: toNumberSafe(t?.total),
  } as Transaction;
}

// ✅ Compat AgencyType : ancien "PRIVATE" côté app → nouveau "SUBSIDIARY" côté Prisma
function normalizeAgencyPayload(data: CreateAgencyPayload): CreateAgencyPayload {
  const type = (data as any)?.type;
  if (type === "PRIVATE") {
    return { ...data, type: "SUBSIDIARY" as any };
  }
  return data;
}

class API {
  public http: AxiosInstance;
  private token: string | null = null;
  private tenant = "DONIKO";

  constructor() {
    this.http = axios.create({
      baseURL: getBaseUrl(),
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);

      if (this.token && this.token.trim().length > 0) {
        const cleanToken = this.token.replace(/^"|"$/g, "");
        headers.set("Authorization", `Bearer ${cleanToken}`);
      }

      headers.set("x-tenant-id", this.tenant);
      config.headers = headers;
      return config;
    });
  }

  setToken(token: string | null) {
    this.token = token;
  }
  clearToken() {
    this.token = null;
  }
  setTenant(tenant: string) {
    this.tenant = tenant;
  }

  // --- AUTH ---
  async register(data: RegisterPayload): Promise<void> {
    await this.http.post("/auth/register", data);
  }
  async login(data: LoginPayload, tenantCode?: string): Promise<LoginResponse> {
    if (tenantCode) this.setTenant(tenantCode);
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

  // --- AGENCES ---
  async getAgencies(): Promise<Agency[]> {
    const res = await this.http.get<Agency[]>("/agencies");
    return Array.isArray(res.data) ? res.data : unwrapArray<Agency>(res.data);
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
    data: Partial<CreateAgencyPayload>
  ): Promise<unknown> {
    const safe =
      data && (data as any).type
        ? normalizeAgencyPayload(data as CreateAgencyPayload)
        : data;
    const res = await this.http.patch(`/agencies/${id}`, safe);
    return res.data;
  }
  async deleteAgency(id: string): Promise<void> {
    await this.http.delete(`/agencies/${id}`);
  }

  // --- 👑 SUPER ADMIN (TRESORERIE) ---
  async adminFundSelf(amount: number): Promise<any> {
    const res = await this.http.post("/transactions/admin/fund-self", { amount });
    return res.data;
  }
  async adminRefillAgency(agencyId: string, amount: number): Promise<any> {
    const res = await this.http.post("/transactions/admin/refill-agency", {
      agencyId,
      amount,
    });
    return res.data;
  }

  // --- 🏦 B2B PAIEMENTS ---
  async declareBankTransfer(amount: number, ref: string): Promise<any> {
    const res = await this.http.post("/transactions/b2b/declare", { amount, ref });
    return res.data;
  }
  async validateBankTransfer(id: string): Promise<any> {
    const res = await this.http.patch(`/transactions/b2b/validate/${id}`);
    return res.data;
  }

  // --- 💰 COMMISSIONS ---
  async getCommissionRules(): Promise<any[]> {
    const res = await this.http.get("/commissions");
    return unwrapArray<any>(res.data);
  }
  async saveCommissionRule(data: any): Promise<any> {
    const res = await this.http.post("/commissions", data);
    return res.data;
  }

  // ✅ NOUVELLE MÉTHODE AJOUTÉE : Historique filtré par période
  async getCommissionHistory(period: string): Promise<any[]> {
    const res = await this.http.get(`/commissions/history?period=${period}`);
    return unwrapArray<any>(res.data);
  }

  // --- TRANSACTIONS ---
  async createTransaction(data: CreateTransactionPayload): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions", data);
    return normalizeTransaction(res.data);
  }

  async depositAgent(data: { amount: number; userPhone: string }): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions/deposit", data);
    return normalizeTransaction(res.data);
  }

  async getTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<any>("/transactions");
    const list = unwrapArray<any>(res.data);
    return list.map(normalizeTransaction);
  }

  async cancelTransaction(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/${id}/cancel`);
    return normalizeTransaction(res.data);
  }

  async adminGetTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<any>("/transactions/admin/all");
    const list = unwrapArray<any>(res.data);
    return list.map(normalizeTransaction);
  }

  async adminUpdateTransactionStatus(id: string, status: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(`/transactions/admin/status/${id}`, {
      status,
    });
    return normalizeTransaction(res.data);
  }

  // --- BÉNÉFICIAIRES ---
  async getBeneficiaries(): Promise<Beneficiary[]> {
    const res = await this.http.get<Beneficiary[]>("/beneficiaries");
    return Array.isArray(res.data) ? res.data : unwrapArray<Beneficiary>(res.data);
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
    data: Partial<CreateBeneficiaryPayload>
  ): Promise<Beneficiary> {
    const res = await this.http.patch<Beneficiary>(`/beneficiaries/${id}`, data);
    return res.data;
  }
  async deleteBeneficiary(id: string): Promise<{ deleted: true; id: string }> {
    const res = await this.http.delete<{ deleted: true; id: string }>(
      `/beneficiaries/${id}`
    );
    return res.data;
  }

  async getExchangeRates(): Promise<{ pair: string; rate: number }[]> {
    const res = await this.http.get("/rates");
    return Array.isArray(res.data) ? res.data : unwrapArray(res.data);
  }
  async updateExchangeRate(pair: string, rate: number): Promise<void> {
    await this.http.post("/rates", { pair, rate });
  }

  // --- GESTION UTILISATEURS ---
  async getUsers() {
    const res = await this.http.get("/users");
    return res.data;
  }
  async createUser(data: any) {
    const res = await this.http.post("/users", data);
    return res.data;
  }

  // --- RETRAITS ---
  async requestWithdrawal(data: { amount?: number; transactionId?: string }): Promise<unknown> {
    const res = await this.http.post("/withdrawals", data);
    return res.data;
  }
  async findTransactionByReference(code: string): Promise<Transaction> {
    const res = await this.http.post("/withdrawals/agent/check", { code });
    return normalizeTransaction(res.data);
  }
  async processCashWithdrawal(transactionId: string): Promise<any> {
    const res = await this.http.post("/withdrawals/agent/pay", { transactionId });
    return res.data;
  }
  async checkWithdrawalCode(code: string): Promise<any> {
    const res = await this.http.post("/withdrawals/agent/check", { code });
    return res.data;
  }
  async processWithdrawalPayment(code: string): Promise<any> {
    const res = await this.http.post("/withdrawals/agent/pay", { code });
    return res.data;
  }

  // --- SAAS CLIENTS ---
  async getClients() {
    const response = await this.http.get("/clients");
    return response.data;
  }
  async createClient(data: any) {
    const response = await this.http.post("/clients", data);
    return response.data;
  }
  async updateClient(id: number, data: any) {
    const response = await this.http.patch(`/clients/${id}`, data);
    return response.data;
  }
  async deleteClient(id: number) {
    const response = await this.http.delete(`/clients/${id}`);
    return response.data;
  }
}

export const api = new API();
