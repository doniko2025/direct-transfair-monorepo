// apps/direct-transfair-mobile/services/deviceRegistration.ts
// =========================================================
// DEVICE REGISTRATION v1.0 — Direct Transf'air
// ✅ Enregistre l'appareil courant auprès du backend après une
//    connexion réussie (login, register, biométrie, OTP téléphone)
//    ou au démarrage si une session existante est restaurée.
//
//    PROBLÈME RÉSOLU : rien dans AuthProvider.tsx n'appelait jamais
//    api.registerDevice() ni n'écrivait AsyncStorage["deviceId"] —
//    l'écran "Appareils connectés" (devices.tsx) affichait donc
//    toujours "0 appareil", même en build natif.
//
// ⚠️ Dépendances requises (à installer si pas déjà présentes) :
//    npx expo install expo-notifications expo-device
//
// COMPORTEMENT :
// - Génère un identifiant stable PAR INSTALLATION (UUID v4 fait main,
//   pas besoin de expo-crypto), persisté dans AsyncStorage sous
//   "localDeviceUUID" — réutilisé à chaque connexion, jamais régénéré
//   tant que l'app n'est pas désinstallée / le storage effacé.
// - ⚠️ Hypothèse à confirmer côté backend : on ne ré-enregistre PAS
//   si un "deviceId" est déjà stocké localement, pour éviter de créer
//   un doublon à chaque connexion. Si POST /auth/devices fait un
//   upsert par deviceId, on peut retirer ce garde-fou pour rafraîchir
//   le pushToken à chaque connexion à la place.
// - Le refus de la permission notifications n'empêche PAS
//   l'enregistrement (pushToken sera simplement absent) — la liste
//   "Appareils connectés" est une fonctionnalité de sécurité/session,
//   pas seulement un prérequis aux notifications push.
// - Ne lève JAMAIS d'exception — un échec d'enregistrement ne doit
//   jamais bloquer la connexion de l'utilisateur (appelé en
//   "fire-and-forget" depuis AuthProvider, sans await).
// =========================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";
import type { DevicePlatform } from "./types";

const LOCAL_DEVICE_UUID_KEY = "localDeviceUUID";
const REGISTERED_DEVICE_KEY = "deviceId"; // ✅ clé lue par devices.tsx

// ── UUID v4 maison — pas de dépendance crypto nécessaire ici,
//    c'est un identifiant d'installation, pas un secret ──────
function generateUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateLocalDeviceUuid(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(LOCAL_DEVICE_UUID_KEY);
    if (existing) return existing;
  } catch { /* noop */ }
  const fresh = generateUuidV4();
  try { await AsyncStorage.setItem(LOCAL_DEVICE_UUID_KEY, fresh); } catch { /* noop */ }
  return fresh;
}

function detectPlatform(): DevicePlatform {
  if (Platform.OS === "ios")     return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  if (Platform.OS === "web")     return "WEB";
  return "DESKTOP";
}

// ── Token push — best effort, jamais bloquant ──────────────
async function getPushTokenSafe(): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined; // expo-notifications indisponible sur web
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    return tokenResponse.data;
  } catch {
    return undefined; // permission refusée / simulateur / erreur réseau
  }
}

/**
 * Enregistre l'appareil courant si ce n'est pas déjà fait sur cet
 * appareil. À appeler (sans await, fire-and-forget) après chaque
 * connexion réussie et au démarrage si une session existante est
 * restaurée avec succès.
 */
export async function registerCurrentDeviceIfNeeded(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(REGISTERED_DEVICE_KEY);
    if (already) return; // déjà enregistré sur cet appareil

    const deviceId   = await getOrCreateLocalDeviceUuid();
    const platform    = detectPlatform();
    const deviceName: string | undefined =
      (Device.modelName as string | null) ?? (Device.deviceName as string | null) ?? undefined;
    const pushToken   = await getPushTokenSafe();

    const created = await api.registerDevice({
      platform,
      deviceName,
      deviceId,
      pushToken,
    });

    // Clé lue par devices.tsx pour identifier "cet appareil" dans la liste
    await AsyncStorage.setItem(REGISTERED_DEVICE_KEY, created?.id ?? deviceId);
  } catch (e) {
    console.warn("registerCurrentDeviceIfNeeded: échec non bloquant", e);
  }
}