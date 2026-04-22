//apps/direct-transfair-mobile/components/dashboards/SuperAdmin.utils.ts
// SuperAdmin.utils.ts
import { Ionicons } from "@expo/vector-icons";

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

export function generateTenantCode7(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 7; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

export function generateTempPassword6(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}