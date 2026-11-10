// apps/direct-transfair-mobile/app/topup.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon).
// =========================================================
// TOP-UP SCREEN v7.0 — Direct Transf'air
// ✅ v7.0 : RECHARGE RÉELLEMENT BRANCHÉE SUR LE SERVEUR
//    - Avant : après 2 s d'attente, l'écran appelait api.updateProfile({ balance: ancien + montant }).
//      Le serveur ignore ce champ (liste blanche du profil) : l'écran affichait « Paiement réussi »
//      sans que le solde bouge. Désormais : POST /payments/recharge/card ou /orange-money,
//      puis suivi du statut (Orange Money) et rafraîchissement du profil.
//    - Les moyens proposés viennent de la société (GET /payments/recharge/options, réglage « Recharge »
//      de l'admin). Aucun moyen ouvert → message clair au lieu d'un formulaire inutilisable.
//    - Devise = celle du compte (plus de « EUR » écrit en dur).
//    - Le CVV n'est plus saisi : le serveur ne l'a jamais accepté (PCI-DSS). Un vrai prestataire de
//      paiement fournira ses propres champs sécurisés.
//    - Bandeau « mode simulation » tant qu'aucun prestataire réel n'est branché.
// ✅ v6.0 : thème clair, onglets Carte / Orange Money, aperçu de carte aux couleurs de la société,
//    paramètre d'URL ?method=orange|card respecté.
// ✅ v5.1 : WHITE-LABEL — couleurs suivent la couleur de marque du tenant.
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "../components/ui/Icon";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";
import { AmountInput, Button, Chip, Field, IconButton, Notice, Screen, Tabs, UText, useUI } from "../components/ui";
import { useT } from "../providers/I18nProvider";
import { tr, getLocale } from "../i18n/runtime";

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

type UiMethod = "CARD" | "OM";
/** Correspondance entre l'onglet de l'écran et le code du moyen côté serveur. */
const SERVER_CODE: Record<UiMethod, string> = { CARD: "CARD", OM: "ORANGE_MONEY" };

const POLL_EVERY_MS = 1500;
const POLL_MAX = 10;

/** Message d'erreur serveur lisible (même schéma que les autres écrans). */
function errMsg(e: any, fallback: string): string {
  const m = e?.response?.data?.message;
  const txt = Array.isArray(m) ? m[0] : m;
  return typeof txt === "string" && txt ? txt : fallback;
}

