// src/lib/api.ts
// Instance unique du client HTTP + des endpoints, partagée par toute l'app.
// Le tenant courant et le handler « session expirée » sont renseignés par
// les providers (TenantProvider / AuthProvider).

import { createApi, createHttpClient } from '@direct-transfair/shared';
import { API_URL } from '../config';
import { createBrowserTokenStorage } from './tokenStorage';

export const storage = createBrowserTokenStorage();

let currentTenant: string | null = null;
export function setCurrentTenant(code: string | null): void {
  currentTenant = code;
}

let expiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: () => void): () => void {
  expiredHandler = handler;
  return () => {
    if (expiredHandler === handler) expiredHandler = null;
  };
}

export const http = createHttpClient({
  baseUrl: API_URL,
  storage,
  getTenant: () => currentTenant,
  onSessionExpired: () => expiredHandler?.(),
});

export const api = createApi(http);
