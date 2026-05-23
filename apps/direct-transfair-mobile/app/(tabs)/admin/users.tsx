// apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
// =========================================================
// USERS v7.1 — Direct Transf'air
// ✅ SUPER_ADMIN   : voit admins sociétés + gérants agences
//                   + stats clients (actifs/inactifs/total)
//                   Filtre : pays, devise, nom, email
// ✅ COMPANY_ADMIN : voit ses clients + ses agents
//                   Filtre : pays, devise, nom, email
// ✅ FIX v7.1 : UsersSA utilise api.getUsers() (GET /users)
//              au lieu de api.getClients() qui ne renvoie
//              pas les relations users/agencies imbriquées
// =========================================================

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
  StatusBar, Animated, ScrollView, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Tokens ──────────────────────────────────────────────
const T = {
  // SA : violet/bleu
  saAccent:   "#1956F0",
  saAccentLt: "#EEF2FF",
  saAccentMd: "#C7D5FF",
  saBg:       "#F0F4FF",

  // CA : bleu ciel
  caAccent:   "#0284C7",
  caAccentLt: "#E0F2FE",
  caAccentMd: "#7DD3FC",
  caBg:       "#F2F4F8",

  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderLt: "#F1F5F9",
  borderMd: "#D1D9E6",

  ink:      "#0F172A",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",

  green:   "#16A34A", greenLt:  "#DCFCE7", greenMd: "#A7F3D0",
  red:     "#DC2626", redLt:    "#FEE2E2",
  amber:   "#D97706", amberLt:  "#FEF3C7",
  blue:    "#1956F0", blueLt:   "#EEF2FF", blueMd: "#C7D5FF",
  purple:  "#7C3AED", purpleLt: "#EDE9FE",
  teal:    "#0F766E", tealLt:   "#CCFBF1", tealMd: "#5EEAD4",
  white:   "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20 },

  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sub:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "monospace"    }),
  },

  shadow: {
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 5 },
    soft: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,  elevation: 3 },
  },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: T.green, INACTIVE: T.red, SUSPENDED: T.amber, EXPIRED: T.red, TRIAL: T.purple,
};

const ROLE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  SUPER_ADMIN:   { color: T.amber,      bg: T.amberLt,  label: "Super Admin"   },
  COMPANY_ADMIN: { color: T.blue,       bg: T.blueLt,   label: "Admin Société" },
  AGENT:         { color: T.amber,      bg: T.amberLt,  label: "Agent"         },
  USER:          { color: T.green,      bg: T.greenLt,  label: "Client"        },
};

const CURRENCIES = ["Toutes", "XOF", "EUR", "GNF", "USD", "GBP"];

// ─── Helpers ─────────────────────────────────────────────
function initials(s: string): string { return (s ?? "?")[0].toUpperCase(); }
function fullName(u: any): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || (u.email ?? "—");
}

// ─── Composants partagés ─────────────────────────────────

