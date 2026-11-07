// apps/direct-transfair-mobile/app/merchant/payouts.tsx
// =========================================================
// RETRAITS DU MARCHAND v2.0 — page entièrement reprise
// ✅ v2.0 : • carte « solde » en dégradé (devise = celle du COMPTE, plus jamais un « EUR » avec un numéro Orange guinéen) ;
//           • destinations en cartes sélectionnables (Orange Money / virement) avec numéro masqué ;
//           • montants rapides (25 % · 50 % · 75 % · Tout) ; récapitulatif clair (frais, vous recevez, délai) ;
//           • états explicites : Orange non disponible pour la devise, numéro à corriger, aucune destination, retraits suspendus ;
//           • historique en cartes avec pastille d'état.
// COMPTES SÉPARÉS (v1.1) : le solde retirable est celui du COMMERCE (portefeuille marchand), jamais celui du compte client.
// Chaque retrait demande le code secret. Le montant est débité tout de suite ; s'il est refusé, il est remboursé en totalité.
// Après un changement de destination, les retraits sont suspendus quelques heures (sécurité).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { useLoader } from "../../components/wallet/useLoader";
import { Ionicons } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { AmountInput, Button, Card, EmptyView, ErrorView, NavBar, Notice, Pill, Screen, SectionHeader, SkeletonRows, UText, useUI } from "../../components/ui";
import {
  PAYOUT_METHOD_LABEL, PAYOUT_STATUS_LABEL, PAYOUT_STATUS_TONE, PinPrompt, Rise, apiProblem, money, shortDateTime,
} from "../../components/merchant/merchantUi";
import { decimalsFor, parseAmount, roundTo, toInputText } from "../../utils/amount";
import { accountCurrencyForCountry, isOrangeMoneyCurrency, ORANGE_NOT_AVAILABLE_TEXT } from "../../services/orangeRules";

type Method = "ORANGE_MONEY" | "BANK_TRANSFER";

const QUICK: { label: string; ratio: number }[] = [
  { label: "25 %", ratio: 0.25 },
  { label: "50 %", ratio: 0.5 },
  { label: "75 %", ratio: 0.75 },
  { label: "Tout", ratio: 1 },
];

