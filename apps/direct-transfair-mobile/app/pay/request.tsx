// apps/direct-transfair-mobile/app/pay/request.tsx
// =========================================================
// DEMANDE DE PAIEMENT REÇUE v1.0 — Lot 11
// Un marchand a saisi le numéro du client : la demande arrive ici (et par notification). Le client la valide avec
// son code secret ou la refuse. Ouverte aussi depuis la notification (/pay/request?id=…).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import PayCheckout from "../../components/merchant/PayCheckout";
import { ErrorView, NavBar, Screen, SkeletonRows } from "../../components/ui";
import { apiProblem } from "../../components/merchant/merchantUi";

export default function PayRequestScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [view, setView] = useState<PaymentRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setView(await api.getPaymentRequest(String(id)));
    } catch (e) {
      setError(apiProblem(e).message);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Le marchand qui ouvre sa propre demande (lien de notification) est renvoyé vers son suivi.
  useEffect(() => {
    if (view && view.isMine === "PAYEE") router.replace({ pathname: "/merchant/payment", params: { id: view.id } } as any);
  }, [view, router]);

  const finish = () => router.replace("/pay/requests" as any);

  return (
    <Screen header={<NavBar onBack={() => router.back()} title="Demande de paiement" />}>
      {error ? (
        <ErrorView title="Demande introuvable" message={error} onRetry={load} />
      ) : !view || view.isMine === "PAYEE" ? (
        <SkeletonRows rows={3} />
      ) : (
        <PayCheckout
          view={view}
          onPay={(pin) => api.payPaymentRequest(view.id, pin)}
          onDecline={() => api.declinePaymentRequest(view.id)}
          onFinish={finish}
        />
      )}
    </Screen>
  );
}
