// components/dashboards/CompanyDashboard.tsx
// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD — Direct Transf'air v4.0
// Design: Saphir Nuit — bleu nuit profond + menthe glacée
// ✅ Carrousel 5 devises
// ✅ Déclaration virement B2B
// =========================================================

import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Animated, SafeAreaView, StatusBar, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ──────────────────────────────────────
const T = {
  navy:      "#030B1A",
  navyMid:   "#071224",
  navyLight: "#0C1E3A",
  navyBorder:"#152E55",
  sapphire:  "#1D4ED8",
  sapphireL: "#3B82F6",
  mint:      "#34D399",
  mintSoft:  "#ECFDF5",
  mintBorder:"#6EE7B7",
  teal:      "#0D9488",
  white:     "#FFFFFF",
  ghost:     "rgba(255,255,255,0.06)",
  ghostMid:  "rgba(255,255,255,0.10)",
  ghostHi:   "rgba(255,255,255,0.18)",
  dim:       "#7BA3D4",
  dimMuted:  "#4A7099",

  currencies: {
    EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", color: "#60A5FA", bg: "#060F1E" },
    USD: { code: "USD", symbol: "$", flag: "🇺🇸", color: "#34D399", bg: "#061410" },
    XOF: { code: "XOF", symbol: "Fr", flag: "🌍", color: "#FCD34D", bg: "#120E00" },
    GNF: { code: "GNF", symbol: "FG", flag: "🇬🇳", color: "#F87171", bg: "#150505" },
    GBP: { code: "GBP", symbol: "£", flag: "🇬🇧", color: "#A78BFA", bg: "#0D0A1E" },
  },

  radius: { sm: 12, md: 16, lg: 22, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Helpers ────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmtAmount(n: number, currency: string): string {
  const decimals = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch { return n.toFixed(decimals); }
}

// ─── Currency Carousel Card ──────────────────────────────
const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;

function CurrencyCard({ currency, balance, reserved, txCount }: {
  currency: keyof typeof T.currencies;
  balance: number;
  reserved: number;
  txCount?: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;
  const cardW = SW - 48;

  return (
    <View style={[ccS.card, { width: cardW, backgroundColor: cfg.bg }]}>
      <View style={[ccS.glow, { backgroundColor: `${cfg.color}06` }]} />

      <View style={ccS.top}>
        <View style={[ccS.flagBox, { borderColor: `${cfg.color}35` }]}>
          <Text style={{ fontSize: 22 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={[ccS.curCode, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.curSymbol, { color: T.white, fontFamily: T.font.display }]}>{cfg.symbol}</Text>
        </View>
        {txCount !== undefined && (
          <View style={[ccS.txBadge, { borderColor: `${cfg.color}25`, backgroundColor: `${cfg.color}10` }]}>
            <Text style={[ccS.txBadgeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>{txCount} TX</Text>
          </View>
        )}
      </View>

      <View style={ccS.balSection}>
        <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
        <Text style={[ccS.balAmount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmtAmount(balance, cfg.code)}
        </Text>
        <Text style={[ccS.balCur, { color: cfg.color, fontFamily: T.font.sans }]}>{cfg.symbol} {cfg.code}</Text>
      </View>

      <View style={ccS.divider} />

      <View style={ccS.footRow}>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>DISPONIBLE</Text>
          <Text style={[ccS.footVal, { color: cfg.color, fontFamily: T.font.mono }]}>
            {fmtAmount(available, cfg.code)} {cfg.symbol}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>RÉSERVÉ</Text>
          <Text style={[ccS.footVal, { color: T.dimMuted, fontFamily: T.font.mono }]}>
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
    borderRadius: T.radius.xl, padding: 22, marginRight: 16,
    borderWidth: 1, borderColor: T.navyBorder, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  glow: { ...StyleSheet.absoluteFillObject, borderRadius: T.radius.xl },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  flagBox: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, backgroundColor: T.ghost,
  },
  curCode: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  curSymbol: { fontSize: 22, fontWeight: "700", color: T.white },
  txBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  txBadgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  balSection: { marginBottom: 16 },
  balLabel: { color: T.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  balAmount: { color: T.white, fontSize: 32, letterSpacing: -0.5, marginBottom: 2 },
  balCur: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: T.ghost, marginBottom: 14 },
  footRow: { flexDirection: "row", marginBottom: 12 },
  footLabel: { color: T.dimMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 3 },
  footVal: { fontSize: 12, fontWeight: "800" },
  progBg: { height: 3, backgroundColor: T.ghost, borderRadius: 99, overflow: "hidden" },
  progFill: { height: 3, borderRadius: 99 },
});

// ─── Pagination dots ──────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginBottom: 22 }}>
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = T.currencies[cur as keyof typeof T.currencies];
        return (
          <View
            key={cur}
            style={{
              width: i === active ? 18 : 5,
              height: 5,
              borderRadius: 99,
              backgroundColor: i === active ? cfg.color : T.navyBorder,
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
        style={mS.card} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={mS.topRow}>
          <View style={[mS.iconBox, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          {badge && (
            <View style={[mS.badge, { backgroundColor: `${color}20`, borderColor: `${color}30` }]}>
              <Text style={[mS.badgeTxt, { color, fontFamily: T.font.sans }]}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[mS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>{title}</Text>
        <Text style={[mS.sub, { fontFamily: T.font.sans }]} numberOfLines={2}>{subtitle}</Text>
        <View style={[mS.arrow, { backgroundColor: `${color}12` }]}>
          <Ionicons name="arrow-forward" size={11} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const mS = StyleSheet.create({
  card: {
    backgroundColor: T.navyLight, borderRadius: T.radius.lg,
    padding: 16, borderWidth: 1, borderColor: T.navyBorder,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    overflow: "hidden",
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  iconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  badge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  title: { fontSize: 13, fontWeight: "800", color: T.white, marginBottom: 3 },
  sub: { fontSize: 11, color: T.dim, fontWeight: "600", lineHeight: 15 },
  arrow: {
    position: "absolute", right: 12, bottom: 12,
    width: 24, height: 24, borderRadius: 7,
    justifyContent: "center", alignItems: "center",
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

  const contentAnim = useRef(new Animated.Value(0)).current;

  const clientName = useMemo(() => user?.client?.name || "Mon Entreprise", [user?.client?.name]);
  const primaryCurrency = useMemo(() => (user as any)?.primaryCurrency || "XOF", [user]);

  const getWalletBalance = useCallback((currency: string) => {
    const w = wallets.find((x) => x.currency === currency);
    return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance) };
  }, [wallets]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      const wals = await api.getMyWallets?.().catch(() => []) ?? [];
      setWallets(Array.isArray(wals) ? wals : []);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 4 }).start();
  }, [loadData]));

  const closeModal = () => { setModalVisible(false); setAmount(""); setRefBancaire(""); };

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
    } finally { setProcessing(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={T.navy} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[T.navyMid, T.navy]}
        style={s.header}
      >
        <View style={s.headerContent}>
          <View style={s.headerAvatarBox}>
            <LinearGradient colors={[T.sapphire, T.teal]} style={s.headerAvatar}>
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
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerBtn} onPress={loadData}>
              <Ionicons name="refresh" size={18} color={T.mint} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
              <Ionicons name="notifications" size={18} color={T.white} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.mint} />}
      >
        {/* Carrousel devises */}
        <View style={s.carouselSection}>
          <View style={s.sectionRow}>
            <View style={s.sectionDot} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SW - 40 + 16}
            decelerationRate="fast"
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (SW - 40));
              setActiveCurrency(Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1)));
            }}
            scrollEventThrottle={16}
          >
            {CURRENCIES_ORDER.map((cur) => {
              const d = getWalletBalance(cur);
              return (
                <CurrencyCard
                  key={cur}
                  currency={cur}
                  balance={d.balance}
                  reserved={d.reserved}
                />
              );
            })}
          </ScrollView>

          <Dots active={activeCurrency} />

          {/* CTA Virement */}
          <TouchableOpacity style={s.virementBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
            <LinearGradient
              colors={[T.sapphire, T.teal]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.virementGrad}
            >
              <Ionicons name="document-text-outline" size={18} color={T.white} />
              <Text style={[s.virementTxt, { fontFamily: T.font.sans }]}>Déclarer un Virement B2B</Text>
              <View style={s.virementArrow}>
                <Ionicons name="arrow-forward" size={14} color={T.sapphire} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Réseau */}
        <View style={s.sectionRow}>
          <View style={[s.sectionDot, { backgroundColor: T.mint }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MON RÉSEAU</Text>
        </View>
        <View style={s.grid}>
          <MenuCard title="Créer Agence" subtitle="Nouveau point de service" icon="add-circle-outline" color="#A78BFA" bgColor="#1A1030" onPress={() => router.push("/(tabs)/admin/agencies/create")} badge="+" />
          <MenuCard title="Agences" subtitle="Supervision & Caisses" icon="storefront-outline" color={T.sapphireL} bgColor="#0A1520" onPress={() => router.push("/(tabs)/admin/agencies")} />
          <MenuCard title="Utilisateurs" subtitle="Accès & Rôles" icon="people-outline" color={T.mint} bgColor="#081510" onPress={() => router.push("/(tabs)/admin/users")} />
          <MenuCard title="Commissions" subtitle="Taux & Paliers" icon="settings-outline" color="#F97316" bgColor="#150B00" onPress={() => router.push("/(tabs)/admin/commissions/config")} />
        </View>

        {/* Finance */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <View style={[s.sectionDot, { backgroundColor: "#F97316" }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>FINANCE & ANALYSE</Text>
        </View>
        <View style={s.grid}>
          <MenuCard title="Transactions" subtitle="Audit & Historique" icon="analytics-outline" color="#EF4444" bgColor="#150505" onPress={() => router.push("/(tabs)/admin/transactions")} />
          <MenuCard title="Taux de Change" subtitle="Devises en direct" icon="trending-up-outline" color="#FCD34D" bgColor="#120D00" onPress={() => router.push("/(tabs)/admin/rates")} />
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* ── Modal Virement ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />

              <LinearGradient
                colors={[T.sapphire, T.teal]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.sheetHeader}
              >
                <Ionicons name="swap-horizontal-outline" size={24} color={T.white} />
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
                      placeholderTextColor={T.dimMuted}
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
                    placeholderTextColor={T.dimMuted}
                    autoCapitalize="characters"
                  />
                </View>

                <TouchableOpacity
                  style={[s.confirmBtn, processing && { opacity: 0.7 }]}
                  onPress={handlePay}
                  disabled={processing}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[T.sapphire, T.teal]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.confirmGrad}
                  >
                    {processing
                      ? <ActivityIndicator color={T.white} />
                      : <>
                          <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>ENVOYER POUR VALIDATION</Text>
                          <Ionicons name="send" size={16} color={T.white} />
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeModal} style={s.cancelBtn} disabled={processing}>
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
  safe: { flex: 1, backgroundColor: T.navyMid },

  header: {
    paddingBottom: 16, zIndex: 10,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  headerContent: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 40 : 16, gap: 12,
  },
  headerAvatarBox: {},
  headerAvatar: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  headerAvatarTxt: { color: T.white, fontSize: 20, fontWeight: "900" },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.navyBorder,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 4,
  },
  headerBadgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.mint },
  headerBadgeTxt: { color: T.mint, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.navyBorder,
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 99,
    backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: T.navy,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  carouselSection: { marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.sapphireL },
  sectionLabel: { flex: 1, fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  virementBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 4 },
  virementGrad: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 16, gap: 10,
  },
  virementTxt: { flex: 1, color: T.white, fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  virementArrow: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.white, justifyContent: "center", alignItems: "center",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  overlay: { flex: 1, backgroundColor: "rgba(3,11,26,0.85)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.navyMid, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 99,
    backgroundColor: T.navyBorder, alignSelf: "center", marginTop: 14, marginBottom: 0,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 20, marginHorizontal: 20, marginTop: 16, marginBottom: 0,
    borderRadius: T.radius.lg,
  },
  sheetTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  sheetSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600", marginTop: 2 },
  sheetBody: { padding: 20 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { color: T.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1, backgroundColor: T.navyLight, borderWidth: 1, borderColor: T.navyBorder,
    borderRadius: T.radius.md, padding: 14, fontSize: 16, color: T.white, fontWeight: "700",
  },
  inputSuffix: {
    position: "absolute", right: 14,
    backgroundColor: T.ghost, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  inputSuffixTxt: { color: T.dim, fontSize: 11, fontWeight: "800" },

  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 8 },
  confirmGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 17, gap: 8,
  },
  confirmTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});