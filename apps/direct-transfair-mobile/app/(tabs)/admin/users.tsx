// apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
// =========================================================
// ADMIN USERS v6.0 — Direct Transf'air · SuperAdmin
// ✅ Arborescence : Sociétés → (clic) → Admins + infos
//                  → Agences → Clients
// ✅ Bouton + supprimé (SuperAdmin n'en a pas besoin)
// ✅ Thème clair violet/bleu — cohérent avec le dashboard
// =========================================================

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Platform,
  StatusBar, Animated, ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Design Tokens ────────────────────────────────────────
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
  inkMid:   "#374151",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",

  white: "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius: 12,
      elevation: 5,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

// ─── Types de navigation ──────────────────────────────────
type ViewMode = "companies" | "company_detail";

// ─── Helpers ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    T.green,
  INACTIVE:  T.red,
  SUSPENDED: T.amber,
  EXPIRED:   T.red,
  TRIAL:     T.purple,
};

const ROLE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  SUPER_ADMIN:   { color: T.amber,  bg: T.amberLt,  label: "Super Admin" },
  COMPANY_ADMIN: { color: T.blue,   bg: T.blueLt,   label: "Admin Société" },
  AGENT:         { color: T.amber,  bg: T.amberLt,  label: "Agent" },
  USER:          { color: T.green,  bg: T.greenLt,  label: "Client" },
};

function initials(str: string): string {
  return (str ?? "?")[0].toUpperCase();
}

