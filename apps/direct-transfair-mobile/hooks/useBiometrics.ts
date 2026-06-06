// apps/direct-transfair-mobile/hooks/useBiometrics.ts
// =========================================================
// BIOMETRICS HOOK v1.0 — Direct Transf'air
// ✅ Vérifie la dispo matérielle + enrollment
// ✅ Stocke la préférence en SecureStore (fallback AsyncStorage)
// ✅ hasStoredRefreshToken — pour afficher le bouton bio sur login
// =========================================================

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BIO_PREF_KEY   = "dt_bio_enabled";
const REFRESH_TOKEN_KEY = "refreshToken"; // même clé que STORAGE_KEYS.REFRESH_TOKEN dans api.ts

// ─── Storage helpers ─────────────────────────────────────

async function getStorage(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val) return val;
  } catch {}
  try { return await AsyncStorage.getItem(key); } catch {}
  return null;
}

async function setStorage(key: string, val: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, val); } catch {}
    return;
  }
  try { await SecureStore.setItemAsync(key, val); return; } catch {}
  try { await AsyncStorage.setItem(key, val); } catch {}
}

async function removeStorage(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch {}
  try { await AsyncStorage.removeItem(key); } catch {}
}

// ─── API publique ────────────────────────────────────────

/** Vérifie si le matériel est compatible ET qu'une empreinte/Face ID est enregistrée */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/** Lit la préférence stockée par l'utilisateur */
export async function getBiometricsEnabled(): Promise<boolean> {
  const val = await getStorage(BIO_PREF_KEY);
  return val === "true";
}

/** Active ou désactive la préférence biométrique */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await setStorage(BIO_PREF_KEY, "true");
  } else {
    await removeStorage(BIO_PREF_KEY);
  }
}

/** Lance le prompt biométrique natif — retourne true si succès */
export async function promptBiometrics(reason?: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:          reason ?? "Confirmez votre identité",
      fallbackLabel:          "Utiliser le code",
      cancelLabel:            "Annuler",
      disableDeviceFallback:  false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Vérifie qu'un refresh token est en storage (condition pour montrer le bouton bio sur login) */
export async function hasStoredRefreshToken(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const val = await getStorage(REFRESH_TOKEN_KEY);
  return typeof val === "string" && val.length > 0;
}