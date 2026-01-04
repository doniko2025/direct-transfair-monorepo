// apps/direct-transfair-mobile/api.ts
import axios, { AxiosInstance } from "axios";
import { Platform } from "react-native";

// ⚠️ Mets l’IP locale de ton PC pour Expo Go
const LOCAL_IP = "http://192.168.1.40:3000";
const WEB_URL = "http://localhost:3000";

// Web → localhost ; Mobile → IP locale
const API_URL = Platform.OS === "web" ? WEB_URL : LOCAL_IP;

const TENANT_CODE = "DONIKO";

// ==================================================
// 🔥 Client Axios (typé !)
// ==================================================
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    "x-tenant-id": TENANT_CODE,
  },
});

// ==================================================
// 🔐 Token manager
// ==================================================
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
