// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

// ⚠️ CHANGE CECI si tu testes sur un VRAI téléphone (ex: "192.168.1.15")
// Si tu es sur émulateur ou web, laisse "localhost"
const LOCAL_IP = "localhost"; 

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
  // 1. Variable d'environnement (Priorité max)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();

  // 2. Android Emulator (Android Studio)
  if (Platform.OS === "android") {
     return "http://10.0.2.2:3000"; 
  }

  // 3. iOS ou Web ou Vrai Device (via LOCAL_IP)
  return `http://${LOCAL_IP}:3000`;
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
      timeout: 30000, // 30 secondes pour éviter les timeout sur mobile lent
      headers: { "Content-Type": "application/json" },
    });

    // Intercepteur de REQUÊTE : Injecte le Token et le Tenant ID
    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);
      if (this.token) {
        headers.set("Authorization", `Bearer ${this.token}`);
      }
      headers.set("x-tenant-id", this.tenant);
      config.headers = headers;
      return config;
    });

    // Intercepteur de RÉPONSE : Log les erreurs proprement
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
            console.error(`[API Error] ${error.response.status} - ${error.response.config.url}`);
        } else {
            console.error(`[API Error] Network Error - ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  // ========================
  // CONFIGURATION
  // ========================
  setToken(token: string) { this.token = token; }
  clearToken() { this.token = null; }
  setTenant(tenant: string) { this.tenant = tenant; }

  // ========================
  // AUTHENTIFICATION & PROFIL
  // ========================
  async register(data: RegisterPayload): Promise<void> {
    await this.http.post("/auth/register", data);
  }

  async login(data: LoginPayload): Promise<LoginResponse> {
    const res = await this.http.post<LoginResponse>("/auth/login", data);
    return res.data;
  }

  async getMe(): Promise<AuthUser> {
    const res = await this.http.get<AuthUser>("/auth/me");
    return res.data;
  }

  // ✅ AJOUT : Mise à jour du profil (Nom, Prénom, Tel)
  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const res = await this.http.patch<AuthUser>("/auth/me", data);
    return res.data;
  }

  // ========================
  // BÉNÉFICIAIRES
  // ========================
  async getBeneficiaries(): Promise<Beneficiary[]> {
    const res = await this.http.get<Beneficiary[]>("/beneficiaries");
    return Array.isArray(res.data) ? res.data : [];
  }

  async createBeneficiary(data: CreateBeneficiaryPayload): Promise<Beneficiary> {
    const res = await this.http.post<Beneficiary>("/beneficiaries", data);
    return res.data;
  }

  async getBeneficiary(id: string): Promise<Beneficiary> {
    const res = await this.http.get<Beneficiary>(`/beneficiaries/${id}`);
    return res.data;
  }

  async updateBeneficiary(id: string, data: Partial<CreateBeneficiaryPayload>): Promise<Beneficiary> {
    const res = await this.http.patch<Beneficiary>(`/beneficiaries/${id}`, data);
    return res.data;
  }

  async deleteBeneficiary(id: string): Promise<{ deleted: true; id: string }> {
    const res = await this.http.delete<{ deleted: true; id: string }>(`/beneficiaries/${id}`);
    return res.data;
  }

  // ========================
  // TRANSACTIONS (CLIENT & ADMIN)
  // ========================
  async createTransaction(data: CreateTransactionPayload): Promise<Transaction> {
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

  async adminUpdateTransactionStatus(id: string, status: string): Promise<Transaction> {
    const res = await this.http.patch<Transaction>(
      `/transactions/admin/status/${id}`,
      { status }
    );
    return res.data;
  }

  // ========================
  // GUICHET / AGENT (RETRAITS CASH)
  // ========================

  // ✅ Rechercher une transaction par son CODE (Référence)
  async findTransactionByReference(reference: string): Promise<Transaction> {
    // On charge toutes les transactions (admin) et on filtre côté client
    // (Dans une vraie prod, on ferait une route API dédiée /search?ref=...)
    const all = await this.adminGetTransactions();
    const found = all.find(t => t.reference.trim().toUpperCase() === reference.trim().toUpperCase());
    
    if (!found) throw new Error("Transaction introuvable");
    return found;
  }

  // ✅ Valider le retrait cash (Passe le statut à PAID)
  async processCashWithdrawal(transactionId: string): Promise<Transaction> {
    return this.adminUpdateTransactionStatus(transactionId, "PAID");
  }

  // ========================
  // AUTRES (PAIEMENTS & RETRAITS COMPTE)
  // ========================
  async initiatePayment(data: InitiatePaymentPayload): Promise<unknown> {
    const res = await this.http.post("/payments/initiate", data);
    return res.data;
  }

  async getPaymentStatus(transactionId: string): Promise<unknown> {
    const res = await this.http.get(`/payments/status/${transactionId}`);
    return res.data;
  }

  async requestWithdrawal(data: CreateWithdrawalPayload): Promise<unknown> {
    const res = await this.http.post("/withdrawals", data);
    return res.data;
  }

  async getMyWithdrawals(): Promise<unknown> {
    const res = await this.http.get("/withdrawals/me");
    return res.data;
  }

  async adminGetWithdrawals(): Promise<unknown> {
    const res = await this.http.get("/admin/withdrawals");
    return res.data;
  }

  async adminUpdateWithdrawal(id: string, payload: UpdateWithdrawalStatusPayload): Promise<unknown> {
    const res = await this.http.patch(`/admin/withdrawals/${id}`, payload);
    return res.data;
  }
}

export const api = new API();