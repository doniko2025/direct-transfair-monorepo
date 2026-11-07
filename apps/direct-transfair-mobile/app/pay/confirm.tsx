// apps/direct-transfair-mobile/app/pay/confirm.tsx
// =========================================================
// CONFIRMER UN PAIEMENT PAR QR v1.0 — Lot 11
// Reçoit le contenu du QR scanné (?payload=…), affiche le commerce et le montant fixé par le marchand
// (sans jamais exposer les frais du marchand), puis débite le client après saisie du code secret.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import type { PaymentRequestView } from "../../services/merchantTypes";
import PayCheckout from "../../components/merchant/PayCheckout";
import { Button, ErrorView, NavBar, Screen, SkeletonRows } from "../../components/ui";
import { apiProblem, parseMerchantQr } from "../../components/merchant/merchantUi";

export default function PayConfirmScreen() {
  const router = useRouter();
  const { payload: raw } = useLocalSearchParams<{ payload?: string }>();
  const payload = parseMerchantQr(typeof raw === "string" ? raw : null);
  const [view, setView] = useState<PaymentRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!payload) return;
    setError(null);
    try {
      setView(await api.previewQrPayment(payload));
    } catch (e) {
      setError(apiProblem(e).message);
    }
  }, [payload]);

  useEffect(() => { void load(); }, [load]);

  const finish = () => router.replace("/(tabs)/home" as any);

  return (
    <Screen header={<NavBar onBack={() => router.back()} title="Payer avec QR code" />}>
      {!payload ? (
        <ErrorView title="QR code non reconnu" message="Ce code n'est pas un QR de paiement marchand." onRetry={() => router.replace("/pay/scan" as any)} />
      ) : error ? (
        <>
          <ErrorView title="Paiement impossible" message={error} onRetry={load} />
          <Button label="Scanner un autre QR" kind="outline" onPress={() => router.replace("/pay/scan" as any)} />
        </>
      ) : !view ? (
        <SkeletonRows rows={3} />
      ) : (
        <PayCheckout view={view} onPay={(pin) => api.payQr(payload, pin)} onFinish={finish} />
      )}
    </Screen>
  );
}
