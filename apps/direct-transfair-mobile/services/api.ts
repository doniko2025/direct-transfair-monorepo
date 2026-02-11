// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage'; // ✅ Import ajouté

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

// ⚠️ Mets ici TON IP LAN uniquement pour tests sur téléphone (si tu n'as pas d'env)
// Exemple : "192.168.1.15"
const LOCAL_IP_FALLBACK = "10.205.10.61";

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();

  // ✅ WEB: backend sur la même machine
  if (Platform.OS === "web") return "http://localhost:3000";

  // ✅ Android Emulator
  if (Platform.OS === "android") {
     // Si tu es sur un VRAI téléphone, utilise l'IP Fallback
     return `http://${LOCAL_IP_FALLBACK}:3000`;
  }

  // ✅ iOS simulator (souvent localhost OK)
  if (Platform.OS === "ios") return "http://localhost:3000";

  // ✅ Fallback device (rare)
  return `http://${LOCAL_IP_FALLBACK}:3000`;
}

function getTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  if (envTenant && envTenant.trim().length > 0) return envTenant.trim();
  return "DONIKO";
}

function ensureAxiosHeaders(
  headers: InternalAxiosRequestConfig["headers"],
): AxiosHeaders {
  if (!headers) return new AxiosHeaders();
  if (headers instanceof AxiosHeaders) return headers;
  return new AxiosHeaders(headers as Record<string, string>);
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function toNumberSafe(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    const asAny = value as { toString?: () => string };
    if (asAny && typeof asAny.toString === "function") {
      const n = Number(asAny.toString());
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    // noop
  }
  return 0;
}

function normalizeTransaction(t: unknown): Transaction {
  const tx = t as any;
  return {
    ...tx,
    amount: toNumberSafe(tx?.amount),
    fees: toNumberSafe(tx?.fees),
    total: toNumberSafe(tx?.total),
    receivedAmount:
      tx?.receivedAmount !== undefined
        ? toNumberSafe(tx?.receivedAmount)
        : tx?.receivedAmount,
    exchangeRate:
      tx?.exchangeRate !== undefined
        ? toNumberSafe(tx?.exchangeRate)
        : tx?.exchangeRate,
  } as Transaction;
}

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
  private tenant: string = getTenantId();

  constructor() {
    const baseURL = getBaseUrl();

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    // eslint-disable-next-line no-console
    console.log("🌐 API baseURL =", baseURL, "| tenant =", this.tenant);
    
    // ✅ Initialisation du tenant depuis le stockage (pour les liens profonds)
    this.loadPersistedTenant();

    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);

      // Tenant toujours envoyé (même si /auth/login est public, ça ne gêne pas)
      headers.set("x-tenant-id", this.tenant);

      if (this.token && this.token.trim().length > 0) {
        const cleanToken = this.token.replace(/^"|"$/g, "");
        headers.set("Authorization", `Bearer ${cleanToken}`);
      }

      config.headers = headers;
      return config;
    });
  }

  // ✅ Charge le tenant sauvegardé par le Deep Linking
  private async loadPersistedTenant() {
    try {
      const savedTenant = await AsyncStorage.getItem('PREFERRED_TENANT');
      if (savedTenant) {
        console.log('🔄 Restauration du contexte société :', savedTenant);
        this.tenant = savedTenant;
      }
    } catch (e) {
      console.warn('Impossible de lire le tenant sauvegardé');
    }
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

  getTenant(): string {
    return this.tenant;
  }

  // --- AUTH ---
  // ✅ On retourne LoginResponse si le backend renvoie déjà {access_token, user}
  async register(data: RegisterPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/register", data);
    return res.data;
  }

  async login(data: LoginPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login", data);
    return res.data;
  }

  async findAccount(
    identifier: string,
  ): Promise<{ userId: string; channels: string[] }> {
    const res = await this.http.post("/auth/find-account", { identifier });
    return res.data;
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
    data: Partial<CreateAgencyPayload>,
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
  async declareBankTransfer(amount: number, ref: string): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions/b2b/declare", {
      amount,
      ref,
    });
    return normalizeTransaction(res.data);
  }

  async validateBankTransfer(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(
      `/transactions/b2b/validate/${id}`,
    );
    return normalizeTransaction(res.data);
  }

  async rejectBankTransfer(id: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(
      `/transactions/b2b/reject/${id}`,
    );
    return normalizeTransaction(res.data);
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
    const res = await this.http.patch<Transaction>(
      `/transactions/admin/status/${id}`,
    );
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