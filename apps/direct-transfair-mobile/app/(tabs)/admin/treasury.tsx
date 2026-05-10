// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
// =========================================================
// TREASURY SCREEN v6.0 — Direct Transf'air
// Design: Thème CLAIR premium — même langage que SuperAdminDashboard
// ✅ Fond F0F4FF, cartes blanches ombrées, police Trebuchet MS
// ✅ Hero parapluie (coins concaves) en haut de la page
// ✅ CFA au lieu de Fr pour XOF
// ✅ FlatList optimisée avec effet Parallax Fintech
// ✅ Animations anti-lag & React.memo
// ✅ Micro-interactions (press scale)
// ✅ Modal de recharge complète en thème clair
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Alert, Platform, Modal, TextInput, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView, Animated, Dimensions, Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens — Thème Clair Premium ─────────────────
const T = {
  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderLt: "#F1F5F9",

  ink:      "#0F172A",
  inkMid:   "#475569",
  inkMuted: "#94A3B8",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  white:    "#FFFFFF",

  currencies: {
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", bg: "#FEF3C7", name: "Franc CFA",       shadow: "#D9770640" },
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", bg: "#EEF2FF", name: "Euro",            shadow: "#1956F040" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", bg: "#DCFCE7", name: "Dollar US",       shadow: "#16A34A40" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", bg: "#FEE2E2", name: "Franc Guinéen",   shadow: "#DC262640" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", bg: "#EDE9FE", name: "Livre Sterling",  shadow: "#7C3AED40" },
  },

  radius: { sm: 10, md: 14, lg: 16, xl: 22, xxl: 28 },

  font: {
    display:  Platform.select({ ios: "Georgia",      android: "serif",              default: "serif" }),
    sans:     Platform.select({ ios: "Trebuchet MS",  android: "sans-serif-condensed", default: "sans-serif" }),
    subtitle: Platform.select({ ios: "Trebuchet MS",  android: "sans-serif-light",     default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New",   android: "monospace",            default: "monospace" }),
  },
};

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
const CARD_W = SW - 48;

// Hero parapluie
const HERO_BR = 56;

// ─── Helpers ─────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d, maximumFractionDigits: d,
    }).format(n);
  } catch { return n.toFixed(d); }
}

