// apps/direct-transfair-mobile/app/(tabs)/recharge.tsx
// =========================================================
// RECHARGE WALLET v1.1 — Direct Transf'air
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
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const SENDWAVE_URL = "https://www.sendwave.com";

// ─── Design tokens (propres à cet écran, cf. convention par écran) ──
const C = {
  green: "#17A45F",
  greenPale: "#E8FAF2",
  heroFrom: "#0A0F0D",
  heroTo: "#123324",
  heroMuted: "rgba(255,255,255,0.55)",
  pageBg: "#F5F5F5",
  white: "#FFFFFF",
  ink: "#1C1C1E",
  inkMid: "#3C3C43",
  inkSoft: "#8E8E93",
  border: "#E5E5EA",
  amber: "#F59E0B",
  amberBg: "#FFFBEB",
  r: { sm: 10, md: 14, lg: 18, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
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

const METHODS: Array<{ key: Method; label: string; icon: string }> = [
  { key: "CARD", label: "Carte", icon: "card-outline" },
  { key: "ORANGE_MONEY", label: "Orange Money", icon: "phone-portrait-outline" },
  { key: "SENDWAVE", label: "Sendwave", icon: "swap-horizontal-outline" },
];

export default function RechargeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const currency = ((user as any)?.primaryCurrency ?? "XOF") as string;
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
    Alert.alert("✅ Recharge réussie", `${label} a bien été créditée sur votre wallet.`, [
      { text: "Retour au tableau de bord", onPress: () => router.back() },
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
        Alert.alert("En attente", "Ce paiement n'a pas encore été confirmé. Réessayez un peu plus tard.");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de vérifier le statut pour le moment.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleOpenSendwave = () => {
    Linking.openURL(SENDWAVE_URL).catch(() => {
      Alert.alert("Erreur", "Impossible d'ouvrir Sendwave pour le moment.");
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
        const res = await api.rechargeByOrangeMoney(numAmount, currency, momoPhone.trim());
        setPending({ transactionId: res.transactionId, method: "ORANGE_MONEY" });
        pollOrangeMoney(res.transactionId);
      } else {
        const res = await api.rechargeBySendwave(numAmount, currency);
        setPending({ transactionId: res.transactionId, method: "SENDWAVE" });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "La recharge a échoué. Réessayez.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.heroFrom} />

      <LinearGradient colors={[C.heroFrom, C.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={[s.heroTitle, { fontFamily: C.font.sans }]}>Recharger mon wallet</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={[s.heroLabel, { fontFamily: C.font.sans }]}>SOLDE ACTUEL</Text>
        <Text style={[s.heroBalance, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
          {balance === null ? "—" : `${fmt(balance, currency)} ${currency}`}
        </Text>
      </LinearGradient>

      <ScrollView style={s.sheet} contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Sélecteur de méthode ── */}
        <Text style={[s.sectionLbl, { fontFamily: C.font.sans }]}>MÉTHODE</Text>
        <View style={s.methodRow}>
          {METHODS.map((m) => {
            const active = method === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[s.methodPill, active && { backgroundColor: C.greenPale, borderColor: C.green }]}
                onPress={() => { setMethod(m.key); setPending(null); if (pollRef.current) clearInterval(pollRef.current); }}
                activeOpacity={0.85}
              >
                <Ionicons name={m.icon as any} size={18} color={active ? C.green : C.inkSoft} />
                <Text style={[s.methodTxt, { color: active ? C.green : C.inkMid, fontFamily: C.font.sans }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(method === "ORANGE_MONEY" || method === "SENDWAVE") && (
          <View style={s.noticeBox}>
            <Ionicons name="information-circle-outline" size={14} color={C.amber} />
            <Text style={[s.noticeTxt, { fontFamily: C.font.sans }]}>
              {method === "ORANGE_MONEY"
                ? "Intégration Orange Money en cours de finalisation avec l'opérateur. Le paiement est simulé pour le moment."
                : "Intégration Sendwave en cours de finalisation avec l'opérateur. Après paiement, la confirmation peut prendre un peu de temps."}
            </Text>
          </View>
        )}

        {/* ── Numéro Orange Money (compte débité) ── */}
        {method === "ORANGE_MONEY" && (
          <View style={{ marginTop: 14 }}>
            <Text style={[s.sectionLbl, { fontFamily: C.font.sans }]}>NUMÉRO ORANGE MONEY</Text>
            <TextInput
              style={[s.input, { fontFamily: C.font.sans, marginTop: 8 }]}
              value={momoPhone}
              onChangeText={setMomoPhone}
              placeholder="+224 6XX XX XX XX"
              placeholderTextColor={C.inkSoft}
              keyboardType="phone-pad"
            />
            <Text style={[s.secureTxt, { fontFamily: C.font.sans, marginTop: 6 }]}>
              Le montant sera débité de ce compte Orange Money.
            </Text>
          </View>
        )}

        {/* ── Lien vers Sendwave (paiement externe pour le moment) ── */}
        {method === "SENDWAVE" && (
          <TouchableOpacity style={s.sendwaveLinkBtn} onPress={handleOpenSendwave} activeOpacity={0.85}>
            <Ionicons name="open-outline" size={16} color={C.green} />
            <Text style={[s.sendwaveLinkTxt, { fontFamily: C.font.sans }]}>Ouvrir Sendwave pour payer</Text>
          </TouchableOpacity>
        )}

        {/* ── Montant ── */}
        <Text style={[s.sectionLbl, { fontFamily: C.font.sans, marginTop: 18 }]}>MONTANT</Text>
        <View style={s.amountBox}>
          <TextInput
            style={[s.amountInput, { fontFamily: C.font.serif }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={C.inkSoft}
            keyboardType="numeric"
          />
          <Text style={[s.amountCur, { fontFamily: C.font.mono }]}>{currency}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
          {quickAmounts.map((v) => {
            const active = numAmount === v;
            return (
              <TouchableOpacity
                key={v}
                style={[s.quickPill, active && { backgroundColor: C.greenPale, borderColor: C.green }]}
                onPress={() => setAmount(String(v))}
              >
                <Text style={[s.quickTxt, { color: active ? C.green : C.inkSoft, fontFamily: C.font.mono }]}>
                  {fmt(v, currency)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Détails carte ── */}
        {method === "CARD" && (
          <View style={{ marginTop: 18 }}>
            <Text style={[s.sectionLbl, { fontFamily: C.font.sans }]}>CARTE BANCAIRE</Text>
            <TextInput
              style={[s.input, { fontFamily: C.font.sans, textTransform: "uppercase", marginTop: 8 }]}
              value={cardName}
              onChangeText={setCardName}
              placeholder="NOM PRÉNOM"
              placeholderTextColor={C.inkSoft}
              autoCapitalize="characters"
            />
            <TextInput
              style={[s.input, { fontFamily: C.font.mono, marginTop: 10 }]}
              value={cardNumber}
              onChangeText={(t) => setCardNumber(formatCardNumber(t))}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor={C.inkSoft}
              keyboardType="numeric"
              maxLength={19}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TextInput
                style={[s.input, { flex: 1, fontFamily: C.font.mono }]}
                value={cardExpiry}
                onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                placeholder="MM/AA"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                maxLength={5}
              />
              <TextInput
                style={[s.input, { flex: 1, fontFamily: C.font.mono }]}
                value={cardCvv}
                onChangeText={(t) => setCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                placeholder="CVV"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
            <View style={s.secureNote}>
              <Ionicons name="lock-closed" size={11} color={C.inkSoft} />
              <Text style={[s.secureTxt, { fontFamily: C.font.sans }]}>Le CVV n'est jamais stocké.</Text>
            </View>
          </View>
        )}

        {/* ── État recharge en attente (OM / Sendwave) ── */}
        {pending && (
          <View style={s.pendingBox}>
            {pending.method === "ORANGE_MONEY" ? (
              <>
                <ActivityIndicator color={C.green} />
                <Text style={[s.pendingTxt, { fontFamily: C.font.sans }]}>
                  Confirmation Orange Money en cours…
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={18} color={C.amber} />
                <Text style={[s.pendingTxt, { fontFamily: C.font.sans }]}>
                  En attente de confirmation Sendwave. Référence : {pending.transactionId.slice(0, 8).toUpperCase()}
                </Text>
                <TouchableOpacity style={s.checkBtn} onPress={handleCheckSendwave} disabled={checkingStatus}>
                  {checkingStatus
                    ? <ActivityIndicator size="small" color={C.green} />
                    : <Text style={[s.checkBtnTxt, { fontFamily: C.font.sans }]}>Vérifier le statut</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[s.cta, (!canSubmit || submitting || !!pending) && { opacity: 0.4 }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting || !!pending}
          activeOpacity={0.88}
        >
          {submitting
            ? <ActivityIndicator color={C.white} />
            : <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>RECHARGER</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0F0D" },
  hero: { paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 24 },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", justifyContent: "center", alignItems: "center" },
  heroTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  heroLabel: { color: C.heroMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  heroBalance: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: 3 },

  sheet: { flex: 1, backgroundColor: C.pageBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20 },
  body: { padding: 20 },

  sectionLbl: { fontSize: 10, fontWeight: "900", color: C.inkSoft, letterSpacing: 1, marginBottom: 8 },

  methodRow: { flexDirection: "row", gap: 8 },
  methodPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: C.r.md, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  methodTxt: { fontSize: 11, fontWeight: "700" },

  noticeBox: { flexDirection: "row", gap: 8, backgroundColor: C.amberBg, borderRadius: C.r.md, padding: 10, marginTop: 10, alignItems: "flex-start" },
  noticeTxt: { flex: 1, fontSize: 11, color: "#92400E", fontWeight: "600", lineHeight: 15 },

  sendwaveLinkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.greenPale, borderRadius: C.r.md, paddingVertical: 12, marginTop: 12, borderWidth: 1, borderColor: C.green },
  sendwaveLinkTxt: { color: C.green, fontSize: 12, fontWeight: "800" },

  amountBox: { flexDirection: "row", alignItems: "baseline", gap: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: C.r.md, paddingHorizontal: 14, paddingVertical: 12 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: "800", color: C.ink },
  amountCur: { fontSize: 12, fontWeight: "800", color: C.green },

  quickRow: { gap: 7, paddingTop: 8, paddingBottom: 2 },
  quickPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: C.r.md, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  quickTxt: { fontSize: 11, fontWeight: "800" },

  input: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: C.r.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, fontWeight: "600" },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  secureTxt: { fontSize: 10.5, color: C.inkSoft, fontWeight: "600" },

  pendingBox: { alignItems: "center", gap: 8, backgroundColor: C.white, borderRadius: C.r.md, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 18 },
  pendingTxt: { fontSize: 12, color: C.inkMid, fontWeight: "600", textAlign: "center" },
  checkBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: C.r.pill, backgroundColor: C.greenPale },
  checkBtnTxt: { color: C.green, fontSize: 11, fontWeight: "800" },

  cta: { marginTop: 22, backgroundColor: C.green, borderRadius: C.r.md, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
});