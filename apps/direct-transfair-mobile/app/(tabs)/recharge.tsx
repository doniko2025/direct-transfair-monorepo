// apps/direct-transfair-mobile/app/(tabs)/recharge.tsx
// =========================================================
// ✅ v3.1 : PALETTE ALLÉGÉE — bandeau de solde et carte bancaire à la couleur de l'app (plus de bleu / violet) ; Orange Money = orange, Sendwave = jaune
//    (texte noir ou blanc choisi selon la teinte) ; solde à 34 (taille de référence de l'accueil) ; chips et marges resserrés.
// ✅ phase 7 : URL Sendwave lue dans services/platformConfig.ts. Logique de recharge (y compris simulée) inchangée.
// RECHARGE WALLET v3.0 — page redessinée (logique métier STRICTEMENT inchangée : mêmes appels API, même polling, même validation) :
//   • bandeau solde en dégradé aux couleurs du moyen choisi, avec aperçu « après la recharge » en direct ;
//   • choix du moyen en trois grosses tuiles animées (Carte · Orange Money · Sendwave) à la place des onglets ;
//   • montants rapides en grille (plus de défilement coupé), bouton « Recharger 50 000 GNF » qui rappelle le montant ;
//   • carte bancaire : aperçu visuel de la carte qui se remplit pendant la saisie ; Orange Money / Sendwave : étapes en 3 temps ;
//   • apparition animée à chaque changement de moyen.
// RECHARGE WALLET v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE THÈME CLAIR — fond crème, grand montant, onglets de méthode
//    soulignés, champs arrondis et bouton pilule pleine largeur ; toutes les
//    couleurs viennent de la couleur de marque du tenant (components/ui/theme).
//    Typographie système (plus de Georgia/serif). LOGIQUE MÉTIER INCHANGÉE
//    (mêmes appels API, même polling Orange Money, même validation).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v1.2 : WHITE-LABEL — les couleurs vertes écrites en dur suivent la
//    couleur de marque du tenant. Aucune logique métier touchée.
// ✅ v1.1 :
//    - Orange Money : ajout d'un champ "Numéro Orange Money" (compte
//      débité), désormais obligatoire pour soumettre — voir
//      RechargeByMobileMoneyDto côté backend.
//    - Sendwave : ajout d'un bouton "Ouvrir Sendwave" (Linking) vers
//      https://www.sendwave.com, en attendant une vraie intégration
//      in-app (accords opérateur en cours).
// =========================================================
// - Carte : mock backend (succès immédiat).
// - Orange Money : auto-poll du statut (~20s) — le mock backend
//   simule un succès après ~2s (voir orange-money.service.ts).
// - Sendwave : pas de résolution automatique — bouton "Vérifier"
//   manuel, en attendant la confirmation admin (accords opérateur
//   en cours de négociation).
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Linking, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { getSendwaveUrl } from "../../services/platformConfig";
import { useT } from "../../providers/I18nProvider";
import { tr, getLocale } from "../../i18n/runtime";
import type { MessageKey } from "../../i18n/catalog";
import {
  AmountInput, Button, Card, Field, NavBar, Notice, Screen, UText, useUI,
} from "../../components/ui";
import { Ionicons } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { TintCard, alpha, shade } from "../../components/ui/Tint";
import { Rise } from "../../components/merchant/merchantUi";
import { formatInternationalInput } from "../../utils/phone";
import { inkOn } from "../../components/ui/theme";
import { userCurrency } from "../../utils/currency";

const SENDWAVE_URL = getSendwaveUrl(); // ✅ phase 7 : modifiable (EXPO_PUBLIC_SENDWAVE_URL)

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

const QUICK_AMOUNTS: Record<string, number[]> = {
  XOF: [5_000, 10_000, 25_000, 50_000, 100_000],
  GNF: [50_000, 100_000, 200_000, 500_000, 1_000_000],
  EUR: [10, 20, 50, 100, 200],
  USD: [10, 20, 50, 100, 200],
  GBP: [10, 20, 50, 100, 200],
};

