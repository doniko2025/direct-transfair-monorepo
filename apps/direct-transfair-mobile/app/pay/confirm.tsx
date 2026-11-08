// apps/direct-transfair-mobile/app/pay/confirm.tsx
// =========================================================
// CONFIRMER UN PAIEMENT PAR QR v2.0 — Lots 11 et 13
// Reçoit le contenu du QR scanné (?payload=…).
//  • QR à usage unique (affiché par le marchand) : montant fixé par le marchand → confirmation avec le code secret.
//  • QR de caisse PERMANENT (lot 13) : le client saisit lui-même le montant, vérifie le commerce, puis confirme avec son code
//    secret. Le serveur crée alors la demande et la règle en une seule opération.
// Les frais du marchand ne sont jamais exposés au client.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { PaymentRequestView } from "../../services/merchantTypes";
import PayCheckout from "../../components/merchant/PayCheckout";
import { ShopAvatar } from "../../components/merchant/ShopAvatar";
import { AmountInput, Button, Card, ErrorView, NavBar, Notice, Screen, SkeletonRows, UText } from "../../components/ui";
import { Rise, apiProblem, money, parseMerchantQr } from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";

/** Temps laissé au client pour saisir son code secret après avoir choisi le montant. */
const STATIC_CHECKOUT_SECONDS = 180;

export default function PayConfirmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { payload: raw } = useLocalSearchParams<{ payload?: string }>();
  const payload = parseMerchantQr(typeof raw === "string" ? raw : null);
  const [view, setView] = useState<PaymentRequestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);

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

  const isStatic = !!view?.staticQr;
  const currency = view?.currency ?? user?.primaryCurrency ?? "XOF";
  const amount = useMemo(() => roundTo(parseAmount(amountText), decimalsFor(currency)), [amountText, currency]);
  const min = view?.minAmount ?? null;
  const max = view?.maxAmount ?? null;
  const amountError = (() => {
    if (!showErrors) return null;
    if (!(amount > 0)) return "Saisissez le montant à payer.";
    if (min && amount < min) return `Montant minimum : ${money(min, currency)}.`;
    if (max && amount > max) return `Montant maximum : ${money(max, currency)}.`;
    return null;
  })();

  const next = () => {
    setShowErrors(true);
    if (!(amount > 0) || (min && amount < min) || (max && amount > max)) return;
    setChosen(amount);
  };

  // Vue « virtuelle » pour le paiement d'un QR de caisse : le serveur ne crée la demande qu'au moment de payer.
  const checkoutView: PaymentRequestView | null = useMemo(() => {
    if (!view || !isStatic || chosen === null) return null;
    return {
      ...view,
      id: `static-${chosen}`,
      reference: "—",
      status: "PENDING",
      amount: chosen,
      secondsLeft: STATIC_CHECKOUT_SECONDS,
      expiresAt: new Date(Date.now() + STATIC_CHECKOUT_SECONDS * 1000).toISOString(),
      staticQr: false,
    };
  }, [view, isStatic, chosen]);

  const back = () => (chosen !== null && isStatic ? setChosen(null) : router.back());

  return (
    <Screen
      header={<NavBar onBack={back} title="Payer avec QR code" />}
      footer={view && isStatic && chosen === null ? <Button label="Continuer" icon="arrow-forward" onPress={next} testID="static-continue" /> : undefined}
    >
      {!payload ? (
        <ErrorView title="QR code non reconnu" message="Ce code n'est pas un QR de paiement marchand." onRetry={() => router.replace("/pay/scan" as any)} />
      ) : error ? (
        <>
          <ErrorView title="Paiement impossible" message={error} onRetry={load} />
          <Button label="Scanner un autre QR" kind="outline" onPress={() => router.replace("/pay/scan" as any)} />
        </>
      ) : !view ? (
        <SkeletonRows rows={3} />
      ) : isStatic && chosen === null ? (
        <Rise>
          <Card pad={22} style={{ alignItems: "center", gap: 6 }}>
            <ShopAvatar shopId={view.merchant.shopId} version={view.merchant.logoVersion} name={view.merchant.businessName} size={64} />
            <UText v="heading" align="center" numberOfLines={2}>{view.merchant.businessName}</UText>
            {!!(view.merchant.category || view.merchant.city) && (
              <UText v="caption" tone="muted" align="center">{[view.merchant.category, view.merchant.city].filter(Boolean).join(" · ")}</UText>
            )}
          </Card>
          <View style={{ height: 16 }} />
          <Card pad={20}>
            <AmountInput label="Montant à payer" value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} autoFocus />
          </Card>
          <Notice tone="info" icon="information-circle-outline" style={{ marginTop: 14 }}>
            Saisissez le montant demandé par le commerçant. Vous confirmerez ensuite avec votre code secret.
          </Notice>
        </Rise>
      ) : isStatic && checkoutView ? (
        <PayCheckout key={checkoutView.id} view={checkoutView} onPay={(pin) => api.payQr(payload, pin, chosen!)} onFinish={finish} />
      ) : (
        <PayCheckout view={view} onPay={(pin) => api.payQr(payload, pin)} onFinish={finish} />
      )}
    </Screen>
  );
}
