// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  Beneficiary,
  CreateBeneficiaryPayload,
  Transaction,
  CreateTransactionPayload,
  InitiatePaymentPayload,
  CreateWithdrawalPayload,
  UpdateWithdrawalStatusPayload,
  AuthUser,
} from "./types";

function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();

  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

function ensureAxiosHeaders(
  headers: InternalAxiosRequestConfig["headers"]
): AxiosHeaders {
  if (headers instanceof AxiosHeaders) return headers;
  return new AxiosHeaders(headers as Record<string, string>);
}

class API {
  private http: AxiosInstance;
  private token: string | null = null;
  private tenant = "DONIKO";

  constructor() {
    this.http = axios.create({
      baseURL: getBaseUrl(),
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);

      if (this.token) {
        headers.set("Authorization", `Bearer ${this.token}`);
      }

      headers.set("x-tenant-id", this.tenant);
      config.headers = headers;
      return config;
    });
  }

  // ========================
  // TOKEN / TENANT
  // ========================
  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  setTenant(tenant: string) {
    this.tenant = tenant;
  }

  // ========================
  // AUTH
  // ========================
  async register(data: RegisterPayload): Promise<void> {
    await this.http.post("/auth/register", data);
  }

  async login(data: LoginPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login", data);
    return res.data;
  }

  // ✅ AJOUT CRUCIAL
  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");
    return res.data;
  }

  // ========================
  // BENEFICIARIES
  // ========================
  async getBeneficiaries(): Promise<Beneficiary[]> {
    const res = await this.http.get<Beneficiary[]>("/beneficiaries");
    return Array.isArray(res.data) ? res.data : [];
  }

  async createBeneficiary(
    data: CreateBeneficiaryPayload
  ): Promise<Beneficiary> {
    const res = await this.http.post<Beneficiary>("/beneficiaries", data);
    return res.data;
  }

  async getBeneficiary(id: string): Promise<Beneficiary> {
    const res = await this.http.get<Beneficiary>(`/beneficiaries/${id}`);
    return res.data;
  }

  async updateBeneficiary(
    id: string,
    data: Partial<CreateBeneficiaryPayload>
  ): Promise<Beneficiary> {
    const res = await this.http.patch<Beneficiary>(
      `/beneficiaries/${id}`,
      data
    );
    return res.data;
  }

  async deleteBeneficiary(
    id: string
  ): Promise<{ deleted: true; id: string }> {
    const res = await this.http.delete<{ deleted: true; id: string }>(
      `/beneficiaries/${id}`
    );
    return res.data;
  }

  // ========================
  // TRANSACTIONS
  // ========================
  async createTransaction(
    data: CreateTransactionPayload
  ): Promise<Transaction> {
    const res = await this.http.post<Transaction>("/transactions", data);
    return res.data;
  }

  async getTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<Transaction[]>("/transactions");
    return Array.isArray(res.data) ? res.data : [];
  }

  async adminGetTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<Transaction[]>("/transactions/admin/all");
    return Array.isArray(res.data) ? res.data : [];
  }

  async adminUpdateTransactionStatus(
    id: string,
    status: string
  ): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(
      `/transactions/admin/status/${id}`,
      { status }
    );
    return res.data;
  }

  // ========================
  // PAYMENTS
  // ========================
  async initiatePayment(data: InitiatePaymentPayload): Promise<unknown> {
    const res = await this.http.post("/payments/initiate", data);
    return res.data;
  }

  async getPaymentStatus(transactionId: string): Promise<unknown> {
    const res = await this.http.get(`/payments/status/${transactionId}`);
    return res.data;
  }

  // ========================
  // WITHDRAWALS — USER
  // ========================
  async requestWithdrawal(
    data: CreateWithdrawalPayload
  ): Promise<unknown> {
    const res = await this.http.post("/withdrawals", data);
    return res.data;
  }

  async getMyWithdrawals(): Promise<unknown> {
    const res = await this.http.get("/withdrawals/me");
    return res.data;
  }

  // ========================
  // WITHDRAWALS — ADMIN
  // ========================
  async adminGetWithdrawals(): Promise<unknown> {
    const res = await this.http.get("/admin/withdrawals");
    return res.data;
  }

  async adminUpdateWithdrawal(
    id: string,
    payload: UpdateWithdrawalStatusPayload
  ): Promise<unknown> {
    const res = await this.http.patch(
      `/admin/withdrawals/${id}`,
      payload
    );
    return res.data;
  }
}

export const api = new API();
