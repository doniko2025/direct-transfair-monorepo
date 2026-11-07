// apps/direct-transfair-mobile/hooks/useKycStatus.ts
// État de la vérification d'identité du client connecté (rôle USER seulement : les autres rôles ne passent pas par là).
// Rechargé à chaque retour sur l'écran, pour que la bannière disparaisse dès que l'administrateur valide.
// Une panne réseau ne bloque rien : `status` reste null et l'écran n'affiche simplement pas la bannière.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../providers/AuthProvider";
import { kycApi, type KycStatusView } from "../services/kyc";

export function useKycStatus(): { status: KycStatusView | null; loading: boolean; reload: () => Promise<void> } {
  const { user } = useAuth();
  const isClient = user?.role === "USER";
  const [status, setStatus] = useState<KycStatusView | null>(null);
  const [loading, setLoading] = useState(isClient);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!isClient) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    try {
      const s = await kycApi.me();
      if (id === seq.current) setStatus(s);
    } catch {
      /* silencieux : pas de bannière si on ne sait pas */
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [isClient]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { status, loading, reload };
}