function fmt(n: number): string {
  try { return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function TopUpScreen() {
  const { C, R } = useUI();
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const { user, refreshUser } = useAuth();
  const currency = String((user as any)?.currency ?? (user as any)?.primaryCurrency ?? "EUR");

  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const wantedOm = String(params?.method ?? "").toLowerCase().startsWith("orange");
  const [method, setMethod] = useState<UiMethod>(wantedOm ? "OM" : "CARD");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Moyens ouverts par la société : null = chargement, [] = aucun
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await api.getRechargeOptions();
        if (!alive) return;
        setEnabled(o.methods);
        setBlocked(o.blocked);
        setOptionsError(null);
      } catch (e) {
        if (!alive) return;
        setEnabled([]);
        setOptionsError(errMsg(e, tr("topup.loadFail")));
      }
    })();
    return () => { alive = false; };
  }, []);

  const tabItems = ([
    { key: "CARD" as UiMethod, label: t("rc.card"), icon: "card-outline" as const },
    { key: "OM" as UiMethod, label: "Orange Money", icon: "phone-portrait-outline" as const },
  ]).filter((it) => (enabled ?? []).includes(SERVER_CODE[it.key]));

  // Si l'onglet courant n'est pas ouvert par la société, bascule sur le premier disponible.
  useEffect(() => {
    if (tabItems.length > 0 && !tabItems.some((it) => it.key === method)) setMethod(tabItems[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const numAmount = parseFloat(amount.replace(",", ".")) || 0;
  const cardDigits = cardNumber.replace(/\D/g, "");
  const canPay =
    tabItems.length > 0 &&
    numAmount >= 1 &&
    (method === "CARD"
      ? cardHolder.trim().length >= 2 && cardDigits.length >= 13 && /^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)
      : mobileNumber.replace(/\D/g, "").length >= 9);

  const handleClose = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); };

  const onExpiryChange = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  };

  const handleTopUp = () => {
    if (!canPay) { Alert.alert(t("topup.missing"), t("topup.fillAll")); return; }
    Alert.alert(t("common.confirm"), t(method === "CARD" ? "topup.confirmCard" : "topup.confirmOm", { amount: `${fmt(numAmount)} ${currency}` }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("topup.payBtn"), onPress: () => void processPayment() },
    ]);
  };

  /** Orange Money : le crédit arrive après validation de l'opérateur → on interroge le statut. */
  const waitForSettlement = async (transactionId: string): Promise<"PAID" | "FAILED" | "PENDING"> => {
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_EVERY_MS);
      if (!mounted.current) return "PENDING";
      const tx = await api.getRechargeStatus(transactionId);
      const st = String((tx as any)?.status ?? "").toUpperCase();
      if (st === "PAID") return "PAID";
      if (st === "FAILED" || st === "CANCELLED") return "FAILED";
    }
    return "PENDING";
  };

  const processPayment = async () => {
    setLoading(true);
    try {
      let outcome: "PAID" | "FAILED" | "PENDING";
      if (method === "CARD") {
        const tx = await api.rechargeByCard({
          amount: numAmount,
          currency,
          cardholderName: cardHolder.trim(),
          cardNumber: cardDigits,
          expiry: cardExpiry,
        });
        const st = String((tx as any)?.status ?? "").toUpperCase();
        outcome = st === "PAID" ? "PAID" : st === "FAILED" || st === "CANCELLED" ? "FAILED" : "PENDING";
      } else {
        const started = await api.rechargeByOrangeMoney(numAmount, currency, mobileNumber.trim());
        outcome = await waitForSettlement(started.transactionId);
      }

      await refreshUser();
      if (!mounted.current) return;

      if (outcome === "PAID") {
        Alert.alert(t("topup.doneTitle"), t("topup.doneMsg", { amount: `${fmt(numAmount)} ${currency}` }), [
          { text: t("topup.great"), onPress: handleClose },
        ]);
      } else if (outcome === "PENDING") {
        Alert.alert(
          t("topup.pendingTitle"),
          t("topup.pendingMsg"),
          [{ text: "OK", onPress: handleClose }],
        );
      } else {
        Alert.alert(t("topup.refusedTitle"), t("topup.refusedMsg"));
      }
    } catch (e) {
      Alert.alert(t("common.error"), errMsg(e, t("topup.failed")));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const previewNumber = cardDigits.length > 0 ? cardDigits.replace(/(.{4})/g, "$1 ").trim() : "•••• •••• •••• ••••";

  return (
    <Screen
      header={
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, minHeight: 64, gap: 12 }}>
          <UText v="heading" style={{ flex: 1 }}>{t("topup.title")}</UText>
          <IconButton icon="close" label={t("common.close")} onPress={handleClose} />
        </View>
      }
      footer={
        tabItems.length > 0 ? (
          <Button
            label={t(method === "CARD" ? "topup.payCard" : "topup.payOm", { amount: numAmount > 0 ? `${fmt(numAmount)} ${currency}` : "" }).replace(/\s+/g, " ").trim()}
            icon={method === "CARD" ? "card-outline" : "phone-portrait-outline"}
            onPress={handleTopUp}
            loading={loading}
            disabled={!canPay || loading}
          />
        ) : undefined
      }
    >
      {enabled === null ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : tabItems.length === 0 ? (
        <Notice tone="info" icon="information-circle-outline">
          {optionsError
            ? optionsError
            : blocked
              ? t("topup.notYet")
              : t("topup.noMethod")}
        </Notice>
      ) : (
        <>
          {/* Montant */}
          <AmountInput label={t("topup.amountLabel")} value={amount} onChangeText={setAmount} currency={currency} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {QUICK_AMOUNTS.map((v) => (
              <Chip key={v} label={`${v}`} active={numAmount === v} onPress={() => setAmount(String(v))} />
            ))}
          </ScrollView>

          {/* Méthode (un seul moyen ouvert → pas d'onglets) */}
          {tabItems.length > 1 ? (
            <Tabs style={{ marginTop: 26, marginBottom: 22 }} items={tabItems} value={method} onChange={setMethod} />
          ) : (
            <View style={{ height: 22 }} />
          )}

          <Notice tone="info" icon="information-circle-outline">
            {t("topup.simulation")}
          </Notice>
          <View style={{ height: 16 }} />

          {method === "CARD" ? (
            <>
              {/* Aperçu de la carte, aux couleurs de la société */}
              <View style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: 20, height: 150, justifyContent: "space-between", marginBottom: 22 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Ionicons name="card-outline" size={24} color={C.accentInk} style={{ opacity: 0.75 }} />
                  <View style={{ width: 36, height: 26, borderRadius: 5, backgroundColor: C.accentInk, opacity: 0.25 }} />
                </View>
                <UText v="subheading" color={C.accentInk} style={{ letterSpacing: 2 }} numberOfLines={1}>{previewNumber}</UText>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <UText v="label" color={C.accentInk} style={{ textTransform: "uppercase", flex: 1, opacity: 0.85 }} numberOfLines={1}>
                    {cardHolder || t("topup.holderName")}
                  </UText>
                  <UText v="label" color={C.accentInk} style={{ opacity: 0.85 }}>{cardExpiry || t("rc.expiryPh")}</UText>
                </View>
              </View>

              <Field label={t("topup.holderName")} value={cardHolder} onChangeText={setCardHolder} placeholder={t("topup.holderPh")} autoCapitalize="words" />
              <Field
                label={t("rc.cardNumber")}
                icon="card-outline"
                value={cardNumber}
                onChangeText={(v: string) => setCardNumber(v.replace(/\D/g, "").slice(0, 19))}
                placeholder="0000 0000 0000 0000"
                keyboardType="numeric"
                maxLength={19}
              />
              <Field label={t("rc.expiry")} value={cardExpiry} onChangeText={onExpiryChange} placeholder={t("rc.expiryPh")} keyboardType="numeric" maxLength={5} />
            </>
          ) : (
            <>
              <Field
                label={t("rc.omNumber")}
                icon="call-outline"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder={t("topup.fullNumber")}
                keyboardType="phone-pad"
              />
              <Notice tone="info" icon="information-circle-outline">
                {t("topup.omSms")}
              </Notice>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
