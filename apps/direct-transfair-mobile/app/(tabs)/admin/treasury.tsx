// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
// =========================================================
// TREASURY SCREEN v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle
// ✅ Super Admin : carrousel 5 devises consolidées + liste agences
// ✅ Company Admin : wallets société + rechargement agences
// ✅ Wallets v4 (plus balance directe)
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Alert, Platform, Modal, TextInput, ActivityIndicator,
  RefreshControl, KeyboardAvoidingView, Animated, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ──────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", dim: "#C4B89A", label: "SUPER ADMIN" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", dim: "#7BA3D4", label: "ADMIN SOCIÉTÉ" },
} as const;

const CURRENCIES = {
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", color: "#60A5FA" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸", color: "#34D399" },
  XOF: { code: "XOF", symbol: "Fr", flag: "🌍", color: "#D4A853" },
  GNF: { code: "GNF", symbol: "FG", flag: "🇬🇳", color: "#F87171" },
  GBP: { code: "GBP", symbol: "£", flag: "🇬🇧", color: "#A78BFA" },
} as const;

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  inkBorder: "#2A2A3A",
  red: "#EF4444",
  green: "#22C55E",
  amber: "#F59E0B",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

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

// ─── Currency Card ────────────────────────────────────────
function CurrencyCard({ currency, balance, reserved }: { currency: keyof typeof CURRENCIES; balance: number; reserved: number }) {
  const cfg = CURRENCIES[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;
  const cardW = SW - 48;

  return (
    <View style={[ccS.card, { width: cardW }]}>
      <View style={ccS.top}>
        <View style={[ccS.flagBox, { borderColor: `${cfg.color}35` }]}>
          <Text style={{ fontSize: 22 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={[ccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.symbol, { fontFamily: T.font.display }]}>{cfg.symbol}</Text>
        </View>
        <View style={[ccS.chg, { borderColor: `${cfg.color}25`, backgroundColor: `${cfg.color}10` }]}>
          <Ionicons name="trending-up-outline" size={12} color={cfg.color} />
        </View>
      </View>

      <Text style={[ccS.amount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(balance, cfg.code)}
      </Text>
      <Text style={[ccS.amountLabel, { color: cfg.color, fontFamily: T.font.sans }]}>TOTAL · {cfg.code}</Text>

      <View style={ccS.divider} />

      <View style={ccS.progBg}>
        <View style={[ccS.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
      </View>

      <View style={ccS.foot}>
        <View>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>DISPONIBLE</Text>
          <Text style={[ccS.footVal, { color: cfg.color, fontFamily: T.font.mono }]}>{fmt(available, cfg.code)} {cfg.symbol}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[ccS.footLabel, { fontFamily: T.font.sans }]}>RÉSERVÉ</Text>
          <Text style={[ccS.footVal, { color: T.dim, fontFamily: T.font.mono }]}>{fmt(reserved, cfg.code)} {cfg.symbol}</Text>
        </View>
      </View>
    </View>
  );
}
const ccS = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: T.radius.xl,
    padding: 22, marginRight: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  flagBox: {
    width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center",
    borderWidth: 1, backgroundColor: T.ghost,
  },
  code: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  symbol: { color: T.white, fontSize: 22, fontWeight: "700" },
  chg: {
    width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  amount: { color: T.white, fontSize: 30, letterSpacing: -0.5, marginBottom: 4 },
  amountLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 14 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 12 },
  progBg: { height: 3, backgroundColor: T.ghost, borderRadius: 99, overflow: "hidden", marginBottom: 12 },
  progFill: { height: 3, borderRadius: 99 },
  foot: { flexDirection: "row", justifyContent: "space-between" },
  footLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, marginBottom: 2 },
  footVal: { fontSize: 12, fontWeight: "800" },
});

// ─── Pagination dots ─────────────────────────────────────
function Dots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginBottom: 20 }}>
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = CURRENCIES[cur as keyof typeof CURRENCIES];
        return (
          <View key={cur} style={{ width: i === active ? 18 : 5, height: 5, borderRadius: 99, backgroundColor: i === active ? cfg.color : "rgba(255,255,255,0.15)" }} />
        );
      })}
    </View>
  );
}

