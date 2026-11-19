// apps/direct-transfair-mobile/app/merchant/payouts.tsx
// =========================================================
// RETRAITS DU MARCHAND v2.1 — page compacte et plus moderne (25 % · 50 % · 75 % · Tout sur UNE seule ligne, solde plus bas, « Modifier » dans l'en-tête)
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
import { useT } from "../../providers/I18nProvider";
import { accountCurrencyForCountry, isOrangeMoneyCurrency, ORANGE_NOT_AVAILABLE_TEXT } from "../../services/orangeRules";

type Method = "ORANGE_MONEY" | "BANK_TRANSFER";

const QUICK: { key: string; ratio: number }[] = [
  { key: "25 %", ratio: 0.25 },
  { key: "50 %", ratio: 0.5 },
  { key: "75 %", ratio: 0.75 },
  { key: "mpo.all", ratio: 1 },
];

export default function PayoutsScreen() {
  const t = useT();
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

  const header = <NavBar onBack={() => router.back()} title={t("mpo.title")} />;
  const payoutsList = data?.payouts;

  const history = useMemo(() => payoutsList ?? [], [payoutsList]);

  if (status === "loading") return <Screen header={header}><SkeletonRows rows={4} /></Screen>;
  if (status === "error" || !data) {
    return <Screen header={header}><ErrorView title={error?.title ?? t("mx.error")} message={error?.message ?? t("mx.loadFail")} onRetry={reload} /></Screen>;
  }
  const { me, wallets } = data;
  const profile = me.profile;
  if (!me.isMerchant || !profile) {
    return <Screen header={header}><Notice tone="warn">{t("mpo.activateFirst")}</Notice></Screen>;
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
    amount > balance ? t("mpo.overBalance") :
    amountText && minPayout && amount < minPayout ? t("mpo.minimum", { amount: money(minPayout, currency) }) : null;
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
      setFeedback({ tone: "pos", text: t("mpo.sent") });
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
      return { text: t("mpo.orangeMismatch"), action: t("mpo.fixNumber") };
    }
    if (!orangeAllowed) {
      return { text: `${ORANGE_NOT_AVAILABLE_TEXT(currency)}`, action: t("mpo.addIban") };
    }
    return { text: t("mpo.noDest"), action: t("mpo.addDest") };
  })();

  return (
    <Screen header={header} refreshing={refreshing} onRefresh={refresh}>
      {feedback && <Notice tone={feedback.tone} style={{ marginBottom: 14 }}>{feedback.text}</Notice>}
      {suspended && <Notice tone="danger" title={t("mpo.suspendedTitle")} style={{ marginBottom: 14 }}>{t("mpo.suspendedMsg")}</Notice>}
      {lockedUntil && (
        <Notice tone="warn" title={t("mpo.lockedTitle")} style={{ marginBottom: 14 }}>
          {t("mpo.lockedMsg", { date: shortDateTime(lockedUntil) })}
        </Notice>
      )}

      {/* ── Carte solde (compacte) ── */}
      <Rise>
        <LinearGradient colors={[C.dark, C.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { borderRadius: R.lg }]}>
          <View pointerEvents="none" style={st.heroBubbleA} />
          <View pointerEvents="none" style={st.heroBubbleB} />
          <View style={st.heroTop}>
            <View style={st.heroIcon}>
              <Ionicons name={"storefront-outline" as any} size={16} color={C.darkInk} />
            </View>
            <Text style={[st.heroLabel, { color: C.darkInk }]} numberOfLines={1}>{profile.businessName}</Text>
            <View style={st.curPill}><Text style={[st.curTxt, { color: C.darkInk }]}>{currency}</Text></View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.heroCaption, { color: C.darkInk }]}>{t("mpo.available")}</Text>
              <Text style={[st.heroAmount, { color: C.darkInk }]} numberOfLines={1} adjustsFontSizeToFit>{money(balance, currency)}</Text>
            </View>
            {reserved > 0 && (
              <View style={st.reservedPill}>
                <Ionicons name={"time-outline" as any} size={13} color={C.darkInk} />
                <Text style={[st.reservedTxt, { color: C.darkInk }]} numberOfLines={1}>{money(reserved, currency)}</Text>
              </View>
            )}
          </View>
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
            <SectionHeader title={t("mpo.payTo")} action={t("mpo.changeDest")} onAction={goSettings} style={{ marginTop: 18 }} />
            <View style={{ gap: 8 }}>
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
                      <Ionicons name={(m === "ORANGE_MONEY" ? "phone-portrait-outline" : "business-outline") as any} size={19} color={on ? C.accentInk : C.ink} />
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
            {!orangeAllowed && <UText v="caption" tone="muted" style={{ marginTop: 6 }}>{t("mpo.noOrange", { currency })}</UText>}
          </Rise>

          {/* ── Montant ── */}
          <Rise delay={140}>
            <SectionHeader title={t("mpo.amount")} style={{ marginTop: 18 }} />
            <Card pad={16}>
              <AmountInput compact label={t("mpo.amountLabel")} value={amountText} onChangeText={setAmountText} currency={currency} error={amountError} />
              <View style={st.quickRow}>
                {QUICK.map((q) => {
                  const v = roundTo(balance * q.ratio, decimals);
                  const active = amount > 0 && Math.abs(amount - v) < 10 ** -decimals;
                  return (
                    <TouchableOpacity
                      key={q.key}
                      activeOpacity={0.8}
                      disabled={balance <= 0}
                      onPress={() => setAmountText(toInputText(v, decimals))}
                      style={[st.quick, { borderRadius: R.pill, borderColor: active ? C.dark : C.lineStrong, backgroundColor: active ? C.dark : C.field, opacity: balance <= 0 ? 0.45 : 1 }]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? C.darkInk : C.dark }}>{q.key.startsWith("mpo.") ? t(q.key as any) : q.key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {amount > 0 && !amountError && (
                <View style={[st.recap, { backgroundColor: C.field, borderRadius: R.md }]}>
                  <RecapLine label={t("mpo.requested")} value={money(amount, currency)} />
                  <RecapLine label={feePct > 0 ? t("mpo.feePct", { pct: feePct }) : t("mpo.feeLabel")} value={feePct > 0 ? `− ${money(fee, currency)}` : t("mpo.feeNone")} />
                  <View style={[st.sep, { backgroundColor: C.line }]} />
                  <RecapLine label={t("mpo.youReceive")} value={money(amount - fee, currency)} strong />
                </View>
              )}
              {!!minPayout && <UText v="caption" tone="muted" style={{ marginTop: 8 }}>{t("mpo.minimum", { amount: money(minPayout, currency) })}</UText>}
            </Card>
          </Rise>

          {/* ── Confirmation ── */}
          <Rise delay={200}>
            <SectionHeader title={t("mpo.confirm")} style={{ marginTop: 18 }} />
            <Card pad={16}>
              <PinPrompt dense value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={pinError} label={t("mpo.pinLabel")} />
              <Button label={t("mpo.request")} icon="arrow-up-circle-outline" disabled={!canSend} loading={busy} onPress={send} testID="payout-send" />
            </Card>
          </Rise>
        </>
      )}

      {/* ── Historique ── */}
      <SectionHeader title={t("mpo.history")} style={{ marginTop: 22 }} />
      {history.length === 0 ? (
        <EmptyView icon="cash-outline" title={t("mpo.none")} message={t("mpo.noneMsg")} />
      ) : history.map((p) => (
        <Card key={p.id} pad={14} style={{ marginBottom: 8 }}>
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
  hero: { padding: 16, overflow: "hidden" },
  heroBubbleA: { position: "absolute", right: -30, top: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.10)" },
  heroBubbleB: { position: "absolute", right: 40, bottom: -50, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.07)" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  heroIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroLabel: { flex: 1, fontSize: 13.5, fontWeight: "700", opacity: 0.95 },
  curPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  curTxt: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
  heroCaption: { fontSize: 12.5, opacity: 0.75 },
  heroAmount: { fontSize: 30, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  reservedPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", maxWidth: "48%" },
  reservedTxt: { fontSize: 12, fontWeight: "700" },
  dest: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1.5 },
  destIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  // 25 % · 50 % · 75 % · Tout : quatre pastilles de même largeur sur UNE seule ligne
  quickRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  quick: { flex: 1, minWidth: 0, height: 38, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  recap: { marginTop: 12, padding: 12, gap: 6 },
  recapLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sep: { height: StyleSheet.hairlineWidth },
});