function formatCardNumber(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

type Method = "CARD" | "ORANGE_MONEY" | "SENDWAVE";

// Couleurs : la carte suit la couleur de l'app (hue = null → C.accent) ; Orange Money = orange, Sendwave = jaune (leurs couleurs de marque). Plus de bleu ni de violet.
const ORANGE = "#FF7900";
const SENDWAVE_YELLOW = "#FFC400";
const METHODS: Array<{ key: Method; label: MessageKey | null; name?: string; icon: string; hue: string | null }> = [
  { key: "CARD", label: "rc.card", icon: "card-outline", hue: null },
  { key: "ORANGE_MONEY", label: null, name: "Orange Money", icon: "phone-portrait-outline", hue: ORANGE },
  { key: "SENDWAVE", label: null, name: "Sendwave", icon: "swap-horizontal-outline", hue: SENDWAVE_YELLOW },
];

/** Tuile d'un moyen de recharge : pleine couleur quand elle est choisie, ressort au toucher. */
function MethodTile({ icon, label, hue, on, onPress }: { icon: string; label: string; hue: string; on: boolean; onPress: () => void }) {
  const { C } = useUI();
  const fg = inkOn(hue);   // texte lisible sur la couleur du moyen (noir sur le jaune, blanc sur l'orange)
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [on, lift]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  return (
    <Animated.View style={{ flex: 1, minWidth: 0, transform: [{ scale }, { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label}>
        <View style={{ height: 88, borderRadius: 22, overflow: "hidden", borderWidth: 1.5, borderColor: on ? hue : C.line, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 4,
          ...(on ? { shadowColor: hue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 } : null) }}>
          {on && <LinearGradient colors={[hue, shade(hue, 0.12)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: on ? alpha(fg, 0.16) : alpha(hue, 0.16), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon as any} size={19} color={on ? fg : C.ink} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12.5, fontWeight: "800", color: on ? fg : C.text, maxWidth: "92%" }}>{label}</Text>
          {on && <View style={{ position: "absolute", top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: alpha(fg, 0.2), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={"checkmark" as any} size={12} color={fg} />
          </View>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Montant rapide : pastille pleine quand elle correspond au montant saisi. */
function QuickAmount({ label, active, hue, onPress }: { label: string; active: boolean; hue: string; onPress: () => void }) {
  const { C } = useUI();
  const fg = inkOn(hue);
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={{ width: "31.5%", flexGrow: 1, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.94)} onPressOut={() => to(1)} accessibilityRole="button">
        <View style={{ height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: active ? hue : C.lineStrong, backgroundColor: active ? hue : C.field }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14, fontWeight: "800", color: active ? fg : C.text, maxWidth: "90%" }}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Aperçu de la carte bancaire : se remplit pendant la saisie (numéro, titulaire, expiration). */
function CardPreview({ number, name, expiry, holderPh }: { number: string; name: string; expiry: string; holderPh: string }) {
  const { C } = useUI();
  const fg = inkOn(C.accent);
  const digits = number.replace(/\s/g, "");
  const brand = digits.startsWith("4") ? "VISA" : /^(5[1-5]|2[2-7])/.test(digits) ? "MASTERCARD" : "";
  const groups = [0, 1, 2, 3].map((i) => {
    const g = digits.slice(i * 4, i * 4 + 4);
    return g.padEnd(4, "•");
  });
  return (
    <View style={{ borderRadius: 22, overflow: "hidden", shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
      <LinearGradient colors={[shade(C.accent, 0.35), C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: "absolute", right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: alpha(fg, 0.1) }} />
      <View pointerEvents="none" style={{ position: "absolute", right: 40, bottom: -70, width: 130, height: 130, borderRadius: 65, backgroundColor: alpha(fg, 0.07) }} />
      <View style={{ padding: 18, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 40, height: 30, borderRadius: 7, backgroundColor: alpha(fg, 0.28) }} />
          <Text style={{ color: fg, fontWeight: "800", fontSize: 13, letterSpacing: 1, fontStyle: "italic" }}>{brand}</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: fg, fontSize: 20, fontWeight: "700", letterSpacing: 2.5, fontVariant: ["tabular-nums"] }}>{groups.join("  ")}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: name ? fg : alpha(fg, 0.55), fontSize: 13, fontWeight: "700", letterSpacing: 0.8 }}>{name || holderPh}</Text>
          <Text style={{ color: expiry ? fg : alpha(fg, 0.55), fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{expiry || "MM/AA"}</Text>
        </View>
      </View>
    </View>
  );
}

/** Étapes numérotées (Orange Money / Sendwave) : on comprend d'un coup d'œil ce qui va se passer. */
function Steps({ hue, items }: { hue: string; items: string[] }) {
  const fg = inkOn(hue);
  return (
    <View style={{ gap: 10 }}>
      {items.map((txt, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: hue, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: fg, fontSize: 12.5, fontWeight: "800" }}>{i + 1}</Text>
          </View>
          <UText v="body" style={{ flex: 1 }}>{txt}</UText>
        </View>
      ))}
    </View>
  );
}

/** Anneau qui pulse pendant l'attente de confirmation. */
function PulseRing({ hue }: { hue: string }) {
  const fg = inkOn(hue);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(hue, 0.25), opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }] }} />
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hue, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={fg} />
      </View>
    </View>
  );
}

export default function RechargeScreen() {
  const { C } = useUI();
  const t = useT();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const bannerFg = inkOn(C.accent);

  const currency = userCurrency(user);
  const quickAmounts = QUICK_AMOUNTS[currency] ?? QUICK_AMOUNTS.XOF;

  const [balance, setBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("CARD");
  const [amount, setAmount] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [momoPhone, setMomoPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ transactionId: string; method: Method } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  useEffect(() => {
    api.getMyWallets()
      .then((wallets) => {
        const w = wallets.find((x) => x.currency === currency) ?? wallets[0];
        setBalance(w ? Number(w.balance) : 0);
      })
      .catch(() => setBalance(null));
  }, [currency]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const numAmount = parseFloat(amount) || 0;
  const canSubmit =
    numAmount > 0 &&
    (method !== "CARD" ||
      (cardName.trim().length > 0 &&
        cardNumber.replace(/\s/g, "").length >= 13 &&
        cardExpiry.length === 5 &&
        cardCvv.length >= 3)) &&
    (method !== "ORANGE_MONEY" || momoPhone.trim().length >= 8);

  const resetCardForm = () => {
    setCardName(""); setCardNumber(""); setCardExpiry(""); setCardCvv("");
  };

  const handleSuccess = useCallback(async (label: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPending(null);
    await refreshUser?.();
    api.getMyWallets().then((wallets) => {
      const w = wallets.find((x) => x.currency === currency);
      if (w) setBalance(Number(w.balance));
    }).catch(() => {});
    Alert.alert(tr("rc.successTitle"), tr("rc.successMsg", { amount: label }), [
      { text: tr("rc.backDash"), onPress: () => router.back() },
    ]);
  }, [refreshUser, currency, router]);

  const pollOrangeMoney = useCallback((transactionId: string) => {
    pollAttempts.current = 0;
    pollRef.current = setInterval(async () => {
      pollAttempts.current += 1;
      try {
        const tx = await api.getRechargeStatus(transactionId);
        if (tx.status === "PAID") {
          void handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
        } else if (pollAttempts.current >= 10) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }, [handleSuccess, numAmount, currency]);

  const handleCheckSendwave = async () => {
    if (!pending) return;
    setCheckingStatus(true);
    try {
      const tx = await api.getRechargeStatus(pending.transactionId);
      if (tx.status === "PAID") {
        await handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
      } else {
        Alert.alert(t("rc.pendingTitle"), t("rc.pendingMsg"));
      }
    } catch {
      Alert.alert(t("common.error"), t("rc.checkFail"));
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleOpenSendwave = () => {
    Linking.openURL(SENDWAVE_URL).catch(() => {
      Alert.alert(tr("common.error"), tr("rc.swOpenFail"));
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (method === "CARD") {
        await api.rechargeByCard({
          amount: numAmount,
          currency,
          cardholderName: cardName.trim(),
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiry: cardExpiry,
        });
        resetCardForm();
        await handleSuccess(`${fmt(numAmount, currency)} ${currency}`);
      } else if (method === "ORANGE_MONEY") {
        const res = await api.rechargeByOrangeMoney(numAmount, currency, momoPhone.replace(/\s/g, ""));
        setPending({ transactionId: res.transactionId, method: "ORANGE_MONEY" });
        pollOrangeMoney(res.transactionId);
      } else {
        const res = await api.rechargeBySendwave(numAmount, currency);
        setPending({ transactionId: res.transactionId, method: "SENDWAVE" });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? t("rc.failed");
      Alert.alert(t("common.error"), Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const changeMethod = (m: Method) => {
    setMethod(m);
    setPending(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const meth = METHODS.find((m) => m.key === method) ?? METHODS[0];
  const hueOf = (m: { hue: string | null }) => m.hue ?? C.accent;
  const hue = hueOf(meth);
  const ctaLabel = numAmount > 0 ? `${t("rc.cta")} ${fmt(numAmount, currency)} ${currency}` : t("rc.cta");
  const userPhone = ((user as any)?.phone ?? "") as string;

  return (
    <Screen
      header={<NavBar title={t("rc.title")} onBack={() => router.back()} />}
      footer={
        <Button
          label={ctaLabel}
          icon="add-circle-outline"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit || submitting || !!pending}
        />
      }
    >
      {/* ── Bandeau solde : suit la couleur du moyen choisi, montre le solde APRÈS la recharge ── */}
      <Rise>
        <View style={{ borderRadius: 26, overflow: "hidden", marginTop: 2, shadowColor: C.accent, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
          <LinearGradient colors={[shade(C.accent, 0.35), C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ position: "absolute", right: -34, top: -44, width: 160, height: 160, borderRadius: 80, backgroundColor: alpha(bannerFg, 0.1) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 30, bottom: -60, width: 110, height: 110, borderRadius: 55, backgroundColor: alpha(bannerFg, 0.06) }} />
          <View style={{ padding: 16, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: alpha(bannerFg, 0.2), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={"wallet-outline" as any} size={14} color={bannerFg} />
              </View>
              <Text style={{ color: bannerFg, opacity: 0.8, fontSize: 12, fontWeight: "700" }}>{t("rc.balance")}</Text>
            </View>
            <Text style={{ color: bannerFg, fontSize: 34, fontWeight: "800", letterSpacing: -0.8 }} numberOfLines={1} adjustsFontSizeToFit>
              {balance === null ? "—" : `${fmt(balance, currency)} ${currency}`}
            </Text>
            {numAmount > 0 && balance !== null && (
              <Rise key={String(numAmount > 0)}>
                <View style={{ alignSelf: "flex-start", marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: alpha(bannerFg, 0.18), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Ionicons name={"trending-up-outline" as any} size={14} color={bannerFg} />
                  <Text style={{ color: bannerFg, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{t("rc.after", { amount: `${fmt(balance + numAmount, currency)} ${currency}` })}</Text>
                </View>
              </Rise>
            )}
          </View>
        </View>
      </Rise>

      {/* ── Moyen de recharge ── */}
      <Rise delay={70}>
        <UText v="overline" tone="muted" style={{ marginTop: 20, marginBottom: 10 }}>{t("rc.pickMethod")}</UText>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
          {METHODS.map((m) => (
            <MethodTile key={m.key} icon={m.icon} hue={hueOf(m)} label={m.label ? t(m.label) : (m.name ?? "")} on={method === m.key} onPress={() => changeMethod(m.key)} />
          ))}
        </View>
      </Rise>

      {/* ── Contenu du moyen choisi (réapparaît en douceur à chaque changement) ── */}
      <Rise key={method}>
        {(method === "ORANGE_MONEY" || method === "SENDWAVE") && (
          <Notice tone="warn" style={{ marginTop: 16 }}>
            {method === "ORANGE_MONEY" ? t("rc.omNote") : t("rc.swNote")}
          </Notice>
        )}

        {/* Montant + montants rapides */}
        <Card pad={16} style={{ marginTop: 16 }}>
          <AmountInput compact label={t("rc.amountLabel")} value={amount} onChangeText={setAmount} currency={currency} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {quickAmounts.map((v) => (
              <QuickAmount key={v} hue={hue} label={new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(v)} active={numAmount === v} onPress={() => setAmount(String(v))} />
            ))}
          </View>
        </Card>

        {/* Orange Money : compte débité */}
        {method === "ORANGE_MONEY" && (
          <TintCard hue={hue} mark="phone-portrait-outline" pad={16} style={{ marginTop: 14 }}>
            <Steps hue={hue} items={[t("rc.omStep1"), t("rc.omStep2"), t("rc.omStep3")]} />
            <View style={{ height: 14 }} />
            <Field
              label={t("rc.omNumber")}
              icon="call-outline"
              value={momoPhone}
              onChangeText={setMomoPhone}
              formatInput={formatInternationalInput}
              placeholder="+224 6XX XX XX XX"
              keyboardType="phone-pad"
              hint={t("rc.omHint")}
            />
            {!!userPhone && momoPhone.replace(/\s/g, "") !== userPhone && (
              <Pressable onPress={() => setMomoPhone(userPhone)} accessibilityRole="button" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: alpha(hue, 0.15), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: -4 }}>
                <Ionicons name={"person-outline" as any} size={14} color={C.text} />
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: "700" }}>{t("rc.useMyNumber")}</Text>
              </Pressable>
            )}
          </TintCard>
        )}

        {/* Sendwave : paiement externe pour le moment */}
        {method === "SENDWAVE" && (
          <TintCard hue={hue} mark="swap-horizontal-outline" pad={16} style={{ marginTop: 14 }}>
            <Steps hue={hue} items={[t("rc.swStep1"), t("rc.swStep2"), t("rc.swStep3")]} />
            <View style={{ height: 14 }} />
            <Button label={t("rc.openSw")} kind="outline" icon="open-outline" onPress={handleOpenSendwave} />
          </TintCard>
        )}

        {/* Carte bancaire */}
        {method === "CARD" && (
          <View style={{ marginTop: 16, gap: 14 }}>
            <CardPreview number={cardNumber} name={cardName} expiry={cardExpiry} holderPh={t("rc.holderPh")} />
            <Card pad={16}>
              <Field
                label={t("rc.holder")}
                value={cardName}
                onChangeText={setCardName}
                placeholder={t("rc.holderPh")}
                autoCapitalize="characters"
              />
              <Field
                label={t("rc.cardNumber")}
                icon="card-outline"
                value={cardNumber}
                onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                placeholder="0000 0000 0000 0000"
                keyboardType="numeric"
                maxLength={19}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("rc.expiry")}
                    value={cardExpiry}
                    onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                    placeholder={t("rc.expiryPh")}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="CVV"
                    value={cardCvv}
                    onChangeText={(t) => setCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••"
                    keyboardType="numeric"
                    maxLength={4}
                    secure
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={"lock-closed-outline" as any} size={14} color={C.muted} />
                <UText v="caption" tone="muted" style={{ flex: 1 }}>{t("rc.cvvNote")}</UText>
              </View>
            </Card>
          </View>
        )}
      </Rise>

      {/* Recharge en attente (Orange Money / Sendwave) */}
      {pending && (
        <Rise>
          <TintCard hue={hue} pad={20} style={{ marginTop: 18 }}>
            <View style={{ alignItems: "center", gap: 10 }}>
              {pending.method === "ORANGE_MONEY" ? (
                <>
                  <PulseRing hue={hue} />
                  <UText v="bodyStrong" align="center">{t("rc.omWaiting")}</UText>
                </>
              ) : (
                <>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: alpha(hue, 0.18), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={"time-outline" as any} size={26} color={hue} />
                  </View>
                  <UText v="bodyStrong" align="center">{t("rc.swWaiting")}</UText>
                  <UText v="caption" tone="muted" align="center">
                    {t("rc.reference", { ref: pending.transactionId.slice(0, 8).toUpperCase() })}
                  </UText>
                  <Button label={t("rc.checkStatus")} kind="soft" small full={false} loading={checkingStatus} onPress={handleCheckSendwave} />
                </>
              )}
            </View>
          </TintCard>
        </Rise>
      )}
    </Screen>
  );
}
