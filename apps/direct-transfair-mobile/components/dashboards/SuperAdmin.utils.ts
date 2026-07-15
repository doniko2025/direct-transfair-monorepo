// apps/direct-transfair-mobile/components/dashboards/SuperAdmin.utils.ts
// =========================================================
// ✅ FIX (juillet 2026) : generateTempPassword6() non cryptographique
//
//   PROBLÈME RÉSOLU :
//   Cette fonction génère le mot de passe temporaire d'une NOUVELLE
//   SOCIÉTÉ (CreateCompanyModal.tsx → adminPassword), envoyé tel quel
//   au backend. Elle utilisait Math.random() — non cryptographique,
//   théoriquement prévisible par un attaquant connaissant l'état
//   interne du PRNG du moteur JS. Même classe de problème que le mot
//   de passe en dur '123456' corrigé côté backend
//   (agencies.service.ts v4.4) — sauf qu'ici le risque porte sur le
//   compte COMPANY_ADMIN d'une société entière, pas un simple agent.
//   Au passage : le nom "generateTempPassword6" est trompeur, la
//   boucle génère 10 caractères, pas 6 — non touché ici (changer la
//   longueur n'est pas un bug de sécurité), juste signalé.
//
//   CORRECTIF :
//   expo-crypto (Crypto.getRandomBytes(), API synchrone officiellement
//   documentée : https://docs.expo.dev/versions/latest/sdk/crypto/)
//   remplace Math.random() pour tirer chaque caractère. Le keyspace
//   reste 36^10 (lettres majuscules + chiffres, 10 caractères), mais
//   la source d'aléa est maintenant cryptographiquement forte.
//   generateTenantCode7() n'est PAS touchée : c'est un code
//   d'identification (comme un slug), pas un secret — aucun enjeu de
//   sécurité à en tirer un aléa cryptographique.
//   ⚠️ NOUVELLE DÉPENDANCE si pas déjà installée :
//   npx expo install expo-crypto
// =========================================================
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto"; // ✅ FIX — voir changelog ci-dessus

export type SubscriptionStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED" | string;
export type SubscriptionType = "RENTAL" | "PURCHASE" | string;

export type ClientSaas = {
  id: string;
  name: string;
  code: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionType?: SubscriptionType;
  primaryColor?: string | null;
};

export type QuickAction = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function normalizeClients(raw: unknown): ClientSaas[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? (raw.data as unknown[])
      : [];

  const out: ClientSaas[] = [];
  for (const item of arr) {
    if (!isRecord(item)) continue;
    const id = toStr(item.id);
    const name = toStr(item.name);
    const code = toStr(item.code);
    if (!id || !code) continue;

    out.push({
      id,
      name: name || code,
      code,
      subscriptionStatus: toStr(item.subscriptionStatus) || undefined,
      subscriptionType: toStr(item.subscriptionType) || undefined,
      primaryColor: isRecord(item) ? ((item.primaryColor as string | null | undefined) ?? null) : null,
    });
  }
  return out;
}

export function statusLabel(s?: string) {
  if (!s) return "INCONNU";
  const up = s.toUpperCase();
  if (up === "ACTIVE") return "ACTIF";
  if (up === "INACTIVE") return "INACTIF";
  if (up === "EXPIRED") return "EXPIRÉ";
  if (up === "SUSPENDED") return "SUSPENDU";
  return up;
}

export function statusColor(s?: string) {
  const up = (s ?? "").toUpperCase();
  if (up === "ACTIVE") return "#10B981";
  if (up === "INACTIVE") return "#64748B";
  if (up === "EXPIRED") return "#EF4444";
  if (up === "SUSPENDED") return "#F59E0B";
  return "#94A3B8";
}

export function subscriptionLabel(t?: string) {
  const up = (t ?? "").toUpperCase();
  if (up === "PURCHASE") return "ACHAT";
  if (up === "RENTAL") return "LOCATION";
  return up || "—";
}

export function isEmailLike(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function onlyDigits(v: string): string {
  return v.replace(/[^\d]/g, "");
}

export function normalizeUpperAlnum(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ⚠️ Non touchée — voir changelog en tête de fichier : un code
// d'identification de société n'est pas un secret, Math.random() est
// suffisant ici.
export function generateTenantCode7(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 7; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

// ✅ FIX — voir changelog en tête de fichier : Crypto.getRandomBytes()
// (expo-crypto, synchrone) au lieu de Math.random(). Conserve le
// même keyspace (36^10) et la même longueur (10 caractères, malgré
// le nom trompeur de la fonction — non renommée pour ne pas casser
// les appels existants).
export function generateTempPassword6(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const length = 10;
  const randomBytes = Crypto.getRandomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet.charAt(randomBytes[i] % alphabet.length);
  }
  return out;
}