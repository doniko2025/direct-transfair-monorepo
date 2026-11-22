// apps/direct-transfair-mobile/hooks/useRateLock.ts
// =========================================================
// useRateLock v1.1 — taux garanti quelques minutes (lot 16)
// ✅ v1.1 : `receivedTarget` — quand le client a SAISI le montant à recevoir, il est transmis au serveur qui crédite exactement ce montant.
//
// Sur l'écran de confirmation d'un envoi, demande au serveur de GARANTIR le montant que recevra le bénéficiaire
// (POST /rate-locks). L'identifiant obtenu est joint à l'envoi (rateLockId) : si la garantie est encore valable, c'est ce
// montant qui est crédité, même si le taux a bougé entre-temps.
//
//   • une garantie par combinaison (montant, devise, devise reçue) ; changement de montant → nouvelle demande (350 ms de délai) ;
//   • à l'expiration, la garantie est renouvelée automatiquement ; `updated` signale un montant reçu différent du précédent ;
//   • aucune garantie ne bloque l'envoi : si le serveur ne répond pas, `lock` reste null et l'envoi se fait au taux du moment ;
//   • le décompte n'est PAS stocké ici (pas de rendu chaque seconde) : l'écran affiche <RateLockBadge expiresAtMs=…/>.
// =========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { RateLock } from "../services/growthTypes";

interface Params {
  amount: number;
  currency: string;
  targetCurrency: string;
  /** Montant à recevoir saisi par le client (champ « reçoit ») : le serveur le crédite exactement. Absent quand on saisit l'envoi. */
  receivedTarget?: number;
  enabled?: boolean;
}

export interface RateLockState {
  /** Garantie valable pour EXACTEMENT ces paramètres, ou null (en cours, indisponible, expirée). */
  lock: RateLock | null;
  /** Instant d'expiration (horloge de l'appareil) de `lock`. */
  expiresAtMs: number;
  loading: boolean;
  /** Montant reçu avant/après un renouvellement automatique si le taux a changé ; effacé par dismissUpdate(). */
  updated: { from: number; to: number } | null;
  dismissUpdate: () => void;
  /** Redemande une garantie tout de suite (après un refus du serveur, par exemple). */
  renewNow: () => void;
  /** Vrai si la garantie est encore valable à l'instant T (à tester juste avant d'envoyer). */
  isLive: () => boolean;
}

const DEBOUNCE_MS = 350;

export function useRateLock({ amount, currency, targetCurrency, receivedTarget, enabled = true }: Params): RateLockState {
  const key = `${amount}|${currency}|${targetCurrency}|${receivedTarget ?? ""}`;
  const active = enabled && amount > 0 && !!currency && !!targetCurrency && currency !== targetCurrency;

  const [state, setState] = useState<{ key: string; lock: RateLock; expiresAtMs: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<{ from: number; to: number } | null>(null);
  const [nonce, setNonce] = useState(0);
  const lastReceived = useRef<{ key: string; value: number } | null>(null);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const lock = await api.quoteRateLock({ amount, currency, targetCurrency, ...(receivedTarget && receivedTarget > 0 ? { desiredReceivedAmount: receivedTarget } : {}) });
        if (cancelled) return;
        const expiresAtMs = Date.now() + Math.max(0, lock.secondsLeft) * 1000;
        const prev = lastReceived.current;
        if (prev && prev.key === key && prev.value !== lock.receivedAmount) setUpdated({ from: prev.value, to: lock.receivedAmount });
        lastReceived.current = { key, value: lock.receivedAmount };
        setState({ key, lock, expiresAtMs });
        // Renouvellement automatique à l'expiration (si l'écran est toujours là et les paramètres inchangés).
        expiryTimer = setTimeout(() => { if (!cancelled) setNonce((n) => n + 1); }, Math.max(1000, expiresAtMs - Date.now()));
      } catch {
        if (!cancelled) setState(null); // pas de garantie : l'envoi se fera au taux du moment
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); if (expiryTimer) clearTimeout(expiryTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, nonce]);

  // Autre montant / autre devise : on oublie le précédent « montant reçu » (ce n'est pas une variation de taux).
  useEffect(() => { lastReceived.current = null; setUpdated(null); }, [key]);

  const valid = active && state && state.key === key ? state : null;
  const dismissUpdate = useCallback(() => setUpdated(null), []);
  const renewNow = useCallback(() => setNonce((n) => n + 1), []);
  const isLive = useCallback(() => !!valid && Date.now() < valid.expiresAtMs - 1500, [valid]);

  return { lock: valid?.lock ?? null, expiresAtMs: valid?.expiresAtMs ?? 0, loading: active && loading && !valid, updated, dismissUpdate, renewNow, isLive };
}
