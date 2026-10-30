// apps/direct-transfair-mobile/hooks/useFeeQuote.ts
// =========================================================
// useFeeQuote v1.0 — frais EXACTS d'un envoi, calculés par le serveur
//
// POURQUOI
//   Les écrans d'envoi calculaient les frais avec le tarif plat historique de GET /commissions/fees
//   (montant × taux, arrondi à l'unité supérieure par endroits). Le serveur, lui, facture avec le barème de la société
//   (règle la plus spécifique : montant, pays d'envoi et de réception, mode, frais fixe converti) via
//   GET /fees-admin/quote. Résultat : le montant affiché, le reçu et le débit réel pouvaient différer.
//   Ce hook interroge le même calcul que le serveur ; tant que la réponse n'est pas arrivée (ou en cas d'erreur), il
//   renvoie fees = null et l'écran garde son estimation de repli.
// =========================================================

import { useEffect, useState } from "react";
import { api } from "../services/api";

export type QuotePayoutMethod = "CASH_PICKUP" | "WALLET" | "MOBILE_MONEY";

interface Params {
  amount: number;
  currency: string;
  payoutMethod: QuotePayoutMethod;
  /** Pays de réception (ISO-2), si connu. */
  receiveCountry?: string | null;
  enabled?: boolean;
}

export interface FeeQuoteState {
  /** Frais exacts du serveur pour exactement ces paramètres, ou null (en cours / indisponible). */
  fees: number | null;
  loading: boolean;
}

const DEBOUNCE_MS = 350;

export function useFeeQuote({ amount, currency, payoutMethod, receiveCountry, enabled = true }: Params): FeeQuoteState {
  const key = `${amount}|${currency}|${payoutMethod}|${receiveCountry ?? ""}`;
  const [result, setResult] = useState<{ key: string; fees: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !(amount > 0) || !currency) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const ask = async (country: string | null) => {
        const params: Record<string, string | number> = { amount, currency, payoutMethod };
        if (country) params.receiveCountry = country;
        const res = await (api.http as any).get("/fees-admin/quote", { params });
        const body = res?.data?.data ?? res?.data;
        const fees = Number(body?.fees);
        return Number.isFinite(fees) && fees >= 0 ? fees : null;
      };
      let fees: number | null = null;
      try {
        fees = await ask(receiveCountry ?? null);
      } catch {
        // pays de réception refusé par le serveur (400) : on retente sans pays plutôt que de perdre le calcul
        if (receiveCountry) {
          try { fees = await ask(null); } catch { fees = null; }
        }
      }
      if (cancelled) return;
      setResult(fees === null ? null : { key, fees });
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { fees: result && result.key === key ? result.fees : null, loading };
}
