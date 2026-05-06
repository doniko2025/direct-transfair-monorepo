// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD — Direct Transf'air v4.0
// Design: Saphir Nuit — bleu nuit profond + menthe glacée
// ✅ Carrousel 5 devises
// ✅ Déclaration virement B2B
// =========================================================

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CURRENCY_CARD_WIDTH = SW - 48;

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
type CurrencyCode = (typeof CURRENCIES_ORDER)[number];

type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  color: string;
  bg: string;
  soft: string;
};

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  XOF: { code: "XOF", symbol: "CFA", flag: "🌍", color: "#D97706", bg: "#FFF7E6", soft: "#FFFBEB" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", color: "#2563EB", bg: "#EAF2FF", soft: "#EFF6FF" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸", color: "#059669", bg: "#EAF8EF", soft: "#ECFDF5" },
  GNF: { code: "GNF", symbol: "FG", flag: "🇬🇳", color: "#DC2626", bg: "#FDECEC", soft: "#FEF2F2" },
  GBP: { code: "GBP", symbol: "£", flag: "🇬🇧", color: "#7C3AED", bg: "#F3ECFF", soft: "#F5F3FF" },
};

// ─── Design Tokens ──────────────────────────────────────
const T = {
  bg: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  surfaceSoft: "#EEF4FF",
  border: "#DCE4F2",
  borderSoft: "#E8EEF7",
  primary: "#2563EB",
  primarySoft: "#EAF2FF",
  accent: "#0EA5E9",
  accentSoft: "#E0F2FE",
  success: "#16A34A",
  successSoft: "#EAF8EF",
  warning: "#D97706",
  warningSoft: "#FFF7E6",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  text: "#0F172A",
  textSoft: "#475569",
  textMuted: "#94A3B8",
  shadow: "rgba(15,23,42,0.08)",
  currencies: CURRENCIES,
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
} as const;

// ─── Helpers ────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmtAmount(n: number, currency: string): string {
  const decimals = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return n.toFixed(decimals);
  }
}

function safeCurrency(cur: string | undefined): CurrencyCode {
  return (CURRENCIES_ORDER as readonly string[]).includes(cur || "") ? (cur as CurrencyCode) : "XOF";
}