// ─── Currency Card ────────────────────────────────────────
const CurrencyCard = React.memo(function CurrencyCard({
  currency, balance, reserved,
}: {
  currency: keyof typeof T.currencies;
  balance: number;
  reserved: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={["#FFFFFF", "#F8FAFF"]}
          style={[ccS.card, { width: CARD_W, borderTopColor: cfg.color }]}
        >
          {/* Bande colorée en haut */}
          <View style={[ccS.topBar, { backgroundColor: cfg.color }]} />

          {/* En-tête */}
          <View style={ccS.topRow}>
            <View style={[ccS.flagBox, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }]}>
              <Text style={{ fontSize: 24 }}>{cfg.flag}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>
                {cfg.code}
              </Text>
              <Text style={[ccS.curName, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>
                {cfg.name}
              </Text>
            </View>
            <View style={[ccS.trendBox, { backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }]}>
              <Ionicons name="trending-up-outline" size={14} color={cfg.color} />
            </View>
          </View>

          {/* Montant principal */}
          <Text style={[ccS.label, { fontFamily: T.font.sans }]}>TRÉSORERIE TOTALE</Text>
          <Text
            style={[ccS.amount, { fontFamily: T.font.display, color: T.ink }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmt(balance, cfg.code)}
          </Text>
          <Text style={[ccS.symbol, { color: cfg.color, fontFamily: T.font.sans }]}>
            {cfg.symbol} · {cfg.code}
          </Text>

          {/* Séparateur */}
          <View style={ccS.divider} />

          {/* Barre de progression */}
          <View style={ccS.progRow}>
            <Text style={[ccS.progLabel, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>Disponible</Text>
            <Text style={[ccS.progVal, { color: cfg.color, fontFamily: T.font.mono }]}>
              {fmt(available, cfg.code)} {cfg.symbol}
            </Text>
          </View>
          <View style={ccS.progBg}>
            <View style={[ccS.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
          </View>
          <View style={ccS.progRow}>
            <Text style={[ccS.progLabel, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>Réservé</Text>
            <Text style={[ccS.progVal, { color: T.inkMuted, fontFamily: T.font.mono }]}>
              {fmt(reserved, cfg.code)} {cfg.symbol}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
});

const ccS = StyleSheet.create({
  card: {
    borderRadius: T.radius.xl,
    marginRight: 16,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: T.border,
    overflow: "hidden",
    // Ombre premium glow
    shadowColor: "#1956F0",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 14,
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 60, opacity: 0.05 },
  topRow: {
    flexDirection: "row", alignItems: "center",
    padding: 20, paddingBottom: 0, gap: 12,
  },
  flagBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  code: { fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  curName: { fontSize: 12, color: T.inkMuted },
  trendBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  label: {
    marginHorizontal: 20, marginTop: 18,
    fontSize: 10, fontWeight: "800", color: T.inkMuted,
    letterSpacing: 1.6, marginBottom: 4,
  },
  amount: {
    marginHorizontal: 20,
    fontSize: 36, fontWeight: "700", letterSpacing: -0.5, marginBottom: 3,
  },
  symbol: {
    marginHorizontal: 20,
    fontSize: 13, fontWeight: "700", letterSpacing: 0.3, marginBottom: 18,
  },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 20, marginBottom: 14 },
  progRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 4,
  },
  progLabel: { color: T.inkMuted, fontSize: 11 },
  progVal: { fontSize: 11, fontWeight: "800" },
  progBg: {
    height: 5, backgroundColor: "#EEF2F8",
    marginHorizontal: 20, borderRadius: 99, overflow: "hidden",
    marginBottom: 8, marginTop: 2,
  },
  progFill: { height: 5, borderRadius: 99 },
});

// ─── Pagination Dots ──────────────────────────────────────
function CurrencyDots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 14, marginBottom: 24 }}>
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = T.currencies[cur as keyof typeof T.currencies];
        const isActive = i === active;
        return (
          <View
            key={cur}
            style={{
              width: isActive ? 20 : 5, height: 5, borderRadius: 99,
              backgroundColor: isActive ? cfg.color : T.border,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Stat Mini Card ───────────────────────────────────────
function MiniStat({ icon, label, value, color, bg }: {
  icon: string; label: string; value: string | number;
  color: string; bg: string;
}) {
  return (
    <View style={msS.card}>
      <View style={[msS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={17} color={color} />
      </View>
      <Text style={[msS.value, { color, fontFamily: T.font.display }]}>{value}</Text>
      <Text style={[msS.label, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>{label}</Text>
    </View>
  );
}
const msS = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 18, elevation: 8,
  },
  iconBox: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  value: { fontSize: 22, fontWeight: "700", marginBottom: 3 },
  label: { fontSize: 9, color: T.inkMuted, letterSpacing: 0.8, textAlign: "center" },
});

// ─── Agency Card ─────────────────────────────────────────
function AgencyCard({
  agency, onRefill,
}: { agency: any; onRefill: () => void }) {
  const isActive = agency.isActive;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primary = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance  = toNum(primary?.balance ?? agency.balance ?? 0);
  const currency = primary?.currency ?? agency.primaryCurrency ?? "XOF";
  const cfg = T.currencies[currency as keyof typeof T.currencies] ?? T.currencies.XOF;

  const flagMap: Record<string, string> = {
    GN: "🇬🇳", SN: "🇸🇳", ML: "🇲🇱", CI: "🇨🇮", FR: "🇫🇷",
    GB: "🇬🇧", US: "🇺🇸", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬",
  };
  const flag = agency.country
    ? (flagMap[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
    : "🌍";

  return (
    <View style={agS.card}>
      {/* Bande latérale colorée */}
      <View style={[agS.sideBar, { backgroundColor: isActive ? T.green : T.red }]} />

      <View style={agS.inner}>
        {/* En-tête */}
        <View style={agS.topRow}>
          <View style={agS.flagBox}>
            <Text style={{ fontSize: 26 }}>{flag}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[agS.name, { fontFamily: T.font.display }]} numberOfLines={1}>
              {agency.name}
            </Text>
            <Text style={[agS.city, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>
              {agency.city || "—"} · {agency.country || "—"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[agS.balLabel, { fontFamily: T.font.sans }]}>SOLDE</Text>
            <Text style={[agS.bal, { color: cfg.color, fontFamily: T.font.display }]}>
              {fmt(balance, currency)}
            </Text>
            <Text style={[agS.cur, { color: cfg.color, fontFamily: T.font.mono }]}>
              {currency === "XOF" ? "CFA" : cfg.symbol}
            </Text>
          </View>
        </View>

        {/* Séparateur */}
        <View style={agS.divider} />

        {/* Pied */}
        <View style={agS.foot}>
          <View style={[
            agS.statusPill,
            {
              backgroundColor: isActive ? T.greenLt : T.redLt,
              borderColor: isActive ? `${T.green}35` : `${T.red}35`,
            },
          ]}>
            <View style={[agS.dot, { backgroundColor: isActive ? T.green : T.red }]} />
            <Text style={[agS.statusTxt, {
              color: isActive ? T.green : T.red,
              fontFamily: T.font.sans,
            }]}>
              {isActive ? "Opérationnelle" : "Suspendue"}
            </Text>
          </View>

          <TouchableOpacity
            style={agS.refillBtn}
            onPress={onRefill}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[T.blue, T.blueDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={agS.refillGrad}
            >
              <Ionicons name="paper-plane-outline" size={14} color={T.white} />
              <Text style={[agS.refillTxt, { fontFamily: T.font.sans }]}>Recharger</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const agS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  sideBar: { width: 4 },
  inner: { flex: 1, padding: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 13 },
  flagBox: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: T.blueLt, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
  },
  name: { color: T.ink, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  city: { color: T.inkMuted, fontSize: 11 },
  balLabel: { fontSize: 9, fontWeight: "800", color: T.inkMuted, letterSpacing: 0.8, marginBottom: 2 },
  bal: { fontSize: 18, fontWeight: "700" },
  cur: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  divider: { height: 1, backgroundColor: T.border, marginBottom: 12 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 9, borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  refillBtn: { borderRadius: 10, overflow: "hidden" },
  refillGrad: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  refillTxt: { fontSize: 12, fontWeight: "800", color: T.white },
});

// ─── Action Card ─────────────────────────────────────────
function ActionBtn({ icon, label, sublabel, color, bg, onPress }: {
  icon: string; label: string; sublabel: string;
  color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[abS.card]} onPress={onPress} activeOpacity={0.8}>
      <View style={[abS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={[abS.arrow, { backgroundColor: bg }]}>
        <Ionicons name="arrow-forward" size={11} color={color} />
      </View>
      <Text style={[abS.label, { fontFamily: T.font.sans }]} numberOfLines={1}>{label}</Text>
      <Text style={[abS.sub, { fontFamily: T.font.subtitle, fontWeight: "300" }]} numberOfLines={1}>{sublabel}</Text>
    </TouchableOpacity>
  );
}
const abS = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 16, borderWidth: 1, borderColor: T.border, overflow: "hidden",
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 18, elevation: 8,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 13,
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 3 },
  sub: { fontSize: 11, color: T.inkMuted },
  arrow: {
    position: "absolute", right: 12, top: 12,
    width: 26, height: 26, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Hero Parapluie ───────────────────────────────────────
function TreasuryHero({ role, userName, onRefresh, onBack, anim }: {
  role: string; userName?: string;
  onRefresh: () => void; onBack: () => void;
  anim: Animated.Value;
}) {
  return (
    <Animated.View style={[hs.outer, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
    }]}>
      {/* Gradient principal */}
      <LinearGradient
        colors={["#2461FF", "#1240D6"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={hs.gradient}
      >
        {/* Décorations */}
        <View style={hs.deco1} />
        <View style={hs.deco2} />
        <View style={hs.deco3} />

        {/* Contenu */}
        <View style={hs.content}>
          {/* Bouton retour */}
          <TouchableOpacity style={hs.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={hs.badge}>
              <View style={hs.badgeDot} />
              <Text style={[hs.badgeTxt, { fontFamily: T.font.sans }]}>
                {role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN SOCIÉTÉ"}
              </Text>
            </View>
            <Text style={[hs.title, { fontFamily: T.font.display }]}>Trésorerie</Text>
            <Text style={[hs.sub, { fontFamily: T.font.subtitle }]}>
              {userName ? `${userName}  ·  ` : ""}Direct Transf'air™
            </Text>
          </View>

          {/* Bouton refresh */}
          <TouchableOpacity style={hs.actionBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={T.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Coins concaves parapluie */}
      <View style={hs.cornerLeft} />
      <View style={hs.cornerRight} />
    </Animated.View>
  );
}

const hs = StyleSheet.create({
  outer: {
    zIndex: 10,
    shadowColor: "#0A2FA8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.40,
    shadowRadius: 32,
    elevation: 22,
  },
  gradient: {
    borderBottomLeftRadius:  HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
    paddingBottom: 30,
  },
  deco1: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.07)", top: -80, right: -50 },
  deco2: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: 20 },
  deco3: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.04)", top: 20, left: "45%" as any },
  content: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 14,
    paddingBottom: 0, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 10,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: T.white, fontSize: 28, fontWeight: "700", marginBottom: 4, letterSpacing: -0.3 },
  sub: { color: "rgba(255,255,255,0.70)", fontSize: 13, fontWeight: "300", letterSpacing: 0.1 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  cornerLeft: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: "#F0F4FF",
    borderTopRightRadius: HERO_BR,
  },
  cornerRight: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: "#F0F4FF",
    borderTopLeftRadius: HERO_BR,
  },
});

// ─── Main Screen ──────────────────────────────────────────
function TreasuryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const role = (user?.role ?? "COMPANY_ADMIN") as string;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [agencies, setAgencies]   = useState<any[]>([]);
  const [wallets,  setWallets]    = useState<any[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(0);

  const [modalVisible,  setModalVisible]  = useState(false);
  const [modalType,     setModalType]     = useState<"FUND_SELF" | "REFILL_AGENCY" | "PAY_SUPER">("FUND_SELF");
  const [targetAgency,  setTargetAgency]  = useState<any>(null);
  const [amount,        setAmount]        = useState("");
  const [refBancaire,   setRefBancaire]   = useState("");
  const [processing,    setProcessing]    = useState(false);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const scrollX     = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  const getWalletBalance = useCallback((currency: string) => {
    const w = wallets.find((x) => x.currency === currency);
    return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance ?? 0) };
  }, [wallets]);

  // --- LOGIQUE DE CHARGEMENT UNIQUE ---
  const loadData = async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else if (!hasAnimated.current) {
      setLoading(true);
    }

    try {
      if (typeof refreshUser === "function") {
        await refreshUser();
      }

      const [rawAgencies, rawWallets] = await Promise.all([
        api.getAgencies().catch(() => []),
        api.getMyWallets?.().catch(() => []) ?? Promise.resolve([]),
      ]);
      
      setAgencies(Array.isArray(rawAgencies) ? rawAgencies : []);
      setWallets(Array.isArray(rawWallets) ? rawWallets : []);

      if (!hasAnimated.current) {
        hasAnimated.current = true;
        Animated.parallel([
          Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 10 }),
          Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10 }),
        ]).start();
      }
    } catch (e) { 
      console.error("Erreur Treasury:", e); 
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // --- APPEL AU FOCUS ---
  useFocusEffect(
    useCallback(() => {
      loadData("init");
      // On garde le tableau vide [] ici. 
      // C'est ça qui empêche la page de "danser" sans arrêt.
    }, [])
  );

  // --- ACTIONS MODALES ---
  const closeModal = () => { 
    setModalVisible(false); 
    setAmount(""); 
    setRefBancaire(""); 
    setTargetAgency(null);
  };

  const showAlert = (title: string, msg: string) =>
    Platform.OS === "web" ? alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);

  const handleSubmit = async () => {
    const val = Number(amount);
    if (!val || val <= 0) {
      showAlert("Erreur", "Veuillez entrer un montant valide.");
      return;
    }
    
    setProcessing(true);
    try {
      if (modalType === "PAY_SUPER") {
        if (!refBancaire.trim()) throw new Error("Référence bancaire obligatoire.");
        await api.declareBankTransfer(val, refBancaire);
        showAlert("✅ Envoyé", "Votre virement a été déclaré avec succès.");
      } 
      else if (modalType === "REFILL_AGENCY" && targetAgency) {
        await api.adminRefillAgency(targetAgency.id, val);
        showAlert("✅ Rechargé", `L'agence ${targetAgency.name} a été créditée.`);
      } 
      else if (modalType === "FUND_SELF") {
        const selectedCurrency = CURRENCIES_ORDER[activeCurrency];   // ← devise active du carrousel
        await api.adminFundSelf(val, selectedCurrency);
        showAlert("✅ Succès", "Votre trésorerie a été mise à jour.");
      }

      closeModal();
      await loadData("refresh");
    } catch (e: any) {
      const err = e?.response?.data?.message || e?.message || "Une erreur est survenue.";
      showAlert("Erreur", Array.isArray(err) ? err.join(", ") : String(err));
    } finally {
      setProcessing(false);
    }
  };

  // Stats rapides
  const totalAgencies  = agencies.length;
  const activeAgencies = agencies.filter((a) => a.isActive).length;
  const totalCurrencies = CURRENCIES_ORDER.length;

  const modalConfig = {
    FUND_SELF:     { icon: "add-circle-outline",   title: "Alimenter la Trésorerie",          sub: "Ajout de fonds à votre compte principal.", hasRef: false },
    REFILL_AGENCY: { icon: "paper-plane-outline",  title: `Recharger ${targetAgency?.name ?? "l'agence"}`, sub: "Transfert immédiat vers la caisse.",   hasRef: false },
    PAY_SUPER:     { icon: "document-text-outline", title: "Déclarer un Virement",             sub: "Déclarez un paiement par virement bancaire.", hasRef: true },
  };
  const mc = modalConfig[modalType];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.blue} barStyle="light-content" />

      <View style={s.screen}>
        {/* ── Hero Parapluie ── */}
        <TreasuryHero
          role={role}
          userName={user?.firstName}
          onRefresh={() => void loadData("refresh")}
          onBack={() => router.back()}
          anim={heroAnim}
        />

        {loading ? (
          <ActivityIndicator color={T.blue} size="large" style={{ marginTop: 60 }} />
        ) : (
          <Animated.ScrollView
            style={[s.scroll, {
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }]}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadData("refresh")}
                tintColor={T.blue}
              />
            }
          >
            {/* ── Mini stats ── */}
            <View style={s.statsRow}>
              <MiniStat icon="storefront-outline"        label="AGENCES"   value={totalAgencies}  color={T.blue}   bg={T.blueLt} />
              <MiniStat icon="checkmark-circle-outline"  label="ACTIVES"   value={activeAgencies} color={T.green}  bg={T.greenLt} />
              <MiniStat icon="cash-outline"              label="DEVISES"   value={totalCurrencies} color={T.amber} bg={T.amberLt} />
            </View>

            {/* ── Section Trésorerie ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
            </View>

            {/* Carrousel Optimisé Fintech */}
            <Animated.FlatList
              data={CURRENCIES_ORDER}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + 16}
              decelerationRate="fast"
              bounces={false}
              contentContainerStyle={{ paddingRight: 24 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 16));
                setActiveCurrency(idx);
              }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => {
                const curItem = item as keyof typeof T.currencies;
                const inputRange = [
                  (index - 1) * (CARD_W + 16),
                  index * (CARD_W + 16),
                  (index + 1) * (CARD_W + 16),
                ];

                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.92, 1, 0.92],
                  extrapolate: "clamp",
                });

                const translateY = scrollX.interpolate({
                  inputRange,
                  outputRange: [10, 0, 10],
                  extrapolate: "clamp",
                });

                const walletData = getWalletBalance(curItem);

                return (
                  <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
                    <CurrencyCard
                      currency={curItem}
                      balance={walletData.balance}
                      reserved={walletData.reserved}
                    />
                  </Animated.View>
                );
              }}
            />

            <CurrencyDots active={activeCurrency} />

            {/* ── Actions rapides ── */}
            {!isSuperAdmin && (
              <>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ACTIONS RAPIDES</Text>
                </View>
                <View style={s.actionsRow}>
                  <ActionBtn
                    icon="document-text-outline"
                    label="Déclarer Virement"
                    sublabel="Paiement bancaire"
                    color={T.blue} bg={T.blueLt}
                    onPress={() => { setModalType("PAY_SUPER"); setModalVisible(true); }}
                  />
                  <ActionBtn
                    icon="add-circle-outline"
                    label="Alimenter"
                    sublabel="Ajouter des fonds"
                    color={T.amber} bg={T.amberLt}
                    onPress={() => { setModalType("FUND_SELF"); setModalVisible(true); }}
                  />
                </View>
              </>
            )}

            {/* ── Agences ── */}
            <View style={[s.sectionRow, { marginTop: 4 }]}>
              <View style={[s.sectionDot, { backgroundColor: T.green }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                AGENCES DU RÉSEAU · {totalAgencies}
              </Text>
            </View>

            {agencies.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="storefront-outline" size={32} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucune agence</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>
                  Les agences apparaîtront ici une fois créées
                </Text>
              </View>
            ) : (
              agencies.map((agency) => (
                <AgencyCard
                  key={agency.id}
                  agency={agency}
                  onRefill={() => {
                    setTargetAgency(agency);
                    setModalType("REFILL_AGENCY");
                    setModalVisible(true);
                  }}
                />
              ))
            )}

            <View style={{ height: 120 }} />
          </Animated.ScrollView>
        )}
      </View>

      {/* ── Modal recharge — thème clair ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={ms.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={ms.sheet}>
              <View style={ms.handle} />

              {/* En-tête modal avec mini gradient bleu */}
              <LinearGradient
                colors={["#2461FF", T.blueDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={ms.sheetHeader}
              >
                <View style={ms.sheetIconBox}>
                  <Ionicons name={mc.icon as any} size={22} color={T.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ms.sheetTitle, { fontFamily: T.font.display }]}>{mc.title}</Text>
                  <Text style={[ms.sheetSub, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>{mc.sub}</Text>
                </View>
              </LinearGradient>

              {/* Corps modal — fond blanc */}
              <View style={ms.sheetBody}>
                <Text style={[ms.inputLabel, { fontFamily: T.font.sans }]}>MONTANT (XOF / CFA)</Text>
                <View style={ms.inputWrap}>
                  <TextInput
                    style={[ms.input, { fontFamily: T.font.display }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={T.inkMuted}
                    autoFocus={!mc.hasRef}
                  />
                  <View style={ms.inputSuffix}>
                    <Text style={[ms.suffixTxt, { fontFamily: T.font.mono }]}>CFA</Text>
                  </View>
                </View>

                {mc.hasRef && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[ms.inputLabel, { fontFamily: T.font.sans }]}>RÉFÉRENCE BANCAIRE</Text>
                    <TextInput
                      style={[ms.input, ms.inputSingle, { fontFamily: T.font.mono }]}
                      value={refBancaire}
                      onChangeText={setRefBancaire}
                      placeholder="REF-VIREMENT-XXXX"
                      placeholderTextColor={T.inkMuted}
                      autoCapitalize="characters"
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[ms.confirmBtn, processing && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={processing}
                >
                  <LinearGradient
                    colors={[T.blue, T.blueDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={ms.confirmGrad}
                  >
                    {processing
                      ? <ActivityIndicator color={T.white} />
                      : <Text style={[ms.confirmTxt, { fontFamily: T.font.sans }]}>CONFIRMER</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={ms.cancelBtn} onPress={closeModal} disabled={processing}>
                  <Text style={[ms.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles globaux ───────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  screen: { flex: 1, backgroundColor: T.pageBg },
  scroll: { flex: 1, backgroundColor: T.pageBg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 0 },

  statsRow: {
    flexDirection: "row", gap: 10,
    marginTop: 22, marginBottom: 26,
  },

  sectionRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, marginBottom: 13, marginLeft: 2,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: {
    flex: 1, fontSize: 10, fontWeight: "900",
    color: T.inkMuted, letterSpacing: 1.4,
  },

  actionsRow: {
    flexDirection: "row", gap: 12, marginBottom: 24,
  },

  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: T.blueLt, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
    shadowColor: T.blue, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14, shadowRadius: 14, elevation: 6,
  },
  emptyTitle: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});

// ─── Modal styles ─────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 99,
    backgroundColor: T.border, alignSelf: "center", marginTop: 14,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 20, gap: 14,
    marginTop: 0,
  },
  sheetIconBox: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center", alignItems: "center",
  },
  sheetTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  sheetSub:   { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  sheetBody:  { padding: 20, backgroundColor: T.surface },

  inputLabel: {
    fontSize: 10, fontWeight: "800", color: T.inkMuted,
    letterSpacing: 1.2, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.blueMd,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 22, color: T.ink, fontWeight: "700",
  },
  inputSingle: {
    backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 14, color: T.ink,
  },
  inputSuffix: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: T.blueLt,
    borderLeftWidth: 1, borderLeftColor: T.blueMd,
  },
  suffixTxt: { color: T.blue, fontSize: 12, fontWeight: "800" },

  confirmBtn: { marginTop: 22, borderRadius: T.radius.md, overflow: "hidden" },
  confirmGrad: { paddingVertical: 18, alignItems: "center" },
  confirmTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: { color: T.inkMuted, fontWeight: "700", fontSize: 14 },
});

export default React.memo(TreasuryScreen);