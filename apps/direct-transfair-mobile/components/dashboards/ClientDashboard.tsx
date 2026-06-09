// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD v7.0 — Direct Transf'air
// ✅ v6.1 : fix montant entrant converti, suppression doublon CTA
// ✅ v7.0 :
//    - Héro compact : paddingBottom 28→14, balCard 20→14, amount 34→26
//    - Arc concave (react-native-svg) remplace borderRadius 32
//    - Fix : code JSX tronqué entre les 2 documents reconstruit complet
//    - Fix : Animated.View séparé du style s.hero (arc inclus)
//    - Thème vert intact
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated,
  ActivityIndicator, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CONCAVE_H = 70;

// ─── Design System ──────────────────────────────────────
const C = {
  green:        "#059669",
  greenDark:    "#047857",
  greenLight:   "#F0FDF4",
  greenBorder:  "#A7F3D0",
  greenPale:    "#ECFDF5",
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",
  pageBg:       "#F0FDF8",
  white:        "#FFFFFF",
  cardBorder:   "#D1FAE5",
  ink:          "#0D2B1F",
  inkMid:       "#1F5C3A",
  inkSoft:      "#6B9E85",
  red:          "#EF4444",
  redBg:        "#FEF2F2",
  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",
  blueBorder:   "#BFDBFE",
  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",
  purple:       "#8B5CF6",
  purpleBg:     "#F5F3FF",
  slate:        "#64748B",
  slateLight:   "#F1F5F9",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers ────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}
function fmtDate(d: string): string {
  const date = new Date(d), today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yest.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

const TX_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  PAID:       { color: C.green,  bg: C.greenPale,  label: "Payé" },
  VALIDATED:  { color: C.green,  bg: C.greenPale,  label: "Validé" },
  PENDING:    { color: C.amber,  bg: C.amberBg,    label: "En cours" },
  PROCESSING: { color: C.blue,   bg: C.blueBg,     label: "Traitement" },
  CANCELLED:  { color: C.slate,  bg: C.slateLight, label: "Annulé" },
  FAILED:     { color: C.red,    bg: C.redBg,      label: "Échoué" },
};

const AVATAR_PALETTES = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColors(name: string) {
  return AVATAR_PALETTES[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTES.length];
}

// ─── Arc concave vert ─────────────────────────────────────
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill={C.pageBg} />
      <Path d={d} fill={C.green} />
      <Path d={bd} fill="none" stroke="rgba(5,150,105,0.22)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Quick Contact Chip ──────────────────────────────────