// ─── Currency Carousel Card ──────────────────────────────
function CurrencyCard({
  currency,
  balance,
  reserved,
  txCount,
}: {
  currency: CurrencyCode;
  balance: number;
  reserved: number;
  txCount?: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={[ccS.card, { width: CURRENCY_CARD_WIDTH }]}>
      <View style={[ccS.accentBar, { backgroundColor: cfg.color }]} />
      <View style={[ccS.glow, { backgroundColor: cfg.soft }]} />

      <View style={ccS.top}>
        <View style={[ccS.flagBox, { borderColor: `${cfg.color}22`, backgroundColor: cfg.bg }]}>
          <Text style={{ fontSize: 22 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={[ccS.curCode, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.curSymbol, { color: T.text, fontFamily: T.font.display }]}>{cfg.symbol}</Text>
        </View>
        {txCount !== undefined && (
          <View style={[ccS.txBadge, { borderColor: `${cfg.color}24`, backgroundColor: `${cfg.color}10` }]}>
            <Text style={[ccS.txBadgeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>{txCount} TX</Text>
          </View>
        )}
      </View>

      <View style={ccS.balSection}>
        <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
        <Text style={[ccS.balAmount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmtAmount(balance, cfg.code)}
        </Text>
        <Text style={[ccS.balCur, { color: cfg.color, fontFamily: T.font.sans }]}>
          {cfg.symbol} · {cfg.code}
        </Text>
      </View>

      <View style={ccS.divider} />

      <View style={ccS.footRow}>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>DISPONIBLE</Text>
          <Text style={[ccS.footVal, { color: T.text, fontFamily: T.font.mono }]}>
            {fmtAmount(available, cfg.code)} {cfg.symbol}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>RÉSERVÉ</Text>
          <Text style={[ccS.footVal, { color: T.textMuted, fontFamily: T.font.mono }]}>
            {fmtAmount(reserved, cfg.code)} {cfg.symbol}
          </Text>
        </View>
      </View>

      <View style={ccS.progBg}>
        <View style={[ccS.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
      </View>
    </View>
  );
}

const ccS = StyleSheet.create({
  card: {
    borderRadius: T.radius.xl,
    padding: 22,
    marginRight: 16,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  glow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 999,
    opacity: 0.9,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  flagBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  curCode: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  curSymbol: { fontSize: 22, fontWeight: "700" },
  txBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  txBadgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  balSection: { marginBottom: 16 },
  balLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  balAmount: {
    color: T.text,
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  balCur: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: T.border, marginBottom: 14 },
  footRow: { flexDirection: "row", marginBottom: 12 },
  footLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 3,
  },
  footVal: { fontSize: 12, fontWeight: "800" },
  progBg: {
    height: 4,
    backgroundColor: T.borderSoft,
    borderRadius: 99,
    overflow: "hidden",
  },
  progFill: { height: 4, borderRadius: 99 },
});

// ─── Pagination dots ──────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 18 }}>
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = T.currencies[cur];
        return (
          <View
            key={cur}
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 99,
              backgroundColor: i === active ? cfg.color : T.border,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Menu Card ───────────────────────────────────────────
function MenuCard({ title, subtitle, icon, color, bgColor, onPress, badge }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ width: "48%", marginBottom: 14, transform: [{ scale }] }}>
      <TouchableOpacity
        style={mS.card}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={mS.topRow}>
          <View style={[mS.iconBox, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          {badge && (
            <View style={[mS.badge, { backgroundColor: `${color}12`, borderColor: `${color}24` }]}>
              <Text style={[mS.badgeTxt, { color, fontFamily: T.font.sans }]}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[mS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[mS.sub, { fontFamily: T.font.sans }]} numberOfLines={2}>
          {subtitle}
        </Text>
        <View style={[mS.arrow, { backgroundColor: `${color}10` }]}>
          <Ionicons name="arrow-forward" size={11} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const mS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  title: { fontSize: 13, fontWeight: "800", color: T.text, marginBottom: 3 },
  sub: { fontSize: 11, color: T.textSoft, fontWeight: "600", lineHeight: 15 },
  arrow: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Main ────────────────────────────────────────────────
export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [activeCurrency, setActiveCurrency] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── Auto-alimentation caisse (COMPANY_ADMIN uniquement) ──
  const [autoFillVisible, setAutoFillVisible] = useState(false);
  const [autoFillCurrency, setAutoFillCurrency] = useState<CurrencyCode>("XOF");
  const [autoFillAmount, setAutoFillAmount] = useState("");
  const [autoFillProcessing, setAutoFillProcessing] = useState(false);

  const contentAnim = useRef(new Animated.Value(0)).current;

  const clientName = useMemo(() => user?.client?.name || "Mon Entreprise", [user?.client?.name]);
  const primaryCurrency = useMemo(() => safeCurrency((user as any)?.primaryCurrency || "XOF"), [user]);

  const getWalletBalance = useCallback(
    (currency: string) => {
      const w = wallets.find((x) => x.currency === currency);
      return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance) };
    },
    [wallets],
  );

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      const wals = api.getMyWallets ? await api.getMyWallets().catch(() => []) : [];
      setWallets(Array.isArray(wals) ? wals : []);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      Animated.spring(contentAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 4,
      }).start();
    }, [loadData, contentAnim]),
  );

  useEffect(() => {
    setAutoFillCurrency(CURRENCIES_ORDER[activeCurrency]);
  }, [activeCurrency]);

  const closeModal = () => {
    setModalVisible(false);
    setAmount("");
    setRefBancaire("");
  };

  const closeAutoFill = () => {
    setAutoFillVisible(false);
    setAutoFillAmount("");
  };

  const openAutoFill = (currency: CurrencyCode) => {
    setAutoFillCurrency(currency);
    setAutoFillAmount("");
    setAutoFillVisible(true);
  };

  const handleAutoFill = async () => {
    const n = Number(autoFillAmount);
    if (!autoFillAmount || isNaN(n) || n <= 0) {
      Alert.alert("Erreur", "Saisissez un montant valide.");
      return;
    }

    setAutoFillProcessing(true);
    try {
      await api.http.post(
        `/treasury/admin/inject?currency=${encodeURIComponent(autoFillCurrency)}&amount=${n}`,
      );

      closeAutoFill();
      const successMsg = `${fmtAmount(n, autoFillCurrency)} ${autoFillCurrency} ajouté à votre caisse.`;
      if (Platform.OS === "web") {
        alert(`✅ Caisse alimentée\n\n${successMsg}`);
      } else {
        Alert.alert("✅ Caisse alimentée", successMsg);
      }
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur technique";
      if (Platform.OS === "web") alert(`Erreur\n\n${msg}`);
      else Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setAutoFillProcessing(false);
    }
  };

  const handlePay = async () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) {
      Alert.alert("Erreur", "Saisissez un montant valide.");
      return;
    }
    setProcessing(true);
    try {
      await api.declareBankTransfer(n, refBancaire);
      closeModal();
      Alert.alert("✅ Déclaration envoyée", "En attente de validation par le Super Admin.");
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <LinearGradient colors={["#FFFFFF", "#F8FBFF"]} style={s.header}>
        <View style={s.headerContent}>
          <View style={s.headerAvatarBox}>
            <LinearGradient colors={[T.primary, T.accent]} style={s.headerAvatar}>
              <Text style={[s.headerAvatarTxt, { fontFamily: T.font.display }]}>
                {(clientName[0] ?? "E").toUpperCase()}
              </Text>
            </LinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            <View style={s.headerBadge}>
              <View style={s.headerBadgeDot} />
              <Text style={[s.headerBadgeTxt, { fontFamily: T.font.sans }]}>PILOTAGE SOCIÉTÉ</Text>
            </View>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
              {clientName}
            </Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]} numberOfLines={1}>
              Tableau de bord de trésorerie multi-devises
            </Text>
          </View>

          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerBtn} onPress={loadData} activeOpacity={0.85}>
              <Ionicons name="refresh" size={18} color={T.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => router.push("/(tabs)/admin/notifications")}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications" size={18} color={T.text} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <Animated.ScrollView
        style={{ flex: 1, opacity: contentAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.primary} />}
      >
        {/* Carrousel devises */}
        <View style={s.carouselSection}>
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.primary }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CURRENCY_CARD_WIDTH + 16}
            decelerationRate="fast"
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (CURRENCY_CARD_WIDTH + 16));
              setActiveCurrency(Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1)));
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingRight: 4 }}
          >
            {CURRENCIES_ORDER.map((cur) => {
              const d = getWalletBalance(cur);
              return <CurrencyCard key={cur} currency={cur} balance={d.balance} reserved={d.reserved} />;
            })}
          </ScrollView>

          <Dots active={activeCurrency} />

          <View style={s.currencyStripWrap}>
            <Text style={[s.currencyStripLabel, { fontFamily: T.font.sans }]}>CHOISIR LA DEVISE D’ALIMENTATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.currencyStrip}>
              {CURRENCIES_ORDER.map((cur) => {
                const cfg = T.currencies[cur];
                const selected = autoFillCurrency === cur;
                return (
                  <TouchableOpacity
                    key={cur}
                    onPress={() => setAutoFillCurrency(cur)}
                    activeOpacity={0.85}
                    style={[
                      s.currencyChip,
                      {
                        backgroundColor: selected ? cfg.soft : T.surface,
                        borderColor: selected ? cfg.color : T.border,
                      },
                    ]}
                  >
                    <View style={[s.currencyChipDot, { backgroundColor: cfg.color }]} />
                    <Text style={[s.currencyChipTxt, { color: selected ? T.text : T.textSoft, fontFamily: T.font.sans }]}>
                      {cfg.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* CTA Alimenter caisse (auto-injection) */}
          <TouchableOpacity style={[s.virementBtn, { marginBottom: 10 }]} onPress={() => openAutoFill(autoFillCurrency)} activeOpacity={0.85}>
            <LinearGradient colors={[T.success, "#22C55E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.virementGrad}>
              <Ionicons name="wallet-outline" size={18} color={T.surface} />
              <Text style={[s.virementTxt, { fontFamily: T.font.sans }]}>Alimenter ma caisse · {autoFillCurrency}</Text>
              <View style={[s.virementArrow, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Ionicons name="add" size={16} color={T.surface} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* CTA Virement */}
          <TouchableOpacity style={s.virementBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <LinearGradient colors={[T.primary, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.virementGrad}>
              <Ionicons name="document-text-outline" size={18} color={T.surface} />
              <Text style={[s.virementTxt, { fontFamily: T.font.sans }]}>Déclarer un Virement B2B</Text>
              <View style={s.virementArrow}>
                <Ionicons name="arrow-forward" size={14} color={T.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Réseau */}
        <View style={s.sectionRow}>
          <View style={[s.sectionDot, { backgroundColor: T.success }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MON RÉSEAU</Text>
        </View>
        <View style={s.grid}>
          <MenuCard
            title="Créer Agence"
            subtitle="Nouveau point de service"
            icon="add-circle-outline"
            color="#7C3AED"
            bgColor={CURRENCIES.GBP.soft}
            onPress={() => router.push("/(tabs)/admin/agencies/create")}
            badge="+"
          />
          <MenuCard
            title="Agences"
            subtitle="Supervision & Caisses"
            icon="storefront-outline"
            color={T.primary}
            bgColor={T.primarySoft}
            onPress={() => router.push("/(tabs)/admin/agencies")}
          />
          <MenuCard
            title="Utilisateurs"
            subtitle="Accès & Rôles"
            icon="people-outline"
            color={T.success}
            bgColor={T.successSoft}
            onPress={() => router.push("/(tabs)/admin/users")}
          />
          <MenuCard
            title="Commissions"
            subtitle="Taux & Paliers"
            icon="settings-outline"
            color={T.warning}
            bgColor={T.warningSoft}
            onPress={() => router.push("/(tabs)/admin/commissions/config")}
          />
        </View>

        {/* Finance */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <View style={[s.sectionDot, { backgroundColor: T.warning }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>FINANCE & ANALYSE</Text>
        </View>
        <View style={s.grid}>
          <MenuCard
            title="Transactions"
            subtitle="Audit & Historique"
            icon="analytics-outline"
            color={T.danger}
            bgColor={T.dangerSoft}
            onPress={() => router.push("/(tabs)/admin/transactions")}
          />
          <MenuCard
            title="Taux de Change"
            subtitle="Devises en direct"
            icon="trending-up-outline"
            color={T.warning}
            bgColor={T.warningSoft}
            onPress={() => router.push("/(tabs)/admin/rates")}
          />
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* ── Modal Auto-alimentation caisse ── */}
      <Modal visible={autoFillVisible} transparent animationType="slide" onRequestClose={closeAutoFill}>
        <View style={s.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />

              <LinearGradient
                colors={[T.success, "#22C55E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.sheetHeader}
              >
                <Ionicons name="wallet" size={24} color={T.surface} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={[s.sheetTitle, { fontFamily: T.font.display }]}>Alimenter ma Caisse</Text>
                  <Text style={[s.sheetSub, { fontFamily: T.font.sans }]}>Auto-injection — Devise {autoFillCurrency}</Text>
                </View>
              </LinearGradient>

              <View style={s.sheetBody}>
                {/* Info */}
                <View style={s.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={T.success} style={{ marginTop: 1 }} />
                  <Text style={[s.infoText, { fontFamily: T.font.sans }]}>
                    Ce montant sera ajouté directement à votre portefeuille {autoFillCurrency}. Vous pourrez ensuite alimenter vos agences et régler vos factures Super Admin.
                  </Text>
                </View>

                <View style={s.inputGroup}>
                  <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>MONTANT À INJECTER</Text>
                  <View style={s.inputWrap}>
                    <TextInput
                      style={[s.input, { fontFamily: T.font.sans }]}
                      value={autoFillAmount}
                      onChangeText={setAutoFillAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={T.textMuted}
                      autoFocus
                    />
                    <View style={s.inputSuffix}>
                      <Text style={[s.inputSuffixTxt, { fontFamily: T.font.mono }]}>{autoFillCurrency}</Text>
                    </View>
                  </View>
                </View>

                {/* Quick amounts */}
                <View style={s.quickAmounts}>
                  {[100000, 500000, 1000000, 5000000].map((v) => {
                    const selected = autoFillAmount === String(v);
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[
                          s.quickAmountBtn,
                          {
                            backgroundColor: selected ? T.successSoft : T.surfaceAlt,
                            borderColor: selected ? `${T.success}30` : T.border,
                          },
                        ]}
                        onPress={() => setAutoFillAmount(String(v))}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={{
                            color: selected ? T.success : T.textSoft,
                            fontSize: 11,
                            fontWeight: "800",
                            fontFamily: T.font.mono,
                          }}
                        >
                          {fmtAmount(v, autoFillCurrency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[s.confirmBtn, autoFillProcessing && { opacity: 0.7 }]}
                  onPress={handleAutoFill}
                  disabled={autoFillProcessing}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[T.success, "#22C55E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmGrad}>
                    {autoFillProcessing ? (
                      <ActivityIndicator color={T.surface} />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={18} color={T.surface} />
                        <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>
                          INJECTER {autoFillAmount ? fmtAmount(Number(autoFillAmount), autoFillCurrency) : "—"} {autoFillCurrency}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeAutoFill} style={s.cancelBtn} disabled={autoFillProcessing} activeOpacity={0.85}>
                  <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Virement ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />

              <LinearGradient colors={[T.primary, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sheetHeader}>
                <Ionicons name="swap-horizontal-outline" size={24} color={T.surface} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={[s.sheetTitle, { fontFamily: T.font.display }]}>Déclarer un Virement</Text>
                  <Text style={[s.sheetSub, { fontFamily: T.font.sans }]}>Alimentation B2B — en attente de validation</Text>
                </View>
              </LinearGradient>

              <View style={s.sheetBody}>
                <View style={s.inputGroup}>
                  <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>MONTANT</Text>
                  <View style={s.inputWrap}>
                    <TextInput
                      style={[s.input, { fontFamily: T.font.sans }]}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={T.textMuted}
                      autoFocus
                    />
                    <View style={s.inputSuffix}>
                      <Text style={[s.inputSuffixTxt, { fontFamily: T.font.mono }]}>XOF</Text>
                    </View>
                  </View>
                </View>

                <View style={s.inputGroup}>
                  <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>RÉFÉRENCE BANCAIRE</Text>
                  <TextInput
                    style={[s.input, { fontFamily: T.font.mono }]}
                    value={refBancaire}
                    onChangeText={setRefBancaire}
                    placeholder="REF-VIREMENT-XXXX"
                    placeholderTextColor={T.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <TouchableOpacity
                  style={[s.confirmBtn, processing && { opacity: 0.7 }]}
                  onPress={handlePay}
                  disabled={processing}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[T.primary, T.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.confirmGrad}>
                    {processing ? (
                      <ActivityIndicator color={T.surface} />
                    ) : (
                      <>
                        <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>ENVOYER POUR VALIDATION</Text>
                        <Ionicons name="send" size={16} color={T.surface} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeModal} style={s.cancelBtn} disabled={processing} activeOpacity={0.85}>
                  <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    gap: 12,
  },
  headerAvatarBox: {},
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarTxt: { color: T.surface, fontSize: 20, fontWeight: "900" },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.surfaceSoft,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  headerBadgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: T.success },
  headerBadgeTxt: { color: T.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  headerTitle: { color: T.text, fontSize: 20, fontWeight: "800" },
  headerSub: { color: T.textSoft, fontSize: 11, fontWeight: "600", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: T.danger,
    borderWidth: 1.5,
    borderColor: T.surface,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  carouselSection: { marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { flex: 1, fontSize: 11, fontWeight: "900", color: T.textSoft, letterSpacing: 1.5 },

  currencyStripWrap: {
    marginTop: 2,
    marginBottom: 12,
  },
  currencyStripLabel: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  currencyStrip: {
    gap: 8,
    paddingRight: 8,
  },
  currencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  currencyChipDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  currencyChipTxt: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  virementBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 4 },
  virementGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  virementTxt: { flex: 1, color: T.surface, fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  virementArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: T.surface,
    justifyContent: "center",
    alignItems: "center",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 15,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 0,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 0,
    borderRadius: T.radius.lg,
  },
  sheetTitle: { color: T.surface, fontSize: 18, fontWeight: "700" },
  sheetSub: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600", marginTop: 2 },
  sheetBody: { padding: 20 },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: T.successSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${T.success}22`,
  },
  infoText: {
    flex: 1,
    color: T.success,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },

  inputGroup: { marginBottom: 16 },
  inputLabel: { color: T.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: T.surfaceAlt,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius.md,
    padding: 14,
    fontSize: 16,
    color: T.text,
    fontWeight: "700",
  },
  inputSuffix: {
    position: "absolute",
    right: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inputSuffixTxt: { color: T.textSoft, fontSize: 11, fontWeight: "800" },

  quickAmounts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  quickAmountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },

  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 8 },
  confirmGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 8,
  },
  confirmTxt: { color: T.surface, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: { color: T.textSoft, fontWeight: "800", fontSize: 14 },
});