export default function PayoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { C, R } = useUI();
  const [method, setMethod] = useState<Method | null>(null);
  const [amountText, setAmountText] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "pos" | "danger" | "warn"; text: string } | null>(null);

  const { data, status, error, refreshing, reload, refresh } = useLoader(async () => {
    const [me, payouts, summary] = await Promise.all([api.getMerchantMe(), api.listMerchantPayouts(1), api.getMerchantSummary().catch(() => null)]);
    return { me, payouts: payouts.data, wallets: summary?.wallets ?? [] };
  });

  const header = <NavBar onBack={() => router.back()} title="Retirer mes gains" />;
  const payoutsList = data?.payouts;

  const history = useMemo(() => payoutsList ?? [], [payoutsList]);

  if (status === "loading") return <Screen header={header}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? "Erreur"} message={error?.message ?? "Chargement impossible."} onRetry={reload} /></Screen>;
  }
  const { me, wallets } = data;
  const profile = me.profile;
  if (!me.isMerchant || !profile) {
    return <Screen header={header}><Notice tone="warn">Activez d'abord votre espace marchand.</Notice></Screen>;
  }

  // La devise est celle du COMPTE (pays d'ouverture) : on ne se fie plus à une devise « par défaut » du profil.
  const currency = me.currency ?? wallets[0]?.currency ?? accountCurrencyForCountry(user?.country);
  const wallet = wallets.find((w) => w.currency === currency) ?? wallets[0];
  const balance = wallet?.available ?? 0;
  const reserved = wallet?.reserved ?? 0;
  const decimals = decimalsFor(currency);
  const orangeAllowed = me.orangeMoneyAllowed ?? isOrangeMoneyCurrency(currency);
  const methods = me.availablePayoutMethods;
  const chosen: Method | null = method && methods.includes(method) ? method : methods[0] ?? null;
  const amount = roundTo(parseAmount(amountText), decimals);
  const minPayout = me.settings.minPayout?.[currency];
  const feePct = me.settings.payoutFeePct ?? 0;
  const fee = roundTo((amount * feePct) / 100, decimals);
  const lockedUntil = profile.payoutLockedUntil && new Date(profile.payoutLockedUntil).getTime() > Date.now() ? profile.payoutLockedUntil : null;
  const suspended = profile.status === "SUSPENDED";

  const amountError =
    amount > balance ? "Montant supérieur à votre solde disponible." :
    amountText && minPayout && amount < minPayout ? `Retrait minimum : ${money(minPayout, currency)}.` : null;
  const canSend = !!chosen && amount > 0 && !amountError && pin.length === 6 && !lockedUntil && !suspended && !busy;

  const destinationLabel = (m: Method) => (m === "ORANGE_MONEY" ? profile.orangeMoneyMasked : profile.bank?.ibanMasked ?? "");

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

  const goSettings = () => router.push("/merchant/settings" as any);

  // Explication quand aucune destination n'est utilisable.
  const noDestination = (() => {
    if (methods.length > 0) return null;
    if (me.orangeNeedsUpdate) {
      return { text: "Le numéro Orange Money enregistré ne correspond pas à la devise de votre compte. Corrigez-le pour pouvoir retirer vos gains.", action: "Corriger mon numéro" };
    }
    if (!orangeAllowed) {
      return { text: `${ORANGE_NOT_AVAILABLE_TEXT(currency)}`, action: "Ajouter mon IBAN" };
    }
    return { text: "Aucune destination de retrait n'est disponible pour le moment.", action: "Ajouter une destination" };
  })();

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refresh}>
      {feedback && <Notice tone={feedback.tone} style={{ marginBottom: 14 }}>{feedback.text}</Notice>}
      {suspended && <Notice tone="danger" title="Compte suspendu" style={{ marginBottom: 14 }}>Les retraits sont bloqués tant que votre espace marchand est suspendu.</Notice>}
      {lockedUntil && (
        <Notice tone="warn" title="Retraits suspendus par sécurité" style={{ marginBottom: 14 }}>
          Vous avez changé votre destination de retrait. Les retraits reprennent le {shortDateTime(lockedUntil)}.
        </Notice>
      )}

      {/* ── Carte solde ── */}
      <Rise>
        <LinearGradient colors={[C.dark, C.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { borderRadius: R.lg }]}>
          <View style={st.heroTop}>
            <View style={st.heroIcon}>
              <Ionicons name={"storefront-outline" as any} size={18} color={C.darkInk} />
            </View>
            <Text style={[st.heroLabel, { color: C.darkInk }]} numberOfLines={1}>{profile.businessName}</Text>
            <View style={st.curPill}><Text style={[st.curTxt, { color: C.darkInk }]}>{currency}</Text></View>
          </View>
          <Text style={[st.heroCaption, { color: C.darkInk }]}>Disponible au retrait</Text>
          <Text style={[st.heroAmount, { color: C.darkInk }]} numberOfLines={1} adjustsFontSizeToFit>{money(balance, currency)}</Text>
          {reserved > 0 && <Text style={[st.heroSub, { color: C.darkInk }]}>{money(reserved, currency)} en cours de traitement</Text>}
        </LinearGradient>
      </Rise>

      {noDestination ? (
        <Rise delay={80}>
          <Notice tone="warn" style={{ marginTop: 16 }} action={noDestination.action} onAction={goSettings}>{noDestination.text}</Notice>
        </Rise>
      ) : (
        <>
          {/* ── Destination ── */}
          <Rise delay={80}>
            <SectionHeader title="Verser sur" />
            <View style={{ gap: 10 }}>
              {methods.map((m) => {
                const on = chosen === m;
                return (
                  <TouchableOpacity
                    key={m}
                    activeOpacity={0.85}
                    onPress={() => setMethod(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    testID={`payout-method-${m}`}
                    style={[st.dest, { borderRadius: R.md, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accentSoft : C.surface }]}
                  >
                    <View style={[st.destIcon, { backgroundColor: on ? C.accent : C.beige }]}>
                      <Ionicons name={(m === "ORANGE_MONEY" ? "phone-portrait-outline" : "business-outline") as any} size={20} color={on ? "#FFFFFF" : C.ink} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <UText v="bodyStrong" numberOfLines={1}>{PAYOUT_METHOD_LABEL[m] ?? m}</UText>
                      <UText v="caption" tone="muted" numberOfLines={1}>{destinationLabel(m)}</UText>
                    </View>
                    <Ionicons name={(on ? "checkmark-circle" : "ellipse-outline") as any} size={22} color={on ? C.accent : C.lineStrong} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={goSettings} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 10 }}>
              <Text style={{ color: C.accentDeep, fontWeight: "700", fontSize: 13 }}>Modifier ma destination</Text>
            </TouchableOpacity>
            {!orangeAllowed && <UText v="caption" tone="muted" style={{ marginTop: 6 }}>Orange Money n'est pas proposé pour un compte en {currency}.</UText>}
          </Rise>

          {/* ── Montant ── */}
          <Rise delay={140}>
            <SectionHeader title="Montant" />
            <Card pad={20}>
              <AmountInput label="Montant à retirer" value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} />
              <View style={st.quickRow}>
                {QUICK.map((q) => {
                  const v = roundTo(balance * q.ratio, decimals);
                  const active = amount > 0 && Math.abs(amount - v) < 10 ** -decimals;
                  return (
                    <TouchableOpacity
                      key={q.label}
                      activeOpacity={0.8}
                      disabled={balance <= 0}
                      onPress={() => setAmountText(toInputText(v, decimals))}
                      style={[st.quick, { borderRadius: R.pill, borderColor: active ? C.dark : C.line, backgroundColor: active ? C.dark : C.surface, opacity: balance <= 0 ? 0.45 : 1 }]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? C.darkInk : C.dark }}>{q.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {amount > 0 && !amountError && (
                <View style={[st.recap, { backgroundColor: C.field, borderRadius: R.md }]}>
                  <RecapLine label="Montant demandé" value={money(amount, currency)} />
                  <RecapLine label={feePct > 0 ? `Frais (${feePct} %)` : "Frais"} value={feePct > 0 ? `− ${money(fee, currency)}` : "Aucun"} />
                  <View style={[st.sep, { backgroundColor: C.line }]} />
                  <RecapLine label="Vous recevez" value={money(amount - fee, currency)} strong />
                </View>
              )}
              {!!minPayout && <UText v="caption" tone="muted" style={{ marginTop: 10 }}>Retrait minimum : {money(minPayout, currency)}</UText>}
            </Card>
          </Rise>

          {/* ── Confirmation ── */}
          <Rise delay={200}>
            <SectionHeader title="Confirmer" />
            <Card pad={20}>
              <PinPrompt value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label="Code secret pour confirmer" />
              <Button label="Demander le retrait" icon="arrow-up-circle-outline" disabled={!canSend} loading={busy} onPress={send} testID="payout-send" />
            </Card>
          </Rise>
        </>
      )}

      {/* ── Historique ── */}
      <SectionHeader title="Mes retraits" />
      {history.length === 0 ? (
        <EmptyView icon="cash-outline" title="Aucun retrait" message="Vos demandes de retrait apparaîtront ici." />
      ) : history.map((p) => (
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

function RecapLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={st.recapLine}>
      <UText v={strong ? "bodyStrong" : "body"} tone={strong ? undefined : "muted"}>{label}</UText>
      <UText v="bodyStrong">{value}</UText>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { padding: 22, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  heroIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroLabel: { flex: 1, fontSize: 14, fontWeight: "700", opacity: 0.95 },
  curPill: { paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  curTxt: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  heroCaption: { fontSize: 13, opacity: 0.75 },
  heroAmount: { fontSize: 36, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  heroSub: { fontSize: 12.5, opacity: 0.75, marginTop: 8 },
  dest: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderWidth: 1.5 },
  destIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  quick: { paddingHorizontal: 16, height: 36, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  recap: { marginTop: 16, padding: 14, gap: 8 },
  recapLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sep: { height: StyleSheet.hairlineWidth },
});
