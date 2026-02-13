// apps/direct-transfair-mobile/api.ts
import axios, { AxiosInstance } from "axios";
import { Platform } from "react-native";

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const fallbackLocalApiUrl =
  Platform.OS === "web"
    ? "http://localhost:3000"
    : "http://192.168.1.40:3000"; // utile uniquement si tu testes en local via Expo Go

const API_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL ?? fallbackLocalApiUrl
);

const TENANT_CODE = process.env.EXPO_PUBLIC_TENANT_ID ?? "DONIKO";

// ==================================================
// 🔥 Client Axios (typé)
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
