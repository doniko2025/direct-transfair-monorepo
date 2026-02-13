// apps/direct-transfair-mobile/services/api.ts
import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ✅ CONFIGURATION DES URLS
function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  
  // Si l'URL dans .env est présente, on l'utilise (en s'assurant qu'elle ne finit pas par /api)
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/api$/, ""); 
  }

  // Fallback si le .env est manquant (Utile pour le développement local)
  if (Platform.OS === "web") return "http://localhost:3000";
  return "https://direct-transfair-monorepo-production.up.railway.app"; 
}

// ✅ PROTECTION DU TENANT ID
function getTenantId(): string {
  const envTenant = process.env.EXPO_PUBLIC_TENANT_ID;
  // 🛡️ SÉCURITÉ : Si l'env est vide ou vaut "10", on force "DONIKO"
  if (!envTenant || envTenant.trim() === "" || envTenant.trim() === "10") {
    return "DONIKO";
  }
  return envTenant.trim();
}

// --- UTILITAIRES DE NORMALISATION ---
function ensureAxiosHeaders(headers: InternalAxiosRequestConfig["headers"]): AxiosHeaders {
  if (!headers) return new AxiosHeaders();
  if (headers instanceof AxiosHeaders) return headers;
  return new AxiosHeaders(headers as Record<string, string>);
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
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
  return 0;
}

function normalizeTransaction(t: unknown): Transaction {
  const tx = t as any;
  return {
    ...tx,
    amount: toNumberSafe(tx?.amount),
    fees: toNumberSafe(tx?.fees),
    total: toNumberSafe(tx?.total),
    receivedAmount: tx?.receivedAmount !== undefined ? toNumberSafe(tx?.receivedAmount) : tx?.receivedAmount,
    exchangeRate: tx?.exchangeRate !== undefined ? toNumberSafe(tx?.exchangeRate) : tx?.exchangeRate,
  } as Transaction;
}

function normalizeAgencyPayload(data: CreateAgencyPayload): CreateAgencyPayload {
  const type = (data as any)?.type;
  if (type === "PRIVATE") {
    return { ...data, type: "SUBSIDIARY" as any };
  }
  return data;
}

// --- CLASSE API PRINCIPALE ---
class API {
  public http: AxiosInstance;
  private token: string | null = null;
  private tenant: string = getTenantId();

  constructor() {
    // On ajoute /api systématiquement ici pour que le .env reste propre
    const baseURL = `${getBaseUrl()}/api`;

    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    console.log("🌐 API Initialisée | URL:", baseURL, "| Tenant:", this.tenant);
    
    this.loadPersistedTenant();

    this.http.interceptors.request.use((config) => {
      const headers = ensureAxiosHeaders(config.headers);

      // 🛡️ PROTECTION DOUBLE : On nettoie le tenant avant chaque envoi
      const safeTenant = (this.tenant === "10" || !this.tenant) ? "DONIKO" : this.tenant;
      headers.set("x-tenant-id", safeTenant);

      if (this.token && this.token.trim().length > 0) {
        const cleanToken = this.token.replace(/^"|"$/g, "");
        headers.set("Authorization", `Bearer ${cleanToken}`);
      }

      config.headers = headers;
      return config;
    });
  }

  // ✅ Charge le tenant sauvegardé et écrase le "10" s'il existe
  private async loadPersistedTenant() {
    try {
      const savedTenant = await AsyncStorage.getItem('PREFERRED_TENANT');
      if (savedTenant === "10" || !savedTenant) {
          console.log('⚠️ Nettoyage du tenant invalide (10) détecté.');
          this.tenant = "DONIKO";
          await AsyncStorage.setItem('PREFERRED_TENANT', "DONIKO");
      } else {
          this.tenant = savedTenant;
      }
    } catch (e) {
      console.warn('Erreur lecture AsyncStorage');
    }
  }

  setToken(token: string | null) { this.token = token; }
  clearToken() { this.token = null; }
  
  setTenant(tenant: string) { 
    // Empêche l'application de définir "10" comme tenant via le code
    this.tenant = (tenant === "10") ? "DONIKO" : tenant; 
  }
  
  getTenant(): string { return this.tenant; }

  // --- AUTH ---
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

  // --- TRESORERIE (SUPER ADMIN) ---
  async adminFundSelf(amount: number): Promise<any> {
    const res = await this.http.post("/transactions/admin/fund-self", { amount });
    return res.data;
  }

  async adminRefillAgency(agencyId: string, amount: number): Promise<any> {
    const res = await this.http.post("/transactions/admin/refill-agency", { agencyId, amount });
    return res.data;
  }

  // --- TRANSACTIONS ---
  async getTransactions(): Promise<Transaction[]> {
    const res = await this.http.get<any>("/transactions");
    const list = unwrapArray<any>(res.data);
    return list.map(normalizeTransaction);
  }

  // --- SAAS CLIENTS (GESTION SOCIÉTÉS) ---
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