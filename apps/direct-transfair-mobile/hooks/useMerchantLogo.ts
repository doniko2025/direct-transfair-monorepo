// apps/direct-transfair-mobile/hooks/useMerchantLogo.ts
// =========================================================
// LOGO DU COMMERCE (lot 13) — image protégée (GET /merchants/:shopId/logo), gardée sur l'appareil.
// On ne télécharge que si l'empreinte annoncée par le serveur (`logoVersion`) a changé : une fiche, un reçu, un QR affichent
// donc le logo sans appel réseau supplémentaire la plupart du temps. Le logo d'un commerce est lisible par toute personne
// de la même société (un client le voit sur l'écran de paiement) — jamais par une autre société.
// Retourne `null` quand il n'y a pas de logo : l'appelant affiche alors les initiales.
// =========================================================

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import { bytesToBase64 } from "../services/kyc";

const memory = new Map<string, { version: string; uri: string }>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

const KEY = (shopId: string) => `dt.merchantLogo.${shopId}`;

async function load(shopId: string, version: string): Promise<string | null> {
  const hit = memory.get(shopId);
  if (hit && hit.version === version) return hit.uri;
  const running = inflight.get(`${shopId}:${version}`);
  if (running) return running;
  const job = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY(shopId));
      const c = raw ? JSON.parse(raw) : null;
      if (c?.version === version && typeof c?.uri === "string") {
        memory.set(shopId, { version, uri: c.uri });
        return c.uri as string;
      }
    } catch { /* cache illisible : on retélécharge */ }
    try {
      const res = await api.http.get<ArrayBuffer>(`/merchants/${encodeURIComponent(shopId)}/logo`, {
        responseType: "arraybuffer",
        timeout: 30_000,
        validateStatus: (s: number) => s === 200 || s === 404,
      });
      if (res.status !== 200) return null;
      const mime = String(res.headers?.["content-type"] ?? "image/png").split(";")[0].trim();
      const uri = `data:${mime};base64,${bytesToBase64(res.data)}`;
      memory.set(shopId, { version, uri });
      AsyncStorage.setItem(KEY(shopId), JSON.stringify({ version, uri })).catch(() => { /* sans incidence */ });
      listeners.forEach((l) => l());
      return uri;
    } catch {
      return null; // réseau coupé : les initiales suffisent
    }
  })().finally(() => { inflight.delete(`${shopId}:${version}`); });
  inflight.set(`${shopId}:${version}`, job);
  return job;
}

/** Oublie le logo gardé (après un changement ou un retrait par le marchand). */
export function forgetMerchantLogo(shopId?: string | null) {
  if (!shopId) return;
  memory.delete(shopId);
  AsyncStorage.removeItem(KEY(shopId)).catch(() => { /* sans incidence */ });
  listeners.forEach((l) => l());
}

/**
 * @param shopId  identifiant public du commerce
 * @param version empreinte du logo (`logoVersion`) ; null/undefined = pas de logo
 */
export function useMerchantLogo(shopId?: string | null, version?: string | null): string | null {
  const [uri, setUri] = useState<string | null>(() => (shopId && version && memory.get(shopId)?.version === version ? memory.get(shopId)!.uri : null));

  useEffect(() => {
    let alive = true;
    if (!shopId || !version) { setUri(null); return; }
    const hit = memory.get(shopId);
    if (hit && hit.version === version) setUri(hit.uri);
    else void load(shopId, version).then((u) => { if (alive) setUri(u); });
    const l = () => {
      const h = memory.get(shopId);
      if (alive) setUri(h && h.version === version ? h.uri : null);
    };
    listeners.add(l);
    return () => { alive = false; listeners.delete(l); };
  }, [shopId, version]);

  return uri;
}