function SL({ dot, label, count }: { dot: string; label: string; count?: number }) {
  return (
    <View style={slS.row}>
      <View style={[slS.dot, { backgroundColor: dot }]} />
      <Text style={[slS.lbl, { fontFamily: T.font.sans }]}>{label}</Text>
      {count !== undefined && (
        <View style={[slS.pill, { backgroundColor: dot + "18" }]}>
          <Text style={[slS.pillTxt, { color: dot, fontFamily: T.font.mono }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}
const slS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot:    { width: 6, height: 6, borderRadius: 99 },
  lbl:    { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
  pill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillTxt:{ fontSize: 10, fontWeight: "900" },
});

// Barre de recherche + bouton filtre
function SearchBar({
  value, onChange, onFilterPress, accent, filterActive,
}: {
  value: string; onChange: (v: string) => void;
  onFilterPress: () => void; accent: string; filterActive: boolean;
}) {
  return (
    <View style={sbS.row}>
      <View style={sbS.inputWrap}>
        <Ionicons name="search" size={16} color={T.inkMuted} />
        <TextInput
          style={[sbS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChange}
          placeholder="Nom, email…"
          placeholderTextColor={T.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!value && (
          <TouchableOpacity onPress={() => onChange("")}>
            <Ionicons name="close-circle" size={15} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={[sbS.filterBtn, { backgroundColor: filterActive ? accent : T.surface, borderColor: filterActive ? accent : T.border }]}
        onPress={onFilterPress}
      >
        <Ionicons name="options-outline" size={18} color={filterActive ? T.white : T.inkSub} />
      </TouchableOpacity>
    </View>
  );
}
const sbS = StyleSheet.create({
  row:      { flexDirection: "row", gap: 10, marginBottom: 14 },
  inputWrap:{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, height: 46 },
  input:    { flex: 1, fontSize: 13, color: T.ink, fontWeight: "600" },
  filterBtn:{ width: 46, height: 46, borderRadius: T.radius.md, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
});

// Modal de filtres (pays + devise)
function FilterModal({
  visible, onClose, country, onCountry,
  currency, onCurrency, countries, accent,
}: {
  visible: boolean; onClose: () => void;
  country: string; onCountry: (v: string) => void;
  currency: string; onCurrency: (v: string) => void;
  countries: string[]; accent: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fmS.overlay}>
        <View style={fmS.sheet}>
          <View style={fmS.handle} />
          <View style={fmS.header}>
            <Text style={[fmS.title, { fontFamily: T.font.display }]}>Filtres</Text>
            <TouchableOpacity style={fmS.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={17} color={T.inkSub} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={fmS.body} showsVerticalScrollIndicator={false}>
            {/* Pays */}
            <Text style={[fmS.sectionLbl, { fontFamily: T.font.sans }]}>PAYS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fmS.chips}>
              {["Tous", ...countries].map((c) => {
                const active = country === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[fmS.chip, active && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => onCountry(c)}
                  >
                    <Text style={[fmS.chipTxt, { color: active ? T.white : T.inkSub, fontFamily: T.font.sans }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Devise */}
            <Text style={[fmS.sectionLbl, { fontFamily: T.font.sans, marginTop: 16 }]}>DEVISE</Text>
            <View style={fmS.chipsWrap}>
              {CURRENCIES.map((cur) => {
                const active = currency === cur;
                return (
                  <TouchableOpacity
                    key={cur}
                    style={[fmS.chip, active && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => onCurrency(cur)}
                  >
                    <Text style={[fmS.chipTxt, { color: active ? T.white : T.inkSub, fontFamily: T.font.mono }]}>{cur}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[fmS.resetBtn, { borderColor: accent }]}
              onPress={() => { onCountry("Tous"); onCurrency("Toutes"); onClose(); }}
            >
              <Text style={[fmS.resetTxt, { color: accent, fontFamily: T.font.sans }]}>Réinitialiser les filtres</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const fmS = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "65%", borderWidth: 1, borderColor: T.border },
  handle:   { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14 },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, paddingBottom: 10 },
  title:    { fontSize: 17, fontWeight: "700", color: T.ink },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
  body:     { paddingHorizontal: 18, paddingBottom: 10 },
  sectionLbl:{ fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.2, marginBottom: 10 },
  chips:    { gap: 8, paddingBottom: 4 },
  chipsWrap:{ flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:     { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface },
  chipTxt:  { fontSize: 12, fontWeight: "700" },
  resetBtn: { marginTop: 20, borderWidth: 1.5, borderRadius: T.radius.md, paddingVertical: 12, alignItems: "center" },
  resetTxt: { fontSize: 13, fontWeight: "800" },
});

// User Card générique
function UserCard({ item, accent, accentLt }: { item: any; accent: string; accentLt: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const roleCfg = ROLE_CFG[item.role] ?? { color: T.inkMuted, bg: T.borderLt, label: item.role };
  const isActive = item.isActive !== false && !item.isSuspended;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ucS.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[ucS.bar, { backgroundColor: roleCfg.color }]} />
        <View style={ucS.body}>
          <View style={ucS.row}>
            <View style={[ucS.avatar, { backgroundColor: accentLt }]}>
              <Text style={[ucS.avatarTxt, { color: accent, fontFamily: T.font.display }]}>
                {initials(item.firstName ?? item.email ?? "?")}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[ucS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
                {fullName(item)}
              </Text>
              <Text style={[ucS.email, { fontFamily: T.font.sub }]} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[ucS.rolePill, { backgroundColor: roleCfg.bg }]}>
                <Text style={[ucS.roleTxt, { color: roleCfg.color, fontFamily: T.font.sans }]}>
                  {roleCfg.label}
                </Text>
              </View>
              <View style={[ucS.statusDot, { backgroundColor: isActive ? T.green : T.red }]} />
            </View>
          </View>

          {/* Infos secondaires */}
          <View style={ucS.meta}>
            {item.country && (
              <View style={ucS.metaItem}>
                <Ionicons name="flag-outline" size={10} color={T.inkMuted} />
                <Text style={[ucS.metaTxt, { fontFamily: T.font.sans }]}>{item.country}</Text>
              </View>
            )}
            {item.primaryCurrency && (
              <View style={ucS.metaItem}>
                <Ionicons name="cash-outline" size={10} color={T.inkMuted} />
                <Text style={[ucS.metaTxt, { fontFamily: T.font.mono }]}>{item.primaryCurrency}</Text>
              </View>
            )}
            {item.phone && (
              <View style={ucS.metaItem}>
                <Ionicons name="call-outline" size={10} color={T.inkMuted} />
                <Text style={[ucS.metaTxt, { fontFamily: T.font.sans }]}>{item.phone}</Text>
              </View>
            )}
            {/* Contexte société / agence */}
            {item.client?.name && (
              <View style={ucS.metaItem}>
                <Ionicons name="business-outline" size={10} color={T.inkMuted} />
                <Text style={[ucS.metaTxt, { fontFamily: T.font.sans }]}>
                  {item.client.name}{item.agency?.name ? ` · ${item.agency.name}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ucS = StyleSheet.create({
  card:     { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft },
  bar:      { width: 4 },
  body:     { flex: 1, padding: 12 },
  row:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  avatar:   { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  avatarTxt:{ fontSize: 16, fontWeight: "700" },
  name:     { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 2 },
  email:    { fontSize: 10, color: T.inkSub },
  rolePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  roleTxt:  { fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  statusDot:{ width: 7, height: 7, borderRadius: 99 },
  meta:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTxt:  { fontSize: 10, color: T.inkSub, fontWeight: "600" },
});

// Stat card
function StatCard({ label, value, color, bg, icon }: {
  label: string; value: number; color: string; bg: string; icon: string;
}) {
  return (
    <View style={[stcS.card, { borderTopColor: color }]}>
      <View style={[stcS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[stcS.val, { color, fontFamily: T.font.mono }]}>{value}</Text>
      <Text style={[stcS.lbl, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const stcS = StyleSheet.create({
  card:   { flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 12, alignItems: "center", borderTopWidth: 3, borderWidth: 1, borderColor: T.border, ...T.shadow.soft },
  iconBox:{ width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  val:    { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  lbl:    { fontSize: 9, fontWeight: "800", color: T.inkMuted, letterSpacing: 0.8, textAlign: "center" },
});

// Header écran
function ScreenHeader({
  accent, accentLt, title, subtitle, onBack, onRefresh,
}: {
  accent: string; accentLt: string;
  title: string; subtitle: string;
  onBack: () => void; onRefresh: () => void;
}) {
  return (
    <View style={[schS.header, { backgroundColor: T.surface }]}>
      <TouchableOpacity style={schS.backBtn} onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={T.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[schS.title, { fontFamily: T.font.display }]}>{title}</Text>
        <Text style={[schS.sub, { color: accent, fontFamily: T.font.sans }]}>{subtitle}</Text>
      </View>
      <View style={[schS.badge, { backgroundColor: accentLt }]}>
        <View style={[schS.badgeDot, { backgroundColor: accent }]} />
        <Text style={[schS.badgeTxt, { color: accent, fontFamily: T.font.sans }]}>
          {accent === T.saAccent ? "SUPER ADMIN" : "ADMIN"}
        </Text>
      </View>
      <TouchableOpacity
        style={[schS.refreshBtn, { backgroundColor: accentLt }]}
        onPress={onRefresh}
      >
        <Ionicons name="refresh" size={18} color={accent} />
      </TouchableOpacity>
    </View>
  );
}
const schS = StyleSheet.create({
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn:    { width: 38, height: 38, borderRadius: 11, backgroundColor: T.borderLt, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 19, fontWeight: "700", color: T.ink },
  sub:        { fontSize: 11, fontWeight: "700", marginTop: 2 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeDot:   { width: 5, height: 5, borderRadius: 99 },
  badgeTxt:   { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  refreshBtn: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
});

// Appliquer les filtres texte + pays + devise
function applyFilters(list: any[], q: string, country: string, currency: string): any[] {
  return list.filter((item) => {
    if (q.trim()) {
      const s = q.toLowerCase();
      const match =
        fullName(item).toLowerCase().includes(s) ||
        (item.email ?? "").toLowerCase().includes(s);
      if (!match) return false;
    }
    if (country && country !== "Tous" && country !== "Toutes") {
      if ((item.country ?? "").toUpperCase() !== country.toUpperCase()) return false;
    }
    if (currency && currency !== "Toutes") {
      if ((item.primaryCurrency ?? "") !== currency) return false;
    }
    return true;
  });
}

// ══════════════════════════════════════════════════════════
//  SUPER-ADMIN
//  ✅ FIX v7.1 : utilise api.getUsers() → GET /users
//  Le backend renvoie tous les users (whereClause = {})
//  On filtre ensuite par rôle côté frontend.
// ══════════════════════════════════════════════════════════
function UsersSA() {
  const router   = useRouter();
  const { user } = useAuth();

  // ✅ allUsers contient la liste brute depuis GET /users
  const [allUsers,   setAllUsers]   = useState<any[]>([]);
  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q,          setQ]          = useState("");
  const [country,    setCountry]    = useState("Tous");
  const [currency,   setCurrency]   = useState("Toutes");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"admins" | "agents">("admins");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      // ✅ GET /users retourne tous les users car le SA a whereClause = {}
      // GET /agencies pour les stats agences
      const [usersRes, agenciesRes] = await Promise.allSettled([
        api.getUsers({ limit: 500 }),
        api.getAgencies(),
      ]);

      if (usersRes.status === "fulfilled") {
        const data = usersRes.value;
        setAllUsers(Array.isArray(data) ? data : []);
      } else {
        console.warn("getUsers failed:", usersRes.reason);
        setAllUsers([]);
      }

      if (agenciesRes.status === "fulfilled") {
        setAgencies(Array.isArray(agenciesRes.value) ? agenciesRes.value : []);
      } else {
        setAgencies([]);
      }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) {
      console.error("UsersSA load error:", e);
      setAllUsers([]);
    } finally {
      if (mode === "refresh") setRefreshing(false); else setLoading(false);
    }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  // ✅ Filtrer par rôle depuis la liste brute
  const allAdmins = useMemo(() =>
    allUsers.filter((u: any) => u.role === "COMPANY_ADMIN"),
  [allUsers]);

  const allAgents = useMemo(() =>
    allUsers.filter((u: any) => u.role === "AGENT"),
  [allUsers]);

  // Clients (rôle USER) pour les stats
  const allClientUsers = useMemo(() =>
    allUsers.filter((u: any) => u.role === "USER"),
  [allUsers]);

  // Pays disponibles
  const countries = useMemo(() => {
    const set = new Set<string>();
    [...allAdmins, ...allAgents].forEach((u) => { if (u.country) set.add(u.country); });
    return Array.from(set).sort();
  }, [allAdmins, allAgents]);

  // Listes filtrées
  const filteredAdmins = useMemo(() =>
    applyFilters(allAdmins, q, country, currency), [allAdmins, q, country, currency]);
  const filteredAgents = useMemo(() =>
    applyFilters(allAgents, q, country, currency), [allAgents, q, country, currency]);

  // Stats
  const statsClients = useMemo(() => ({
    total:     allClientUsers.length,
    active:    allClientUsers.filter((u) => u.isActive !== false && !u.isSuspended).length,
    inactive:  allClientUsers.filter((u) => u.isActive === false).length,
    suspended: allClientUsers.filter((u) => u.isSuspended).length,
    trial:     0,
  }), [allClientUsers]);

  const filterActive = country !== "Tous" || currency !== "Toutes";
  const currentList  = activeTab === "admins" ? filteredAdmins : filteredAgents;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.saBg }]} edges={["top"]}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />
      <ScreenHeader
        accent={T.saAccent} accentLt={T.saAccentLt}
        title="Utilisateurs"
        subtitle={`${filteredAdmins.length + filteredAgents.length} résultat(s)`}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.saAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.saBg }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <SL dot={T.saAccent} label="STATISTIQUES UTILISATEURS" />
          <View style={s.statsRow}>
            <StatCard label="Admins"    value={allAdmins.length}       color={T.saAccent} bg={T.saAccentLt} icon="business-outline"         />
            <StatCard label="Agents"    value={allAgents.length}       color={T.amber}    bg={T.amberLt}    icon="person-outline"            />
            <StatCard label="Clients"   value={allClientUsers.length}  color={T.green}    bg={T.greenLt}    icon="people-outline"            />
            <StatCard label="Agences"   value={agencies.length}        color={T.teal}     bg={T.tealLt}     icon="storefront-outline"        />
          </View>

          {/* Recherche + filtres */}
          <SearchBar
            value={q} onChange={setQ}
            onFilterPress={() => setFilterOpen(true)}
            accent={T.saAccent} filterActive={filterActive}
          />

          {/* Tabs */}
          <View style={s.tabs}>
            {(["admins", "agents"] as const).map((tab) => {
              const active = activeTab === tab;
              const count  = tab === "admins" ? filteredAdmins.length : filteredAgents.length;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.tab, active && { backgroundColor: T.saAccentLt, borderColor: T.saAccentMd }]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[s.tabTxt, { color: active ? T.saAccent : T.inkSub, fontFamily: T.font.sans }]}>
                    {tab === "admins" ? "Admins Société" : "Gérants Agences"}
                  </Text>
                  <View style={[s.tabPill, { backgroundColor: active ? T.saAccent : T.borderLt }]}>
                    <Text style={[s.tabCount, { color: active ? T.white : T.inkMuted, fontFamily: T.font.mono }]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Liste */}
          <SL
            dot={T.saAccent}
            label={activeTab === "admins" ? "ADMINS SOCIÉTÉS" : "GÉRANTS AGENCES"}
            count={currentList.length}
          />
          {currentList.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="people-outline" size={20} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
            </View>
          ) : (
            currentList.map((item, i) => (
              <UserCard key={item.id ?? i} item={item} accent={T.saAccent} accentLt={T.saAccentLt} />
            ))
          )}

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}

      <FilterModal
        visible={filterOpen} onClose={() => setFilterOpen(false)}
        country={country} onCountry={setCountry}
        currency={currency} onCurrency={setCurrency}
        countries={countries} accent={T.saAccent}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  COMPANY-ADMIN
//  Voit : ses clients (USER) + ses agents
//  Inchangé — fonctionnait déjà correctement
// ══════════════════════════════════════════════════════════
function UsersCA() {
  const router   = useRouter();
  const { user } = useAuth();

  const [allUsers,   setAllUsers]   = useState<any[]>([]);
  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q,          setQ]          = useState("");
  const [country,    setCountry]    = useState("Tous");
  const [currency,   setCurrency]   = useState("Toutes");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"clients" | "agents">("clients");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      const [usersRes, agenciesRes] = await Promise.allSettled([
        api.http.get("/users?limit=100"),
        api.getAgencies(),
      ]);
      if (usersRes.status    === "fulfilled") {
        const data = usersRes.value.data;
        setAllUsers(Array.isArray(data) ? data : (data?.data ?? []));
      }
      if (agenciesRes.status === "fulfilled") setAgencies(Array.isArray(agenciesRes.value) ? agenciesRes.value : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setAllUsers([]); setAgencies([]); }
    finally { if (mode === "refresh") setRefreshing(false); else setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  const myClients = useMemo(() => allUsers.filter((u) => u.role === "USER"),  [allUsers]);
  const myAgents  = useMemo(() => allUsers.filter((u) => u.role === "AGENT"), [allUsers]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    [...myClients, ...myAgents].forEach((u) => { if (u.country) set.add(u.country); });
    return Array.from(set).sort();
  }, [myClients, myAgents]);

  const filteredClients = useMemo(() => applyFilters(myClients, q, country, currency), [myClients, q, country, currency]);
  const filteredAgents  = useMemo(() => applyFilters(myAgents,  q, country, currency), [myAgents,  q, country, currency]);

  const statsClients = useMemo(() => ({
    total:    myClients.length,
    active:   myClients.filter((u) => u.isActive !== false && !u.isSuspended).length,
    inactive: myClients.filter((u) => u.isActive === false || u.isSuspended).length,
  }), [myClients]);

  const filterActive = country !== "Tous" || currency !== "Toutes";
  const currentList  = activeTab === "clients" ? filteredClients : filteredAgents;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.caBg }]} edges={["top"]}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />
      <ScreenHeader
        accent={T.caAccent} accentLt={T.caAccentLt}
        title="Mes Utilisateurs"
        subtitle={`${filteredClients.length + filteredAgents.length} résultat(s)`}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.caAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.caBg }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <SL dot={T.caAccent} label="STATISTIQUES MES CLIENTS" />
          <View style={s.statsRow}>
            <StatCard label="Total"    value={statsClients.total}    color={T.caAccent} bg={T.caAccentLt} icon="people-outline"            />
            <StatCard label="Actifs"   value={statsClients.active}   color={T.green}    bg={T.greenLt}    icon="checkmark-circle-outline"  />
            <StatCard label="Inactifs" value={statsClients.inactive} color={T.red}      bg={T.redLt}      icon="close-circle-outline"      />
            <StatCard label="Agences"  value={agencies.length}       color={T.teal}     bg={T.tealLt}     icon="storefront-outline"        />
          </View>

          {/* Recherche + filtres */}
          <SearchBar
            value={q} onChange={setQ}
            onFilterPress={() => setFilterOpen(true)}
            accent={T.caAccent} filterActive={filterActive}
          />

          {/* Tabs */}
          <View style={s.tabs}>
            {(["clients", "agents"] as const).map((tab) => {
              const active = activeTab === tab;
              const count  = tab === "clients" ? filteredClients.length : filteredAgents.length;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.tab, active && { backgroundColor: T.caAccentLt, borderColor: T.caAccentMd }]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[s.tabTxt, { color: active ? T.caAccent : T.inkSub, fontFamily: T.font.sans }]}>
                    {tab === "clients" ? "Mes Clients" : "Mes Agents"}
                  </Text>
                  <View style={[s.tabPill, { backgroundColor: active ? T.caAccent : T.borderLt }]}>
                    <Text style={[s.tabCount, { color: active ? T.white : T.inkMuted, fontFamily: T.font.mono }]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Liste */}
          <SL
            dot={T.caAccent}
            label={activeTab === "clients" ? "MES CLIENTS" : "MES AGENTS"}
            count={currentList.length}
          />
          {currentList.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="people-outline" size={20} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
            </View>
          ) : (
            currentList.map((item, i) => (
              <UserCard key={item.id ?? i} item={item} accent={T.caAccent} accentLt={T.caAccentLt} />
            ))
          )}

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}

      <FilterModal
        visible={filterOpen} onClose={() => setFilterOpen(false)}
        country={country} onCountry={setCountry}
        currency={currency} onCurrency={setCurrency}
        countries={countries} accent={T.caAccent}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  ROUTEUR
// ══════════════════════════════════════════════════════════
export default function UsersScreen() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN")   return <UsersSA />;
  if (user?.role === "COMPANY_ADMIN") return <UsersCA />;
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.caBg, justifyContent: "center", alignItems: "center" }} edges={["top"]}>
      <Ionicons name="lock-closed-outline" size={48} color={T.inkMuted} />
      <Text style={{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16 }}>
        Accès non autorisé
      </Text>
      <TouchableOpacity
        style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: T.caAccentLt, borderRadius: 12 }}
        onPress={() => router.back()}
      >
        <Text style={{ color: T.caAccent, fontWeight: "700" }}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles partagés ─────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },

  tabs: { flexDirection: "row", gap: 10, marginBottom: 16 },
  tab:  {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, borderRadius: T.radius.md,
    borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface,
  },
  tabTxt:   { fontSize: 12, fontWeight: "800" },
  tabPill:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tabCount: { fontSize: 10, fontWeight: "900" },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: T.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, marginBottom: 14 },
  emptyTxt: { color: T.inkMuted, fontSize: 12, fontWeight: "600" },
});