// ─── Section Header ───────────────────────────────────────
function SH({ dot, label, count }: { dot: string; label: string; count?: number }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {count !== undefined && (
        <View style={[shS.pill, { backgroundColor: dot + "18" }]}>
          <Text style={[shS.pillTxt, { color: dot, fontFamily: T.font.mono }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}
const shS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot:    { width: 6, height: 6, borderRadius: 99 },
  label:  { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
  pill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillTxt:{ fontSize: 10, fontWeight: "900" },
});

// ─── Company Card (vue liste) ─────────────────────────────
function CompanyCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const statusColor = STATUS_COLORS[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  const adminCount  = (item.users ?? []).filter((u: any) => u.role === "COMPANY_ADMIN").length;
  const agencyCount = (item.agencies ?? []).length;
  const clientCount = (item.users ?? []).filter((u: any) => u.role === "USER").length;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ccS.card}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,  useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre top colorée */}
        <View style={[ccS.topBar, { backgroundColor: statusColor }]} />

        <View style={ccS.inner}>
          {/* Avatar + infos */}
          <View style={ccS.topRow}>
            <View style={ccS.avatar}>
              <Text style={[ccS.avatarLetter, { fontFamily: T.font.display }]}>
                {initials(item.name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[ccS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={ccS.metaRow}>
                <Text style={[ccS.code, { fontFamily: T.font.mono }]}>{item.code}</Text>
                <View style={[ccS.statusPill, {
                  backgroundColor: statusColor + "14",
                  borderColor: statusColor + "30",
                }]}>
                  <View style={[ccS.dot, { backgroundColor: statusColor }]} />
                  <Text style={[ccS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
                    {item.subscriptionStatus}
                  </Text>
                </View>
              </View>
            </View>
            <View style={ccS.chevronBox}>
              <Ionicons name="chevron-forward" size={13} color={T.blue} />
            </View>
          </View>

          {/* Compteurs */}
          <View style={ccS.counters}>
            <CounterPill icon="person-outline"   color={T.blue}   bg={T.blueLt}   value={adminCount}  label="Admins" />
            <CounterPill icon="business-outline" color={T.purple} bg={T.purpleLt} value={agencyCount} label="Agences" />
            <CounterPill icon="people-outline"   color={T.green}  bg={T.greenLt}  value={clientCount} label="Clients" />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CounterPill({ icon, color, bg, value, label }: {
  icon: string; color: string; bg: string; value: number; label: string;
}) {
  return (
    <View style={[cpS.pill, { backgroundColor: bg, borderColor: color + "25" }]}>
      <Ionicons name={icon as any} size={11} color={color} />
      <Text style={[cpS.val, { color, fontFamily: T.font.mono }]}>{value}</Text>
      <Text style={[cpS.lbl, { color, fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const cpS = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: "center",
  },
  val: { fontSize: 12, fontWeight: "800" },
  lbl: { fontSize: 9, fontWeight: "700" },
});

const ccS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 10, overflow: "hidden", ...T.shadow.card,
  },
  topBar: { height: 3 },
  inner:  { padding: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd,
    justifyContent: "center", alignItems: "center",
  },
  avatarLetter: { fontSize: 19, fontWeight: "700", color: T.blue },
  name:   { fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 4 },
  metaRow:{ flexDirection: "row", alignItems: "center", gap: 7 },
  code:   { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  dot:    { width: 4, height: 4, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "800" },
  chevronBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.blueLt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.blueMd },
  counters: { flexDirection: "row", gap: 7 },
});

// ─── User Row (admin / agent / client) ───────────────────
function UserRow({ item }: { item: any }) {
  const roleCfg = ROLE_CONFIG[item.role] ?? { color: T.inkMuted, bg: T.borderLt, label: item.role };
  return (
    <View style={urS.row}>
      <View style={[urS.avatar, { backgroundColor: roleCfg.bg }]}>
        <Text style={[urS.avatarTxt, { color: roleCfg.color, fontFamily: T.font.display }]}>
          {initials(item.firstName ?? item.email ?? "?")}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[urS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {item.firstName ?? ""} {item.lastName ?? ""}
        </Text>
        <Text style={[urS.email, { fontFamily: T.font.subtitle }]} numberOfLines={1}>
          {item.email}
        </Text>
      </View>
      <View style={[urS.rolePill, { backgroundColor: roleCfg.bg }]}>
        <Text style={[urS.roleText, { color: roleCfg.color, fontFamily: T.font.sans }]}>
          {roleCfg.label}
        </Text>
      </View>
    </View>
  );
}
const urS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: T.borderLt,
  },
  avatar: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 15, fontWeight: "700" },
  name:  { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  email: { fontSize: 10, color: T.inkSub },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── Agency Row ───────────────────────────────────────────
function AgencyRow({ item }: { item: any }) {
  const isActive  = item.isActive;
  const agentCount = (item.agents ?? []).length;
  return (
    <View style={arS.row}>
      <View style={[arS.iconBox, { backgroundColor: isActive ? T.tealLt : T.redLt }]}>
        <Ionicons name="business-outline" size={15} color={isActive ? T.teal : T.red} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[arS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[arS.city, { fontFamily: T.font.subtitle }]}>
          {item.city ?? "—"}  ·  {item.country ?? "—"}
        </Text>
      </View>
      <View style={arS.right}>
        <View style={[arS.statusDot, { backgroundColor: isActive ? T.green : T.red }]} />
        {agentCount > 0 && (
          <View style={[arS.agentPill, { backgroundColor: T.amberLt }]}>
            <Text style={[arS.agentTxt, { color: T.amber, fontFamily: T.font.mono }]}>
              {agentCount} agent{agentCount > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
const arS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: T.borderLt,
  },
  iconBox:    { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  name:       { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  city:       { fontSize: 10, color: T.inkSub },
  right:      { alignItems: "flex-end", gap: 4 },
  statusDot:  { width: 7, height: 7, borderRadius: 99 },
  agentPill:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  agentTxt:   { fontSize: 9, fontWeight: "800" },
});

// ─── Collapsible Section ──────────────────────────────────
function CollapsibleSection({
  dot, label, count, children, defaultOpen = false,
}: {
  dot: string; label: string; count: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rotAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toVal = open ? 0 : 1;
    setOpen(!open);
    Animated.spring(rotAnim, { toValue: toVal, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  };

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View style={csS.wrapper}>
      <TouchableOpacity style={csS.header} onPress={toggle} activeOpacity={0.8}>
        <View style={[csS.dot, { backgroundColor: dot }]} />
        <Text style={[csS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <View style={[csS.countPill, { backgroundColor: dot + "18" }]}>
          <Text style={[csS.countTxt, { color: dot, fontFamily: T.font.mono }]}>{count}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-forward" size={14} color={T.inkMuted} />
        </Animated.View>
      </TouchableOpacity>
      {open && <View style={csS.body}>{children}</View>}
    </View>
  );
}
const csS = StyleSheet.create({
  wrapper: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 12, overflow: "hidden", ...T.shadow.soft,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 0,
  },
  dot:       { width: 6, height: 6, borderRadius: 99 },
  label:     { flex: 1, fontSize: 11, fontWeight: "800", color: T.ink, letterSpacing: 0.3 },
  countPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginRight: 4 },
  countTxt:  { fontSize: 10, fontWeight: "900" },
  body:      { borderTopWidth: 1, borderTopColor: T.borderLt },
});

// ─── Info Row ─────────────────────────────────────────────
function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={irS.row}>
      {icon && (
        <View style={irS.iconBox}>
          <Ionicons name={icon as any} size={13} color={T.inkMuted} />
        </View>
      )}
      <Text style={[irS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[irS.value, { fontFamily: T.font.mono }]} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}
const irS = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  iconBox: { width: 20, justifyContent: "center", alignItems: "center" },
  label:   { flex: 1, fontSize: 11, color: T.inkSub, fontWeight: "600" },
  value:   { fontSize: 11, color: T.ink, fontWeight: "700", maxWidth: "55%" },
});

// ─── Company Detail View ──────────────────────────────────
function CompanyDetailView({
  company,
  onBack,
}: {
  company: any;
  onBack: () => void;
}) {
  const statusColor  = STATUS_COLORS[company.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  const admins       = (company.users ?? []).filter((u: any) => u.role === "COMPANY_ADMIN");
  const agents       = (company.users ?? []).filter((u: any) => u.role === "AGENT");
  const clients      = (company.users ?? []).filter((u: any) => u.role === "USER");
  const agencies     = company.agencies ?? [];

  return (
    <View style={{ flex: 1 }}>
      {/* Header détail */}
      <View style={dvS.header}>
        <TouchableOpacity style={dvS.backBtn} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[dvS.title, { fontFamily: T.font.display }]} numberOfLines={1}>
            {company.name}
          </Text>
          <View style={dvS.metaRow}>
            <Text style={[dvS.code, { fontFamily: T.font.mono }]}>{company.code}</Text>
            <View style={[dvS.statusPill, {
              backgroundColor: statusColor + "14",
              borderColor: statusColor + "30",
            }]}>
              <View style={[dvS.dot, { backgroundColor: statusColor }]} />
              <Text style={[dvS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
                {company.subscriptionStatus}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: T.pageBg }}
        contentContainerStyle={dvS.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Infos société ── */}
        <SH dot={T.blue} label="INFORMATIONS SOCIÉTÉ" />
        <View style={dvS.infoCard}>
          <InfoRow icon="mail-outline"     label="Email"        value={company.email ?? company.contactEmail} />
          <InfoRow icon="call-outline"     label="Téléphone"    value={company.phone ?? company.contactPhone} />
          <InfoRow icon="globe-outline"    label="Pays"         value={company.country} />
          <InfoRow icon="location-outline" label="Ville"        value={company.city} />
          <InfoRow icon="briefcase-outline"label="Secteur"      value={company.activitySector} />
          <InfoRow icon="repeat-outline"   label="Contrat"      value={company.subscriptionType} />
          <InfoRow icon="calendar-outline" label="Début"
            value={company.subscriptionStart
              ? new Date(company.subscriptionStart).toLocaleDateString("fr-FR")
              : "—"
            }
          />
          <InfoRow icon="calendar-outline" label="Fin"
            value={company.subscriptionEnd
              ? new Date(company.subscriptionEnd).toLocaleDateString("fr-FR")
              : "—"
            }
          />
        </View>

        {/* ── Admins société ── */}
        <CollapsibleSection
          dot={T.blue}
          label="ADMINS SOCIÉTÉ"
          count={admins.length}
          defaultOpen
        >
          {admins.length === 0
            ? <EmptyInline text="Aucun admin" />
            : admins.map((u: any) => <UserRow key={u.id} item={u} />)
          }
        </CollapsibleSection>

        {/* ── Agences ── */}
        <CollapsibleSection
          dot={T.teal}
          label="AGENCES"
          count={agencies.length}
          defaultOpen
        >
          {agencies.length === 0
            ? <EmptyInline text="Aucune agence" />
            : agencies.map((a: any) => <AgencyRow key={a.id} item={a} />)
          }
        </CollapsibleSection>

        {/* ── Agents ── */}
        <CollapsibleSection
          dot={T.amber}
          label="AGENTS"
          count={agents.length}
        >
          {agents.length === 0
            ? <EmptyInline text="Aucun agent" />
            : agents.map((u: any) => <UserRow key={u.id} item={u} />)
          }
        </CollapsibleSection>

        {/* ── Clients ── */}
        <CollapsibleSection
          dot={T.green}
          label="CLIENTS"
          count={clients.length}
        >
          {clients.length === 0
            ? <EmptyInline text="Aucun client" />
            : clients.map((u: any) => <UserRow key={u.id} item={u} />)
          }
        </CollapsibleSection>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View style={eiS.wrap}>
      <Ionicons name="ellipse-outline" size={14} color={T.inkMuted} />
      <Text style={[eiS.txt, { fontFamily: T.font.sans }]}>{text}</Text>
    </View>
  );
}
const eiS = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  txt:  { fontSize: 11, color: T.inkMuted, fontWeight: "600" },
});

const dvS = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: T.ink, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  code: { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  dot:       { width: 4, height: 4, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "800" },
  scroll:    { paddingHorizontal: 18, paddingTop: 18 },
  infoCard:  {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 18, overflow: "hidden", ...T.shadow.soft,
  },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AdminUsersScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [companies,   setCompanies]   = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [q,           setQ]           = useState("");
  const [viewMode,    setViewMode]    = useState<ViewMode>("companies");
  const [selected,    setSelected]    = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadCompanies = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      // On charge les sociétés avec leurs users et agences inclus
      const raw = await api.getClients().catch(() => []);
      const list = Array.isArray(raw) ? raw : ((raw as any)?.data ?? []);
      setCompanies(list);
      Animated.spring(fadeAnim, {
        toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3,
      }).start();
    } catch (e) {
      console.error("Users load error", e);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCompanies("init");
    return () => {};
  }, [loadCompanies]));

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return companies;
    return companies.filter((c) =>
      `${c.name} ${c.code} ${c.subscriptionStatus}`.toLowerCase().includes(n)
    );
  }, [companies, q]);

  // ─── Vue détail société ───────────────────────────────
  if (viewMode === "company_detail" && selected) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={T.surface} />
        <CompanyDetailView
          company={selected}
          onBack={() => {
            setViewMode("companies");
            setSelected(null);
          }}
        />
      </SafeAreaView>
    );
  }

  // ─── Vue liste des sociétés ───────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />

      {/* Header — ✅ SANS bouton + */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Utilisateurs</Text>
          <Text style={[s.headerSub, { color: T.blue, fontFamily: T.font.sans }]}>
            {filtered.length} société{filtered.length > 1 ? "s" : ""}
          </Text>
        </View>
        {/* ✅ Bouton + supprimé — remplacé par refresh */}
        <TouchableOpacity
          style={[s.refreshBtn]}
          onPress={() => void loadCompanies("refresh")}
        >
          <Ionicons name="refresh" size={18} color={T.blue} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={15} color={T.inkMuted} />
        <TextInput
          style={[s.searchInput, { fontFamily: T.font.sans }]}
          value={q}
          onChangeText={setQ}
          placeholder="Nom ou code société..."
          placeholderTextColor={T.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
            <Ionicons name="close" size={12} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Hint */}
      <View style={s.hintRow}>
        <Ionicons name="information-circle-outline" size={13} color={T.blue} />
        <Text style={[s.hintTxt, { fontFamily: T.font.sans }]}>
          Appuyez sur une société pour voir ses admins, agences et clients
        </Text>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={T.blue} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={() => void loadCompanies("refresh")}
          refreshing={refreshing}
          ListHeaderComponent={
            <View style={{ marginBottom: 4 }}>
              <SH dot={T.blue} label="SOCIÉTÉS SAAS" count={filtered.length} />
            </View>
          }
          renderItem={({ item }) => (
            <CompanyCard
              item={item}
              onPress={() => {
                setSelected(item);
                setViewMode("company_detail");
              }}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: T.blueLt }]}>
                <Ionicons name="business-outline" size={28} color={T.blue} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucune société trouvée</Text>
              <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>
                Modifiez votre recherche
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: T.ink },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
  },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    marginHorizontal: 18, marginTop: 14, marginBottom: 0,
    paddingHorizontal: 13, height: 46,
    borderWidth: 1, borderColor: T.border, gap: 8,
    ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  clearBtn: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center",
  },

  hintRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 18, marginTop: 10, marginBottom: 2,
  },
  hintTxt: { fontSize: 10, color: T.blue, fontWeight: "600", flex: 1, lineHeight: 14 },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  list:   { paddingHorizontal: 18, paddingTop: 14 },

  empty:      { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.blueMd },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: T.ink },
  emptySub:   { fontSize: 12, color: T.inkMuted, textAlign: "center" },
});