function ContactChip({ name, phone, onPress }: { name: string; phone?: string; onPress: () => void }) {
  const initials = (name || "?").split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
  const pal = avatarColors(name || "?");
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={qc.chip} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
      >
        <View style={[qc.avatar, { backgroundColor: pal.bg }]}>
          <Text style={[qc.initials, { color: pal.text, fontFamily: C.font.serif }]}>{initials}</Text>
        </View>
        <Text style={[qc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name.split(" ")[0]}</Text>
        <View style={qc.sendIcon}>
          <Ionicons name="paper-plane" size={10} color={C.green} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const qc = StyleSheet.create({
  chip:     { alignItems: "center", gap: 5, width: 68 },
  avatar:   { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.04)" },
  initials: { fontSize: 18, fontWeight: "900" },
  name:     { fontSize: 11, fontWeight: "700", color: C.ink, textAlign: "center" },
  sendIcon: { position: "absolute", bottom: 24, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.greenPale, borderWidth: 1.5, borderColor: C.greenBorder, justifyContent: "center", alignItems: "center" },
});

// ─── Action Pill ─────────────────────────────────────────
function ActionPill({ icon, label, color, bg, onPress }: {
  icon: string; label: string; color: string; bg: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, alignItems: "center", gap: 7 }}>
      <TouchableOpacity
        style={[ap.circle, { backgroundColor: bg }]} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start()}
      >
        <Ionicons name={icon as any} size={21} color={color} />
      </TouchableOpacity>
      <Text style={[ap.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </Animated.View>
  );
}
const ap = StyleSheet.create({
  circle: { width: 54, height: 54, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  label:  { fontSize: 11, fontWeight: "700", color: C.inkSoft, textAlign: "center" },
});

// ─── Transaction Row ─────────────────────────────────────
function TxRow({ tx, userId }: { tx: any; userId?: string }) {
  const isOut = tx.senderId === userId;
  const accent = isOut ? C.red : C.green;
  const hasConversion = !isOut && tx.targetCurrency && tx.targetCurrency !== tx.currency && toNum(tx.receivedAmount) > 0;
  const displayAmount:   number = hasConversion ? toNum(tx.receivedAmount) : toNum(tx.amount);
  const displayCurrency: string = hasConversion ? (tx.targetCurrency as string) : (tx.currency as string);
  const name = isOut
    ? (tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "Bénéficiaire")
    : (tx.sender?.firstName ? `${tx.sender.firstName} ${tx.sender.lastName ?? ""}`.trim() : "Expéditeur");
  const st  = TX_STATUS[tx.status] ?? { color: C.slate, bg: C.slateLight, label: tx.status };
  const pal = avatarColors(name);
  return (
    <View style={tr.row}>
      <View style={[tr.avatar, { backgroundColor: pal.bg }]}>
        <Text style={[tr.avatarTxt, { color: pal.text, fontFamily: C.font.serif }]}>
          {(name[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tr.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{name}</Text>
        <View style={tr.meta}>
          <Text style={[tr.date, { fontFamily: C.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
          <View style={[tr.pill, { backgroundColor: st.bg }]}>
            <View style={[tr.dot, { backgroundColor: st.color }]} />
            <Text style={[tr.pillTxt, { color: st.color, fontFamily: C.font.sans }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[tr.amount, { color: accent, fontFamily: C.font.serif }]}>
          {isOut ? "−" : "+"}{fmt(displayAmount, displayCurrency)}
        </Text>
        <Text style={[tr.currency, { fontFamily: C.font.mono }]}>{displayCurrency}</Text>
      </View>
    </View>
  );
}
const tr = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F0FDF4" },
  avatar:    { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 16, fontWeight: "900" },
  name:      { fontSize: 14, fontWeight: "700", color: C.ink, marginBottom: 3 },
  meta:      { flexDirection: "row", alignItems: "center", gap: 7 },
  date:      { fontSize: 11, color: C.inkSoft, fontWeight: "600" },
  pill:      { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: C.r.pill },
  dot:       { width: 4, height: 4, borderRadius: C.r.pill },
  pillTxt:   { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  amount:    { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  currency:  { fontSize: 9, color: C.inkSoft, fontWeight: "700", marginTop: 2 },
});

// ─── Main ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [refreshing,  setRefreshing]  = useState(false);
  const [txs,         setTxs]         = useState<any[]>([]);
  const [loadingTxs,  setLoadingTxs]  = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [eurXofRate,  setEurXofRate]  = useState<number | null>(null);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.firstName ?? "Client";

  const rawCountry      = ((user as any)?.country ?? "").trim().toUpperCase().substring(0, 2);
  const primaryCurrency = (user as any)?.primaryCurrency || COUNTRY_CURRENCY[rawCountry] || "XOF";
  const wallets         = (user as any)?.wallets ?? [];
  const mainWallet      = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance          = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance  = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  // Stats mensuelles
  const monthTxs  = txs.filter((t) => isThisMonth(t.createdAt));
  const monthSent = monthTxs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);
  const monthRecv = monthTxs
    .filter((t) => (t.recipientId === user?.id || (t.senderId !== user?.id && !t.beneficiaryId)) && t.status === "PAID")
    .reduce((acc, t) => {
      const hasConv = t.targetCurrency && t.targetCurrency !== t.currency && toNum(t.receivedAmount) > 0;
      return acc + (hasConv ? toNum(t.receivedAmount) : toNum(t.amount));
    }, 0);

  // Contacts récents
  const recentContacts = (() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; phone?: string; beneficiaryId?: string }> = [];
    for (const tx of txs) {
      if (tx.senderId !== user?.id) continue;
      const name  = tx.beneficiary?.fullName ?? tx.recipient?.firstName;
      const phone = tx.beneficiary?.phone ?? tx.recipient?.phone;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, phone, beneficiaryId: tx.beneficiaryId });
      if (result.length >= 4) break;
    }
    return result;
  })();

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [, rawTxs, rates] = await Promise.allSettled([
        refreshUser(),
        api.getTransactions(),
        api.getExchangeRates(),
      ]);
      if (rawTxs.status === "fulfilled") {
        const safe = Array.isArray(rawTxs.value) ? rawTxs.value : [];
        setTxs(safe.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 10));
      }
      if (rates.status === "fulfilled" && Array.isArray(rates.value)) {
        const pair = rates.value.find((r: any) => r.pair === "EUR/XOF" || r.pair === "EUR_XOF");
        if (pair?.rate) setEurXofRate(Number(pair.rate));
      }
    } catch {}
    finally { setRefreshing(false); setLoadingTxs(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.stagger(60, [
      Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 3 }),
    ]).start();
  }, [loadData]));

  const recentTxs = txs.slice(0, 5);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ══ HÉRO + ARC CONCAVE animés ensemble ══ */}
      <Animated.View style={{
        opacity: heroAnim,
        transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }}>
        {/* ── Héro compact vert ── */}
        <View style={s.hero}>
          <View style={s.glow1} />
          <View style={s.glow2} />

          {/* Top bar */}
          <View style={s.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greeting, { fontFamily: C.font.sans }]}>Bon retour 👋</Text>
              <Text style={[s.heroName, { fontFamily: C.font.serif }]} numberOfLines={1}>{firstName}</Text>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/notifications")}>
              <Ionicons name="notifications-outline" size={17} color={C.white} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
              <Text style={[s.avatarTxt, { fontFamily: C.font.serif }]}>{(firstName[0] ?? "C").toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {/* Balance card compact */}
          <View style={s.balCard}>
            <View style={s.balTop}>
              <View style={{ flex: 1 }}>
                <View style={s.balLabelRow}>
                  <Text style={[s.balLabel, { fontFamily: C.font.sans }]}>
                    SOLDE DISPONIBLE · {primaryCurrency}
                  </Text>
                  <TouchableOpacity onPress={() => setShowBalance(!showBalance)} hitSlop={8}>
                    <Ionicons
                      name={showBalance ? "eye-outline" : "eye-off-outline"}
                      size={14} color={C.inkSoft}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[s.balAmount, { fontFamily: C.font.serif }]}
                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                  {showBalance ? fmt(availableBalance, primaryCurrency) : "••••••"}
                </Text>
                <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{primaryCurrency}</Text>
              </View>
              <View style={s.onlinePill}>
                <View style={s.onlineDot} />
                <Text style={[s.onlineTxt, { fontFamily: C.font.sans }]}>En ligne</Text>
              </View>
            </View>
            {balance > 0 && (
              <>
                <View style={s.progBg}>
                  <View style={[s.progFill, { width: `${Math.min((availableBalance / balance) * 100, 100)}%` as any }]} />
                </View>
                <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                  Disponible <Text style={s.balFootVal}>{fmt(availableBalance, primaryCurrency)} {primaryCurrency}</Text>
                  {reservedBalance > 0 && (
                    <Text style={[s.balFootVal, { color: C.amber }]}>  ·  Réservé {fmt(reservedBalance, primaryCurrency)}</Text>
                  )}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ── Arc concave vert → pageBg ── */}
        <HeroConcave />
      </Animated.View>

      {/* ══ BODY ══ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.green} />
        }
      >
        <Animated.View style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>

          {/* ── CTA principal ── */}
          <TouchableOpacity
            style={s.mainCta}
            onPress={() => router.push("/(tabs)/send")}
            activeOpacity={0.88}
          >
            <View style={s.mainCtaLeft}>
              <View style={s.mainCtaIconBox}>
                <Ionicons name="paper-plane-outline" size={20} color={C.white} />
              </View>
              <View>
                <Text style={[s.mainCtaTitle, { fontFamily: C.font.sans }]}>Envoyer de l'argent</Text>
                <Text style={[s.mainCtaSub, { fontFamily: C.font.sans }]}>Wallet · Cash · Virement · 0 frais wallet</Text>
              </View>
            </View>
            <View style={s.mainCtaArrow}>
              <Ionicons name="arrow-forward" size={16} color={C.green} />
            </View>
          </TouchableOpacity>

          {/* ── Actions secondaires ── */}
          <View style={s.actionsRow}>
            <ActionPill icon="people-outline"  label="Contacts"  color={C.green}  bg={C.greenPale} onPress={() => router.push("/(tabs)/beneficiaries")} />
            <ActionPill icon="repeat-outline"  label="Taux"      color={C.blue}   bg={C.blueBg}    onPress={() => router.push("/(tabs)/rates")} />
            <ActionPill icon="qr-code-outline" label="QR Code"   color={C.amber}  bg={C.amberBg}   onPress={() => router.push("/(tabs)/qr")} />
            {/* ✅ Fix v7.0 : ligne complète (code tronqué dans les docs) */}
            <ActionPill icon="time-outline"    label="Historique" color={C.purple} bg={C.purpleBg} onPress={() => router.push("/(tabs)/transactions")} />
          </View>

          {/* ── Stats du mois ── */}
          <View style={s.statsRow}>
            {/* Envoyé ce mois */}
            <View style={[s.statCard, { borderLeftColor: C.red }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: C.redBg }]}>
                  <Ionicons name="arrow-up-outline" size={13} color={C.red} />
                </View>
                <Text style={[s.statLabel, { fontFamily: C.font.sans }]}>ENVOYÉ CE MOIS</Text>
              </View>
              <Text style={[s.statAmount, { color: C.red, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {fmt(monthSent, primaryCurrency)}
              </Text>
              <Text style={[s.statCur, { fontFamily: C.font.mono }]}>{primaryCurrency}</Text>
            </View>

            {/* Reçu ce mois */}
            <View style={[s.statCard, { borderLeftColor: C.green }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: C.greenPale }]}>
                  <Ionicons name="arrow-down-outline" size={13} color={C.green} />
                </View>
                <Text style={[s.statLabel, { fontFamily: C.font.sans }]}>REÇU CE MOIS</Text>
              </View>
              <Text style={[s.statAmount, { color: C.green, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {fmt(monthRecv, primaryCurrency)}
              </Text>
              <Text style={[s.statCur, { fontFamily: C.font.mono }]}>{primaryCurrency}</Text>
            </View>

            {/* Taux EUR → XOF */}
            <View style={[s.statCard, { borderLeftColor: C.blue }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: C.blueBg }]}>
                  <Ionicons name="swap-horizontal-outline" size={13} color={C.blue} />
                </View>
                <Text style={[s.statLabel, { fontFamily: C.font.sans }]}>EUR → XOF</Text>
              </View>
              <Text style={[s.statAmount, { color: C.ink, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {eurXofRate ? fmt(eurXofRate, "XOF") : "—"}
              </Text>
              {eurXofRate && (
                <Text style={[s.statCur, { fontFamily: C.font.mono }]}>XOF</Text>
              )}
            </View>
          </View>

          {/* ── Envoi rapide ── */}
          {recentContacts.length > 0 && (
            <>
              <View style={s.secRow}>
                <View style={[s.secDot, { backgroundColor: C.green }]} />
                <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>ENVOI RAPIDE</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/beneficiaries")} hitSlop={8}>
                  <Text style={[s.seeAllTxt, { fontFamily: C.font.sans }]}>Tous →</Text>
                </TouchableOpacity>
              </View>
              <View style={s.quickSendCard}>
                <View style={s.quickSendRow}>
                  {recentContacts.map((c, i) => (
                    <ContactChip
                      key={`${c.name}-${i}`}
                      name={c.name}
                      phone={c.phone}
                      onPress={() => router.push({
                        pathname: "/(tabs)/send",
                        params: c.beneficiaryId
                          ? { beneficiaryId: c.beneficiaryId }
                          : { phone: c.phone ?? "" },
                      })}
                    />
                  ))}
                  <TouchableOpacity
                    style={qc2.newBtn}
                    onPress={() => router.push("/(tabs)/beneficiaries/create")}
                    activeOpacity={0.8}
                  >
                    <View style={qc2.newCircle}>
                      <Ionicons name="add" size={22} color={C.green} />
                    </View>
                    <Text style={[qc2.newTxt, { fontFamily: C.font.sans }]}>Nouveau</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ── Transactions récentes ── */}
          <View style={[s.secRow, { marginTop: recentContacts.length > 0 ? 8 : 0 }]}>
            <View style={[s.secDot, { backgroundColor: C.blue }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>TRANSACTIONS RÉCENTES</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")} hitSlop={8}>
              <Text style={[s.seeAllTxt, { fontFamily: C.font.sans }]}>Voir tout →</Text>
            </TouchableOpacity>
          </View>

          <View style={s.txCard}>
            {loadingTxs && !refreshing ? (
              <ActivityIndicator color={C.green} style={{ marginVertical: 28 }} />
            ) : recentTxs.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="swap-horizontal-outline" size={28} color={C.inkSoft} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: C.font.sans }]}>Aucune transaction</Text>
                <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                  Vos envois et réceptions apparaîtront ici
                </Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/send")}>
                  <Ionicons name="paper-plane-outline" size={14} color={C.green} />
                  <Text style={[s.emptyBtnTxt, { fontFamily: C.font.sans }]}>Faire un transfert</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {recentTxs.map((tx) => <TxRow key={tx.id} tx={tx} userId={user?.id} />)}
                <TouchableOpacity style={s.viewMore} onPress={() => router.push("/(tabs)/transactions")}>
                  <Text style={[s.viewMoreTxt, { fontFamily: C.font.sans }]}>Voir toutes les transactions</Text>
                  <Ionicons name="arrow-forward" size={13} color={C.green} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Badge sécurité */}
          <View style={s.secBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={C.green} />
            <Text style={[s.secBadgeTxt, { fontFamily: C.font.sans }]}>
              Compte sécurisé · Direct Transf'air™
            </Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const qc2 = StyleSheet.create({
  newBtn:    { alignItems: "center", gap: 5, width: 68 },
  newCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.greenPale, borderWidth: 1.5, borderColor: C.greenBorder, borderStyle: "dashed" as any, justifyContent: "center", alignItems: "center" },
  newTxt:    { fontSize: 11, fontWeight: "700", color: C.inkSoft, textAlign: "center" },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ── Héro compact v7 — sans borderRadius (arc concave) ──
  hero: {
    backgroundColor: C.green,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 14, // ✅ réduit (48→44)
    paddingBottom: 14,   // ✅ réduit (28→14)
    overflow:      "hidden",
    zIndex:        10,
  },
  glow1: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.heroGlow, top: -80,  right: -60 },
  glow2: { position: "absolute", width: 100, height: 100, borderRadius: 50,  backgroundColor: C.heroGlow, bottom: 20, left: -30 },

  topBar:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 10 }, // ✅ réduit (22→14)
  greeting:  { color: C.heroDim, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  heroName:  { color: C.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 }, // ✅ réduit (24→22)
  iconBtn:   { width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  notifDot:  { position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: C.r.pill, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.green },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.heroGlass, borderWidth: 1.5, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  avatarTxt: { color: C.white, fontSize: 16, fontWeight: "800" },

  // ── Balance card compact ──
  balCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 14, // ✅ réduit (20→14)
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  balTop:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  balLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  balLabel:    { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, textTransform: "uppercase" },
  balAmount:   { fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.8 }, // ✅ réduit (34→26)
  balCur:      { fontSize: 12, fontWeight: "800", color: C.green, marginTop: 2 },
  onlinePill:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, borderRadius: C.r.pill, paddingHorizontal: 10, paddingVertical: 5 },
  onlineDot:   { width: 6, height: 6, borderRadius: C.r.pill, backgroundColor: C.green },
  onlineTxt:   { color: C.greenDark, fontSize: 10, fontWeight: "700" },
  progBg:      { height: 4, backgroundColor: C.greenLight, borderRadius: C.r.pill, overflow: "hidden", marginBottom: 6 },
  progFill:    { height: 4, backgroundColor: C.green, borderRadius: C.r.pill },
  balFootLbl:  { fontSize: 10, fontWeight: "700", color: C.inkSoft },
  balFootVal:  { color: C.green, fontWeight: "900" },

  // ── CTA principal ──
  mainCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.greenDark, borderRadius: C.r.lg, padding: 16, marginBottom: 14,
    shadowColor: C.green, shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  mainCtaLeft:    { flexDirection: "row", alignItems: "center", gap: 13, flex: 1 },
  mainCtaIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" },
  mainCtaTitle:   { color: C.white, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  mainCtaSub:     { color: "rgba(255,255,255,0.60)", fontSize: 10, fontWeight: "600" },
  mainCtaArrow:   { width: 34, height: 34, borderRadius: 11, backgroundColor: C.white, justifyContent: "center", alignItems: "center" },

  // ── Body ──
  body: { paddingHorizontal: 18, paddingTop: 18 },

  actionsRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingVertical: 18, paddingHorizontal: 12, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },

  statsRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: C.white, borderRadius: C.r.md,
    padding: 11, borderWidth: 1, borderColor: C.cardBorder, borderLeftWidth: 3,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1,
  },
  statTop:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  statIcon:  { width: 20, height: 20, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  statLabel: { fontSize: 7, fontWeight: "900", color: C.inkSoft, letterSpacing: 0.6, flex: 1 },
  statAmount:{ fontSize: 15, fontWeight: "800", color: C.ink },
  statCur:   { fontSize: 8, fontWeight: "900", color: C.inkSoft, marginTop: 2 },

  secRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  secDot:    { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl:    { flex: 1, fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
  seeAllTxt: { fontSize: 12, fontWeight: "700", color: C.green },

  quickSendCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 16, paddingBottom: 20, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  quickSendRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  txCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  empty:        { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyIconBox: { width: 56, height: 56, borderRadius: 17, backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: C.ink, fontSize: 15, fontWeight: "700" },
  emptySub:     { color: C.inkSoft, fontSize: 12, fontWeight: "600", textAlign: "center" },
  emptyBtn:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: C.greenLight, borderRadius: C.r.md, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.greenBorder },
  emptyBtnTxt:  { color: C.green, fontWeight: "800", fontSize: 13 },
  viewMore:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.greenLight, marginTop: 4 },
  viewMoreTxt:  { color: C.green, fontSize: 13, fontWeight: "700" },

  secBadge:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  secBadgeTxt: { color: C.inkSoft, fontSize: 11, fontWeight: "600" },
});