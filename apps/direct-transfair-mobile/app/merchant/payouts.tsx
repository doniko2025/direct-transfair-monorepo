// apps/direct-transfair-mobile/app/merchant/payouts.tsx
// =========================================================
// RETRAITS DU MARCHAND v1.0 — Lot 11
// Le solde est versé sur le numéro Orange Money donné à la création du compte (ou sur l'IBAN enregistré dans les
// réglages). Chaque retrait demande le code secret. Le montant est débité tout de suite ; s'il est refusé, il est
// remboursé en totalité. Après un changement de destination, les retraits sont suspendus quelques heures (sécurité).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { AmountInput, Button, Card, Chip, EmptyView, ErrorView, NavBar, Notice, Pill, Screen, SectionHeader, SkeletonRows, UText, useUI } from "../../components/ui";
import {
  PAYOUT_METHOD_LABEL, PAYOUT_STATUS_LABEL, PAYOUT_STATUS_TONE, PinPrompt, Rise, apiProblem, money, shortDateTime,
} from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo } from "../../utils/amount";

export default function PayoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { C } = useUI();
  const [method, setMethod] = useState<"ORANGE_MONEY" | "BANK_TRANSFER" | null>(null);
  const [amountText, setAmountText] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "pos" | "danger" | "warn"; text: string } | null>(null);

  const { data, status, error, refreshing, reload, refresh } = useLoader(async () => {
    const [me, payouts, wallets] = await Promise.all([api.getMerchantMe(), api.listMerchantPayouts(1), api.getMyWallets().catch(() => [])]);
    return { me, payouts: payouts.data, wallets };
  });

  if (status === "loading") return <Screen header={<NavBar onBack={() => router.back()} title="Retirer mes gains" />}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Retirer mes gains" />}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  const { me, payouts, wallets } = data;
  const profile = me.profile;
  if (!me.isMerchant || !profile) {
    return <Screen header={<NavBar onBack={() => router.back()} title="Retirer mes gains" />}><Notice tone="warn">Activez d'abord votre espace marchand.</Notice></Screen>;
  }

  const currency = user?.primaryCurrency ?? wallets[0]?.currency ?? "XOF";
  const wallet = wallets.find((w) => w.currency === currency) ?? wallets[0];
  const balance = wallet?.balance ?? 0;
  const methods = me.availablePayoutMethods;
  const chosen = method && methods.includes(method) ? method : methods[0] ?? null;
  const amount = roundTo(parseAmount(amountText), decimalsFor(currency));
  const minPayout = me.settings.minPayout?.[currency];
  const feePct = me.settings.payoutFeePct ?? 0;
  const fee = roundTo((amount * feePct) / 100, decimalsFor(currency));
  const lockedUntil = profile.payoutLockedUntil && new Date(profile.payoutLockedUntil).getTime() > Date.now() ? profile.payoutLockedUntil : null;
  const suspended = profile.status === "SUSPENDED";

  const amountError =
    amount > balance ? "Montant supérieur à votre solde." :
    amountText && minPayout && amount < minPayout ? `Retrait minimum : ${money(minPayout, currency)}.` : null;
  const canSend = !!chosen && amount > 0 && !amountError && pin.length === 6 && !lockedUntil && !suspended && !busy;

  const send = async () => {
    if (!chosen || !canSend) return;
    setBusy(true);
    setFeedback(null);
    setPinError(null);
    try {
      await api.requestMerchantPayout({ pin, amount, method: chosen, currency });
      setAmountText("");
      setPin("");
      setFeedback({ tone: "pos", text: "Demande de retrait envoyée. Vous serez prévenu par notification et par email dès qu'elle est traitée." });
      reload();
    } catch (e) {
      const pr = apiProblem(e);
      setPin("");
      if (pr.code === "PIN_INVALID" || pr.code === "PIN_LOCKED") setPinError(pr.message);
      else setFeedback({ tone: pr.code === "PAYOUT_LOCKED" ? "warn" : "danger", text: pr.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<NavBar onBack={() => router.back()} title="Retirer mes gains" />} refreshing={refreshing} onRefresh={refresh}>
      {feedback && <Notice tone={feedback.tone} style={{ marginBottom: 14 }}>{feedback.text}</Notice>}
      {suspended && <Notice tone="danger" title="Compte suspendu" style={{ marginBottom: 14 }}>Les retraits sont bloqués tant que votre espace marchand est suspendu.</Notice>}
      {lockedUntil && (
        <Notice tone="warn" title="Retraits suspendus par sécurité" style={{ marginBottom: 14 }}>
          Vous avez changé votre destination de retrait. Les retraits reprennent le {shortDateTime(lockedUntil)}.
        </Notice>
      )}

      <Rise>
        <Card pad={20}>
          <UText v="caption" tone="muted">Solde disponible</UText>
          <UText v="hero" style={{ marginTop: 4 }}>{money(balance, currency)}</UText>

          {methods.length === 0 ? (
            <Notice tone="warn" style={{ marginTop: 14 }} action="Ajouter une destination" onAction={() => router.push("/merchant/settings" as any)}>
              Aucune destination de retrait disponible.
            </Notice>
          ) : (
            <>
              <View style={{ height: 16 }} />
              <UText v="caption" tone="muted" style={{ marginBottom: 8 }}>Verser sur</UText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                {methods.map((m) => (
                  <Chip key={m} label={PAYOUT_METHOD_LABEL[m] ?? m} icon={m === "ORANGE_MONEY" ? "phone-portrait-outline" : "business-outline"} active={chosen === m} onPress={() => setMethod(m)} />
                ))}
              </View>
              {chosen && (
                <UText v="caption" tone="muted">
                  {chosen === "ORANGE_MONEY" ? `Numéro ${profile.orangeMoneyMasked}` : `IBAN ${profile.bank?.ibanMasked ?? ""}`}
                </UText>
              )}

              <View style={{ height: 16 }} />
              <AmountInput label="Montant à retirer" value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} />
              {amount > 0 && feePct > 0 && !amountError ? (
                <UText v="caption" tone="muted">Frais {money(fee, currency)} · vous recevez {money(amount - fee, currency)}</UText>
              ) : null}

              <View style={{ height: 18 }} />
              <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label="Code secret pour confirmer" />
              <Button label="Demander le retrait" icon="arrow-up-circle-outline" disabled={!canSend} loading={busy} onPress={send} testID="payout-send" />
            </>
          )}
        </Card>
      </Rise>

      <SectionHeader title="Mes retraits" />
      {payouts.length === 0 ? (
        <EmptyView icon="cash-outline" title="Aucun retrait" message="Vos demandes de retrait apparaîtront ici." />
      ) : payouts.map((p) => (
        <Card key={p.id} pad={16} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.beige, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={(p.method === "ORANGE_MONEY" ? "phone-portrait-outline" : "business-outline") as any} size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <UText v="bodyStrong" numberOfLines={1}>{PAYOUT_METHOD_LABEL[p.method] ?? p.method}</UText>
              <UText v="caption" tone="muted" numberOfLines={1}>{p.destinationLabel ?? p.destination} · {shortDateTime(p.createdAt)}</UText>
              {!!p.failureReason && <UText v="caption" tone="danger" numberOfLines={2}>{p.failureReason}</UText>}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <UText v="bodyStrong">{money(p.amount, p.currency)}</UText>
              <Pill label={PAYOUT_STATUS_LABEL[p.status]} tone={PAYOUT_STATUS_TONE[p.status]} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
