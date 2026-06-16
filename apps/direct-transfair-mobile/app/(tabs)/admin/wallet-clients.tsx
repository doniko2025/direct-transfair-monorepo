// apps/direct-transfair-mobile/app/(tabs)/admin/wallet-clients.tsx
// =========================================================
// ADMIN WALLET CLIENTS v1.1 — Direct Transf'air
// ✅ v1.0 : Liste clients wallet, filtres, navigation
// ✅ v1.1 :
//   - FIX espace vide : Animated.FlatList flex:1 ajouté
//   - Filtres redesignés : 2 boutons dropdown (statut + pays)
//     au lieu de la barre de pills horizontale encombrée
//   - Chaque dropdown ouvre un bottom sheet avec options radio
//   - Compteurs par option dans chaque dropdown
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, SafeAreaView, StatusBar, Platform,
  TextInput, Animated, Modal, ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Design tokens ────────────────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  orange:   "#F97316", orangeLt: "#FFF7ED", orangeMd: "#FED7AA",
  blue:     "#1956F0", blueLt:   "#EEF2FF", blueMd:   "#C7D5FF",
  green:    "#16A34A", greenLt:  "#DCFCE7",
  red:      "#DC2626", redLt:    "#FEE2E2",
  amber:    "#D97706", amberLt:  "#FEF3C7",
  radius: { sm: 8, md: 12, lg: 16 },
  font: {
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"     }),
  },
  shadow: {
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  },
};

// ─── Helpers ─────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  GN:"🇬🇳", SN:"🇸🇳", ML:"🇲🇱", CI:"🇨🇮", BF:"🇧🇫",
  FR:"🇫🇷", GB:"🇬🇧", US:"🇺🇸", DE:"🇩🇪", BE:"🇧🇪",
  ES:"🇪🇸", IT:"🇮🇹", PT:"🇵🇹", NL:"🇳🇱", AT:"🇦🇹",
  NE:"🇳🇪", TG:"🇹🇬", MA:"🇲🇦", NG:"🇳🇬", CM:"🇨🇲",
};

function getFlag(country?: string): string {
  if (!country) return "🌍";
  const upper = country.toUpperCase().trim();
  if (upper.length === 2) return FLAG_MAP[upper] ?? "🌍";
  const cn = upper;
  if (cn.includes("GUIN") && !cn.includes("BISS")) return "🇬🇳";
  if (cn.includes("FRANC")) return "🇫🇷";
  if (cn.includes("SÉNÉG") || cn.includes("SENEG")) return "🇸🇳";
  if (cn.includes("MALI"))  return "🇲🇱";
  if (cn.includes("IVOIRE") || cn.includes("CÔTE")) return "🇨🇮";
  return "🌍";
}

function getCountryLabel(country?: string): string {
  if (!country) return "—";
  if (country.trim().length === 2) {
    const map: Record<string, string> = {
      GN:"Guinée", SN:"Sénégal", ML:"Mali", CI:"Côte d'Ivoire",
      FR:"France",  GB:"Royaume-Uni", US:"États-Unis", DE:"Allemagne",
      BE:"Belgique", NE:"Niger", TG:"Togo", MA:"Maroc", NG:"Nigéria",
      CM:"Cameroun", BF:"Burkina Faso",
    };
    return map[country.toUpperCase()] ?? country;
  }
  return country;
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName ?? "").trim()[0] ?? "";
  const l = (lastName  ?? "").trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