// ─── Agency Card ─────────────────────────────────────────
function AgencyCard({ agency, accent, onRefill }: { agency: any; accent: string; onRefill: () => void }) {
  const isActive = agency.isActive;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primaryWallet = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance = toNum(primaryWallet?.balance ?? agency.balance ?? 0);
  const currency = primaryWallet?.currency ?? agency.primaryCurrency ?? "XOF";

  const countryFlags: Record<string, string> = {
    GN: "🇬🇳", SN: "🇸🇳", ML: "🇲🇱", CI: "🇨🇮", FR: "🇫🇷",
    GB: "🇬🇧", US: "🇺🇸", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬",
  };
  const flag = agency.country ? (countryFlags[agency.country.toUpperCase().substring(0, 2)] ?? "🌍") : "🌍";

  return (
    <View style={agS.card}>
      <View style={agS.top}>
        <View style={agS.flagBox}><Text style={{ fontSize: 24 }}>{flag}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[agS.name, { fontFamily: T.font.display }]} numberOfLines={1}>{agency.name}</Text>
          <Text style={[agS.city, { fontFamily: T.font.sans }]}>{agency.city || "—"}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[agS.balLabel, { fontFamily: T.font.sans }]}>SOLDE</Text>
          <Text style={[agS.bal, { color: accent, fontFamily: T.font.display }]}>{fmt(balance, currency)}</Text>
          <Text style={[agS.cur, { fontFamily: T.font.mono }]}>{currency}</Text>
        </View>
      </View>

      <View style={agS.divider} />

      <View style={agS.foot}>
        <View style={[agS.statusPill, { backgroundColor: isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", borderColor: isActive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }]}>
          <View style={[agS.dot, { backgroundColor: isActive ? T.green : T.red }]} />
          <Text style={[agS.statusTxt, { color: isActive ? T.green : T.red, fontFamily: T.font.sans }]}>
            {isActive ? "Opérationnelle" : "Suspendue"}
          </Text>
        </View>
        <TouchableOpacity
          style={[agS.refillBtn, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}
          onPress={onRefill}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane-outline" size={14} color={accent} />
          <Text style={[agS.refillTxt, { color: accent, fontFamily: T.font.sans }]}>Recharger</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const agS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  top: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  flagBox: {
    width: 48, height: 48, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  name: { color: T.white, fontSize: 16, fontWeight: "700", marginBottom: 3 },
  city: { color: T.dim, fontSize: 12, fontWeight: "600" },
  balLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, marginBottom: 2 },
  bal: { fontSize: 18, fontWeight: "800" },
  cur: { color: T.dim, fontSize: 10, fontWeight: "800", marginTop: 1 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 12 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  refillBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  refillTxt: { fontSize: 12, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function TreasuryScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [agencies, setAgencies] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"FUND_SELF" | "REFILL_AGENCY" | "PAY_SUPER">("FUND_SELF");
  const [targetAgency, setTargetAgency] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const getWalletBalance = useCallback((currency: string) => {
    const w = wallets.find((x) => x.currency === currency);
    return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance ?? 0) };
  }, [wallets]);

  const loadData = useCallback(async () => {
    try {
      await refreshUser();
      const [rawAgencies, rawWallets] = await Promise.all([
        api.getAgencies().catch(() => []),
        api.getMyWallets?.().catch(() => []) ?? Promise.resolve([]),
      ]);
      setAgencies(Array.isArray(rawAgencies) ? rawAgencies : []);
      setWallets(Array.isArray(rawWallets) ? rawWallets : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const closeModal = () => { setModalVisible(false); setAmount(""); setRefBancaire(""); };

  const showAlert = (title: string, msg: string) => {
    Platform.OS === "web" ? alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);
  };

  const handleSubmit = async () => {
    const val = Number(amount);
    if (!val || val <= 0) { showAlert("Erreur", "Montant invalide."); return; }
    setProcessing(true);
    try {
      if (modalType === "PAY_SUPER") {
        if (!refBancaire.trim()) throw new Error("Référence bancaire obligatoire.");
        await api.declareBankTransfer(val, refBancaire);
        showAlert("✅ Envoyé", "En attente de validation par le Super Admin.");
      } else if (modalType === "REFILL_AGENCY" && targetAgency) {
        await api.adminRefillAgency(targetAgency.id, val);
        showAlert("✅ Rechargé", `${targetAgency.name} rechargée de ${fmt(val)} XOF.`);
      } else if (modalType === "FUND_SELF") {
        await api.adminFundSelf(val);
        showAlert("✅ Crédité", `${fmt(val)} XOF ajouté à votre trésorerie.`);
      }
      closeModal();
      void loadData();
    } catch (e: any) {
      const err = e?.response?.data?.message || e?.message || "Erreur technique";
      showAlert("Erreur", Array.isArray(err) ? err.join(", ") : String(err));
    } finally { setProcessing(false); }
  };

  const modalConfig = {
    FUND_SELF:      { icon: "add-circle-outline", title: "Alimenter la Trésorerie", sub: "Ajout de fonds virtuels à votre compte principal.", hasRef: false },
    REFILL_AGENCY:  { icon: "paper-plane-outline", title: `Recharger ${targetAgency?.name ?? "l'agence"}`, sub: "Transfert immédiat vers la caisse de l'agence.", hasRef: false },
    PAY_SUPER:      { icon: "document-text-outline", title: "Déclarer un Virement", sub: "Déclarez un paiement par virement bancaire.", hasRef: true },
  };
  const mc = modalConfig[modalType];

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.headerBadge}>
              <View style={[s.headerBadgeDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.headerBadgeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>{theme.label}</Text>
            </View>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Trésorerie</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); void loadData(); }}>
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={theme.accent} />}
          >
            {/* Carrousel devises */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
            </View>

            <ScrollView
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SW - 32 + 16}
              decelerationRate="fast"
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (SW - 32));
                setActiveCurrency(Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1)));
              }}
              scrollEventThrottle={16}
            >
              {CURRENCIES_ORDER.map((cur) => {
                const d = getWalletBalance(cur);
                return <CurrencyCard key={cur} currency={cur} balance={d.balance} reserved={d.reserved} />;
              })}
            </ScrollView>

            <Dots active={activeCurrency} />

            {/* Actions rapides */}
            {!isSuperAdmin && (
              <View style={s.actionsRow}>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: `${theme.accent}12`, borderColor: `${theme.accent}25` }]}
                  onPress={() => { setModalType("PAY_SUPER"); setModalVisible(true); }}
                >
                  <View style={[s.actionIcon, { backgroundColor: `${theme.accent}15` }]}>
                    <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                  </View>
                  <Text style={[s.actionTxt, { color: theme.accent, fontFamily: T.font.sans }]}>Déclarer Virement</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.25)" }]}
                  onPress={() => { setModalType("FUND_SELF"); setModalVisible(true); }}
                >
                  <View style={[s.actionIcon, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
                    <Ionicons name="add-circle-outline" size={18} color={T.amber} />
                  </View>
                  <Text style={[s.actionTxt, { color: T.amber, fontFamily: T.font.sans }]}>Alimenter</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Agences */}
            <View style={[s.sectionRow, { marginTop: 8 }]}>
              <View style={[s.sectionDot, { backgroundColor: T.dim }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                AGENCES DU RÉSEAU ({agencies.length})
              </Text>
            </View>

            {agencies.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="storefront-outline" size={36} color={T.dim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune agence</Text>
              </View>
            ) : (
              agencies.map((agency) => (
                <AgencyCard
                  key={agency.id}
                  agency={agency}
                  accent={theme.accent}
                  onRefill={() => { setTargetAgency(agency); setModalType("REFILL_AGENCY"); setModalVisible(true); }}
                />
              ))
            )}

            <View style={{ height: 100 }} />
          </Animated.ScrollView>
        )}

        {/* ── Modal ── */}
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
          <View style={s.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
              <View style={s.sheet}>
                <View style={s.sheetHandle} />

                <LinearGradient
                  colors={[theme.g1, theme.g2]}
                  style={s.sheetHeader}
                >
                  <View style={[s.sheetIconBox, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}25` }]}>
                    <Ionicons name={mc.icon as any} size={22} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sheetTitle, { fontFamily: T.font.display }]}>{mc.title}</Text>
                    <Text style={[s.sheetSub, { fontFamily: T.font.sans }]}>{mc.sub}</Text>
                  </View>
                </LinearGradient>

                <View style={s.sheetBody}>
                  <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>MONTANT (XOF)</Text>
                  <View style={s.inputWrap}>
                    <TextInput
                      style={[s.input, { fontFamily: T.font.display }]}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      autoFocus={!mc.hasRef}
                    />
                    <View style={s.inputSuffix}>
                      <Text style={[s.inputSuffixTxt, { fontFamily: T.font.mono }]}>XOF</Text>
                    </View>
                  </View>

                  {mc.hasRef && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[s.inputLabel, { fontFamily: T.font.sans }]}>RÉFÉRENCE BANCAIRE</Text>
                      <TextInput
                        style={[s.input, { fontFamily: T.font.mono }]}
                        value={refBancaire}
                        onChangeText={setRefBancaire}
                        placeholder="REF-VIREMENT-XXXX"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        autoCapitalize="characters"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.confirmBtn, { backgroundColor: theme.accent }, processing && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={processing}
                  >
                    {processing
                      ? <ActivityIndicator color={theme.g1} />
                      : <Text style={[s.confirmTxt, { color: theme.g1, fontFamily: T.font.sans }]}>CONFIRMER</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity style={s.cancelBtn} onPress={closeModal} disabled={processing}>
                    <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4,
  },
  headerBadgeDot: { width: 5, height: 5, borderRadius: 99 },
  headerBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: T.white, fontSize: 26, fontWeight: "700" },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { flex: 1, fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: T.radius.md,
    borderWidth: 1, gap: 10,
  },
  actionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionTxt: { fontSize: 13, fontWeight: "800" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxt: { color: T.dim, fontSize: 14, fontWeight: "600" },

  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.85)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C0C16", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "center", marginTop: 14 },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 20, gap: 14, marginTop: 0,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetIconBox: {
    width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  sheetTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  sheetSub: { color: T.dim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  sheetBody: { padding: 20 },
  inputLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    borderRadius: T.radius.md, overflow: "hidden",
  },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 20, color: T.white, fontWeight: "700" },
  inputSuffix: { paddingHorizontal: 12, paddingVertical: 14, backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)" },
  inputSuffixTxt: { color: T.dim, fontSize: 11, fontWeight: "800" },
  confirmBtn: { borderRadius: T.radius.md, paddingVertical: 17, alignItems: "center", marginTop: 20 },
  confirmTxt: { fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});