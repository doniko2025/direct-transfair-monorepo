// apps/direct-transfair-mobile/services/notificationRouting.ts
// =========================================================
// OUVERTURE D'UN ÉCRAN DEPUIS UNE NOTIFICATION — Lot 11
// Le serveur joint un lien (actionUrl) aux notifications marchand : /merchant/payment?id=…, /pay/request?id=…, etc.
// Seuls les écrans de l'application listés ici sont ouverts (liste blanche) : un lien inconnu ou externe est ignoré.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

const ALLOWED = [
  "/merchant", "/merchant/payment", "/merchant/payments", "/merchant/payouts", "/merchant/settings", "/pay/request", "/pay/requests",
  // Lot 13 : QR de caisse, clôture, équipe, et l'espace « Caisse » d'un caissier.
  "/merchant/qr", "/merchant/closing", "/merchant/staff", "/cashier",
];

export type AppTarget = { pathname: string; params?: Record<string, string> };

/** Transforme un actionUrl en cible de navigation, ou null si ce n'est pas un écran connu de l'application. */
export function resolveActionUrl(raw: unknown): AppTarget | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  const [path, query = ""] = s.split("?");
  if (!path || !ALLOWED.includes(path)) return null;
  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    if (k === "id" && /^[A-Za-z0-9_-]{1,64}$/.test(decodeURIComponent(v))) params.id = decodeURIComponent(v);
  }
  if ((path === "/merchant/payment" || path === "/pay/request") && !params.id) return null;
  return Object.keys(params).length ? { pathname: path, params } : { pathname: path };
}

/**
 * Compte (client | marchand) d'une notification. Le serveur l'indique dans `space` ; un ancien serveur ne l'envoie pas :
 * on le déduit alors de l'écran qu'elle ouvre (même règle que le serveur : /merchant… = compte marchand, tout le reste = client,
 * y compris /cashier, l'espace caissier relevant du compte client).
 */
export function notificationSpace(n: { space?: unknown; actionUrl?: unknown } | null | undefined): "client" | "merchant" {
  if (n?.space === "merchant" || n?.space === "client") return n.space;
  return typeof n?.actionUrl === "string" && /^\/merchant(\/|\?|$)/.test(n.actionUrl.trim()) ? "merchant" : "client";
}