// ─── Status Badge ────────────────────────────────────────
function StatusBadge({ isSuspended, deletedAt }: { isSuspended: boolean; deletedAt?: string | null }) {
  if (deletedAt) return (
    <View style={[sb.pill, { backgroundColor: T.redLt, borderColor: `${T.red}30` }]}>
      <Ionicons name="trash-outline" size={9} color={T.red} />
      <Text style={[sb.txt, { color: T.red, fontFamily: T.font.sans }]}>SUPPRIMÉ</Text>
    </View>
  );
  if (isSuspended) return (
    <View style={[sb.pill, { backgroundColor: T.amberLt, borderColor: `${T.amber}30` }]}>
      <Ionicons name="pause-circle-outline" size={9} color={T.amber} />
      <Text style={[sb.txt, { color: T.amber, fontFamily: T.font.sans }]}>SUSPENDU</Text>
    </View>
  );
  return (
    <View style={[sb.pill, { backgroundColor: T.greenLt, borderColor: `${T.green}30` }]}>
      <Ionicons name="checkmark-circle-outline" size={9} color={T.green} />
      <Text style={[sb.txt, { color: T.green, fontFamily: T.font.sans }]}>ACTIF</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  txt:  { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const initials = getInitials(item.firstName, item.lastName);
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || "—";
  const flag     = getFlag(item.country);
  const country  = getCountryLabel(item.country);

  const wallets  = Array.isArray(item.wallets) ? item.wallets : [];
  const primary  = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance  = toNum(primary?.balance ?? 0);
  const currency = primary?.currency ?? item.primaryCurrency ?? "XOF";

  const COLORS = ["#1956F0", "#16A34A", "#D97706", "#7C3AED", "#0F766E", "#DC2626", "#F97316"];
  const avatarColor = COLORS[(initials.charCodeAt(0) || 0) % COLORS.length];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={cc.card} activeOpacity={1} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[cc.stripe, { backgroundColor: item.isSuspended ? T.amber : item.deletedAt ? T.red : T.orange }]} />
        <View style={cc.body}>
          {/* Ligne principale */}
          <View style={cc.row}>
            <View style={[cc.avatar, { backgroundColor: `${avatarColor}15`, borderColor: `${avatarColor}30` }]}>
              <Text style={[cc.avatarTxt, { color: avatarColor, fontFamily: T.font.display }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[cc.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{fullName}</Text>
              <Text style={[cc.contact, { fontFamily: T.font.mono }]} numberOfLines={1}>
                {item.phone ?? item.email ?? "—"}
              </Text>
            </View>
            <View style={cc.right}>
              <Text style={[cc.balance, { color: T.orange, fontFamily: T.font.display }]}>
                {fmt(balance, currency)}
              </Text>
              <Text style={[cc.currency, { color: T.orange, fontFamily: T.font.mono }]}>{currency}</Text>
            </View>
          </View>

          {/* Pied */}
          <View style={cc.foot}>
            <View style={cc.countryRow}>
              <Text style={{ fontSize: 13 }}>{flag}</Text>
              <Text style={[cc.countryTxt, { fontFamily: T.font.sans }]}>{country}</Text>
            </View>
            <View style={cc.footRight}>
              <StatusBadge isSuspended={!!item.isSuspended} deletedAt={item.deletedAt} />
              <View style={cc.chevronWrap}>
                <Ionicons name="chevron-forward" size={13} color={T.inkMuted} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cc = StyleSheet.create({
  card:       { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft },
  stripe:     { width: 4 },
  body:       { flex: 1, padding: 13, gap: 10 },
  row:        { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar:     { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  avatarTxt:  { fontSize: 15, fontWeight: "800" },
  name:       { fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 3 },
  contact:    { fontSize: 11, color: T.inkMuted, fontWeight: "600" },
  right:      { alignItems: "flex-end" },
  balance:    { fontSize: 15, fontWeight: "700" },
  currency:   { fontSize: 9, fontWeight: "900", marginTop: 2 },
  foot:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  countryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  countryTxt: { fontSize: 11, color: T.inkSub, fontWeight: "600" },
  footRight:  { flexDirection: "row", alignItems: "center", gap: 6 },
  chevronWrap:{ width: 24, height: 24, borderRadius: 7, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
});

// ─── Status Dropdown Modal ────────────────────────────────
function StatusDropdown({ visible, current, total, totalActive, totalSuspended, onSelect, onClose }: {
  visible: boolean;
  current: StatusFilter;
  total: number; totalActive: number; totalSuspended: number;
  onSelect: (v: StatusFilter) => void;
  onClose: () => void;
}) {
  const OPTIONS: { key: StatusFilter; label: string; icon: string; color: string; bg: string; count: number }[] = [
    { key: "ALL",       label: "Tous",      icon: "people-outline",            color: T.orange, bg: T.orangeLt, count: total         },
    { key: "ACTIVE",    label: "Actifs",    icon: "checkmark-circle-outline",  color: T.green,  bg: T.greenLt,  count: totalActive    },
    { key: "SUSPENDED", label: "Suspendus", icon: "pause-circle-outline",      color: T.amber,  bg: T.amberLt,  count: totalSuspended },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={onClose}>
        <View style={dd.sheet}>
          <View style={dd.handle} />
          <Text style={[dd.title, { fontFamily: T.font.display }]}>Filtrer par statut</Text>
          {OPTIONS.map((o) => {
            const isActive = current === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[dd.item, isActive && { backgroundColor: o.bg }]}
                onPress={() => { onSelect(o.key); onClose(); }}
                activeOpacity={0.8}
              >
                <View style={[dd.itemIconBox, { backgroundColor: isActive ? `${o.color}20` : T.pageBg }]}>
                  <Ionicons name={o.icon as any} size={17} color={isActive ? o.color : T.inkMuted} />
                </View>
                <Text style={[dd.itemLabel, { fontFamily: T.font.sans, color: isActive ? o.color : T.ink, fontWeight: isActive ? "800" : "600" }]}>
                  {o.label}
                </Text>
                <View style={[dd.itemCount, { backgroundColor: isActive ? `${o.color}15` : T.borderLt }]}>
                  <Text style={[dd.itemCountTxt, { color: isActive ? o.color : T.inkMuted, fontFamily: T.font.mono }]}>
                    {o.count}
                  </Text>
                </View>
                {isActive && <Ionicons name="checkmark" size={16} color={o.color} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 28 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Country Dropdown Modal ───────────────────────────────
function CountryDropdown({ visible, current, countries, clients, onSelect, onClose }: {
  visible: boolean;
  current: string;
  countries: string[];
  clients: any[];
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[dd.sheet, { maxHeight: "70%" }]}>
          <View style={dd.handle} />
          <Text style={[dd.title, { fontFamily: T.font.display }]}>Filtrer par pays</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            {/* Tous pays */}
            {(() => {
              const isActive = current === "ALL";
              return (
                <TouchableOpacity
                  style={[dd.item, isActive && { backgroundColor: T.blueLt }]}
                  onPress={() => { onSelect("ALL"); onClose(); }}
                  activeOpacity={0.8}
                >
                  <View style={[dd.itemIconBox, { backgroundColor: isActive ? `${T.blue}20` : T.pageBg }]}>
                    <Text style={{ fontSize: 18 }}>🌍</Text>
                  </View>
                  <Text style={[dd.itemLabel, { fontFamily: T.font.sans, color: isActive ? T.blue : T.ink, fontWeight: isActive ? "800" : "600" }]}>
                    Tous pays
                  </Text>
                  <View style={[dd.itemCount, { backgroundColor: isActive ? `${T.blue}15` : T.borderLt }]}>
                    <Text style={[dd.itemCountTxt, { color: isActive ? T.blue : T.inkMuted, fontFamily: T.font.mono }]}>
                      {clients.length}
                    </Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={16} color={T.blue} />}
                </TouchableOpacity>
              );
            })()}

            {/* Un pays par option */}
            {countries.map((country) => {
              const isActive = current === country;
              const count    = clients.filter((c) => c.country === country).length;
              return (
                <TouchableOpacity
                  key={country}
                  style={[dd.item, isActive && { backgroundColor: T.blueLt }]}
                  onPress={() => { onSelect(isActive ? "ALL" : country); onClose(); }}
                  activeOpacity={0.8}
                >
                  <View style={[dd.itemIconBox, { backgroundColor: isActive ? `${T.blue}20` : T.pageBg }]}>
                    <Text style={{ fontSize: 18 }}>{getFlag(country)}</Text>
                  </View>
                  <Text style={[dd.itemLabel, { fontFamily: T.font.sans, color: isActive ? T.blue : T.ink, fontWeight: isActive ? "800" : "600" }]}>
                    {getCountryLabel(country)}
                  </Text>
                  <View style={[dd.itemCount, { backgroundColor: isActive ? `${T.blue}15` : T.borderLt }]}>
                    <Text style={[dd.itemCountTxt, { color: isActive ? T.blue : T.inkMuted, fontFamily: T.font.mono }]}>
                      {count}
                    </Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={16} color={T.blue} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Dropdown shared styles ───────────────────────────────
const dd = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 0 },
  handle:       { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  title:        { fontSize: 18, fontWeight: "700", color: T.ink, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.borderLt, marginBottom: 8 },
  item:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4 },
  itemIconBox:  { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemLabel:    { flex: 1, fontSize: 15 },
  itemCount:    { minWidth: 28, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: "center" },
  itemCountTxt: { fontSize: 12, fontWeight: "900" },
});

// ─── Main Screen ─────────────────────────────────────────
export default function WalletClientsScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [clients,         setClients]         = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [q,               setQ]               = useState("");
  const [countryFilter,   setCountryFilter]   = useState("ALL");
  const [statusFilter,    setStatusFilter]    = useState<StatusFilter>("ALL");
  const [showStatusDrop,  setShowStatusDrop]  = useState(false);
  const [showCountryDrop, setShowCountryDrop] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Chargement ─────────────────────────────────────────
  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const data = await api.getUsers();
      const arr  = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const walletClients = arr.filter((u: any) => u.role === "USER" || !u.role);
      setClients(walletClients);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error("loadClients", e); }
    finally { setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { void loadClients(); }, [loadClients]));

  // ── Pays disponibles ──────────────────────────────────
  const countries: string[] = React.useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => { if (c.country) set.add(c.country); });
    return Array.from(set).sort();
  }, [clients]);

  // ── Compteurs ─────────────────────────────────────────
  const totalActive    = clients.filter((c) => !c.isSuspended && !c.deletedAt).length;
  const totalSuspended = clients.filter((c) =>  c.isSuspended && !c.deletedAt).length;

  // ── Filtrage ──────────────────────────────────────────
  const filtered = React.useMemo(() => {
    return clients.filter((c) => {
      if (countryFilter !== "ALL" && c.country !== countryFilter) return false;
      if (statusFilter === "ACTIVE"    && (c.isSuspended || c.deletedAt)) return false;
      if (statusFilter === "SUSPENDED" && !c.isSuspended)                  return false;
      if (q.trim()) {
        const sq   = q.toLowerCase();
        const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
        return name.includes(sq)
          || (c.email ?? "").toLowerCase().includes(sq)
          || (c.phone ?? "").includes(sq);
      }
      return true;
    });
  }, [clients, countryFilter, statusFilter, q]);

  // ── Labels des boutons dropdown ───────────────────────
  const statusLabel = statusFilter === "ALL" ? "Tous" : statusFilter === "ACTIVE" ? "Actifs" : "Suspendus";
  const statusColor = statusFilter === "ACTIVE" ? T.green : statusFilter === "SUSPENDED" ? T.amber : T.orange;
  const countryLabel = countryFilter === "ALL" ? "Tous pays" : getCountryLabel(countryFilter);
  const countryFlag  = countryFilter === "ALL" ? "🌍" : getFlag(countryFilter);
  const statusCount  = statusFilter === "ALL" ? clients.length : statusFilter === "ACTIVE" ? totalActive : totalSuspended;
  const countryCount = countryFilter === "ALL" ? clients.length : clients.filter(c => c.country === countryFilter).length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Clients Wallet</Text>
          <Text style={[s.headerSub,   { fontFamily: T.font.sans }]}>
            {filtered.length} client{filtered.length > 1 ? "s" : ""}
            {totalSuspended > 0 ? ` · ${totalSuspended} suspendu${totalSuspended > 1 ? "s" : ""}` : ""}
          </Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: `${T.orange}12` }]} onPress={() => void loadClients()}>
          <Ionicons name="refresh" size={19} color={T.orange} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={T.inkMuted} />
        <TextInput
          style={[s.searchInput, { fontFamily: T.font.sans }]}
          value={q} onChangeText={setQ}
          placeholder="Nom, téléphone, email..."
          placeholderTextColor={T.inkMuted}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
            <Ionicons name="close" size={13} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── ✅ v1.1 : Barre de filtres dropdown ── */}
      <View style={s.filterBar}>
        {/* Statut dropdown */}
        <TouchableOpacity
          style={[s.dropBtn, statusFilter !== "ALL" && { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}08` }]}
          onPress={() => setShowStatusDrop(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={statusFilter === "ACTIVE" ? "checkmark-circle-outline" : statusFilter === "SUSPENDED" ? "pause-circle-outline" : "people-outline"}
            size={15} color={statusColor}
          />
          <Text style={[s.dropBtnTxt, { fontFamily: T.font.sans, color: statusFilter !== "ALL" ? statusColor : T.inkSub }]}>
            {statusLabel}
          </Text>
          <View style={[s.dropBtnCount, { backgroundColor: `${statusColor}12` }]}>
            <Text style={[s.dropBtnCountTxt, { color: statusColor, fontFamily: T.font.mono }]}>
              {statusCount}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={12} color={T.inkMuted} />
        </TouchableOpacity>

        {/* Pays dropdown */}
        <TouchableOpacity
          style={[s.dropBtn, countryFilter !== "ALL" && { borderColor: `${T.blue}40`, backgroundColor: T.blueLt }]}
          onPress={() => setShowCountryDrop(true)}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 14 }}>{countryFlag}</Text>
          <Text style={[s.dropBtnTxt, { fontFamily: T.font.sans, color: countryFilter !== "ALL" ? T.blue : T.inkSub }]} numberOfLines={1}>
            {countryLabel}
          </Text>
          <View style={[s.dropBtnCount, { backgroundColor: countryFilter !== "ALL" ? `${T.blue}12` : T.borderLt }]}>
            <Text style={[s.dropBtnCountTxt, { color: countryFilter !== "ALL" ? T.blue : T.inkMuted, fontFamily: T.font.mono }]}>
              {countryCount}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={12} color={T.inkMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Liste ── */}
      {/* ✅ v1.1 FIX : flex:1 ajouté → élimine l'espace vide entre filtres et cards */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={T.orange} size="large" />
          <Text style={[{ color: T.inkMuted, marginTop: 12, fontSize: 13, fontFamily: T.font.sans }]}>
            Chargement des clients…
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          style={{ flex: 1, opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              onPress={() => router.push({
                pathname: "/(tabs)/admin/wallet-client-detail" as any,
                params: { id: item.id },
              })}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun client trouvé</Text>
              <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                {q || countryFilter !== "ALL" || statusFilter !== "ALL"
                  ? "Essayez d'autres filtres"
                  : "Aucun client wallet enregistré"}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* ── Modals dropdown ── */}
      <StatusDropdown
        visible={showStatusDrop}
        current={statusFilter}
        total={clients.length}
        totalActive={totalActive}
        totalSuspended={totalSuspended}
        onSelect={setStatusFilter}
        onClose={() => setShowStatusDrop(false)}
      />
      <CountryDropdown
        visible={showCountryDrop}
        current={countryFilter}
        countries={countries}
        clients={clients}
        onSelect={setCountryFilter}
        onClose={() => setShowCountryDrop(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 8,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.ink, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", color: T.inkSub, marginTop: 2 },
  iconBtn:     { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    margin: 14, marginBottom: 10,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10,
    ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink, fontWeight: "600" },
  clearBtn:    { width: 24, height: 24, borderRadius: 7, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },

  // ✅ v1.1 : barre 2 dropdowns côte à côte
  filterBar: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  dropBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 10,
    ...T.shadow.soft,
  },
  dropBtnTxt:      { flex: 1, fontSize: 12, fontWeight: "700", color: T.inkSub },
  dropBtnCount:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 22, alignItems: "center" },
  dropBtnCountTxt: { fontSize: 10, fontWeight: "900" },

  // ✅ v1.1 FIX : loadingWrap avec flex:1 pour occuper l'espace
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  list:     { padding: 14, paddingTop: 4 },
  empty:    { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTxt: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 13, fontWeight: "600" },
});