// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// SuperAdminDashboard.tsx
// components/dashboards/SuperAdminDashboard.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import {
  ClientSaas,
  QuickAction,
  normalizeClients,
  statusColor,
  statusLabel,
  subscriptionLabel,
} from "./SuperAdmin.utils";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WEB = Platform.OS === "web";

// ─── Palette tokens ────────────────────────────────────────────────────────
const C = {
  bg: "#080C14",
  surface: "#0F1623",
  surfaceHigh: "#141D2C",
  border: "rgba(255,255,255,0.07)",
  borderActive: "rgba(255,255,255,0.14)",
  accent: "#3B82F6",
  accentMid: "#60A5FA",
  accentSoft: "rgba(59,130,246,0.12)",
  success: "#10B981",
  successSoft: "rgba(16,185,129,0.12)",
  warning: "#F59E0B",
  warningSoft: "rgba(245,158,11,0.12)",
  danger: "#EF4444",
  dangerSoft: "rgba(239,68,68,0.12)",
  purple: "#8B5CF6",
  purpleSoft: "rgba(139,92,246,0.12)",
  text: "#F0F4FF",
  textMuted: "#8B95A8",
  textFaint: "#4A5568",
  gold: "#F7C948",
};

const ACTION_PALETTE = [
  { gradient: ["#1A2B4A", "#0F1E36"], icon: "#3B82F6", dot: C.accent },
  { gradient: ["#2A1A4A", "#1A0F36"], icon: "#8B5CF6", dot: C.purple },
  { gradient: ["#0D2B22", "#071A15"], icon: "#10B981", dot: C.success },
  { gradient: ["#2B1A0D", "#1A0F07"], icon: "#F59E0B", dot: C.warning },
];

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[statStyles.card, { borderColor: `${color}22` }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  value: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 10, color: C.textMuted, fontWeight: "700", letterSpacing: 0.8 },
});

// ─── Quick Action Card ───────────────────────────────────────────────────────
function QuickActionCard({ action, palette }: { action: QuickAction; palette: typeof ACTION_PALETTE[0] }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity
        onPress={action.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={quickStyles.card}
      >
        <View style={[quickStyles.iconWrap, { backgroundColor: `${palette.icon}18` }]}>
          <Ionicons name={action.icon as any} size={20} color={palette.icon} />
        </View>
        <Text style={quickStyles.title}>{action.title}</Text>
        {!!action.subtitle && <Text style={quickStyles.sub}>{action.subtitle}</Text>}
        <View style={[quickStyles.dot, { backgroundColor: palette.dot }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const quickStyles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 6,
    overflow: "hidden",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 13, fontWeight: "800", color: C.text },
  sub: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  dot: { position: "absolute", top: 12, right: 12, width: 6, height: 6, borderRadius: 3 },
});

// ─── Client Row Card ─────────────────────────────────────────────────────────
function ClientCard({ item, onPress }: { item: ClientSaas; onPress: () => void }) {
  const dot = statusColor(item.subscriptionStatus);
  const isActive = (item.subscriptionStatus ?? "").toUpperCase() === "ACTIVE";

  return (
    <TouchableOpacity style={clientStyles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Avatar */}
      <View style={[clientStyles.avatar, { backgroundColor: `${dot}18` }]}>
        <Text style={[clientStyles.avatarText, { color: dot }]}>
          {(item.name ?? "?")[0].toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={clientStyles.name} numberOfLines={1}>{item.name}</Text>
        <View style={clientStyles.metaRow}>
          <Text style={clientStyles.code}>{item.code}</Text>
          <View style={[clientStyles.pill, { backgroundColor: `${dot}18`, borderColor: `${dot}40` }]}>
            <View style={[clientStyles.pillDot, { backgroundColor: dot }]} />
            <Text style={[clientStyles.pillText, { color: dot }]}>{statusLabel(item.subscriptionStatus)}</Text>
          </View>
          <View style={[clientStyles.pill, { backgroundColor: C.surfaceHigh, borderColor: C.border }]}>
            <Text style={[clientStyles.pillText, { color: C.textMuted }]}>{subscriptionLabel(item.subscriptionType)}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={C.textFaint} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

const clientStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "900" },
  name: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  code: { fontSize: 11, color: C.textMuted, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  pillDot: { width: 5, height: 5, borderRadius: 99 },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = (user?.role ?? "") === "SUPER_ADMIN";

  const [clients, setClients] = useState<ClientSaas[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const headerTopPadding = useMemo(() => {
    if (Platform.OS === "android") return (StatusBar.currentHeight ?? 0) + 8;
    if (IS_WEB) return 16;
    return 8;
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const raw = await api.getClients();
      setClients(normalizeClients(raw).filter((c) => c.code !== "DONIKO"));
    } catch (e) {
      console.error(e);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData("init"); return () => {}; }, [loadData]));

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.code} ${c.subscriptionStatus ?? ""} ${c.subscriptionType ?? ""}`.toLowerCase().includes(n)
    );
  }, [clients, q]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => (c.subscriptionStatus ?? "").toUpperCase() === "ACTIVE").length;
    return { total, active, inactive: total - active };
  }, [clients]);

  const actions: QuickAction[] = useMemo(() => [
    { title: "Trésorerie", subtitle: "Global", icon: "wallet-outline", color: C.accent, onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux EUR", subtitle: "Change", icon: "trending-up-outline", color: C.purple, onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Transactions", subtitle: "Audit", icon: "analytics-outline", color: C.success, onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs", subtitle: "Comptes", icon: "people-outline", color: C.warning, onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  const handleAddSociety = useCallback(() => {
    if (!isSuperAdmin) return Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
    setCreateOpen(true);
  }, [isSuperAdmin]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={C.bg} barStyle="light-content" />
      <View style={s.screen}>

        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: headerTopPadding }]}>
          <View style={{ flex: 1 }}>
            <View style={s.headerBadge}>
              <Ionicons name="shield-checkmark" size={11} color={C.gold} />
              <Text style={s.headerBadgeText}>SUPER ADMIN</Text>
            </View>
            <Text style={s.headerTitle}>Super Console</Text>
            <Text style={s.headerSub}>
              {user?.firstName ? `${user.firstName} · ` : ""}Direct Transf'air Cloud
            </Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => void loadData("refresh")}>
              <Ionicons name="refresh-outline" size={18} color={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
              <Ionicons name="notifications-outline" size={18} color={C.textMuted} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scrollable content ── */}
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              onPress={() => router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={C.accent}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Stats row */}
              <View style={s.statsRow}>
                <StatCard label="SOCIÉTÉS" value={stats.total} color={C.accent} icon="business-outline" />
                <StatCard label="ACTIVES" value={stats.active} color={C.success} icon="checkmark-circle-outline" />
                <StatCard label="INACTIVES" value={stats.inactive} color={C.danger} icon="close-circle-outline" />
              </View>

              {/* Quick actions */}
              <Text style={s.sectionLabel}>PILOTAGE RÉSEAU</Text>
              <View style={s.actionsGrid}>
                {actions.map((a, i) => (
                  <QuickActionCard key={a.title} action={a} palette={ACTION_PALETTE[i]} />
                ))}
              </View>

              {/* Search */}
              <View style={s.searchRow}>
                <Ionicons name="search-outline" size={16} color={C.textMuted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Nom, code, statut…"
                  placeholderTextColor={C.textFaint}
                  style={s.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={14} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section title + Add */}
              <View style={s.sectionRow}>
                <Text style={s.sectionLabel}>CLIENTS SAAS</Text>
                <TouchableOpacity
                  style={[s.addBtn, !isSuperAdmin && { opacity: 0.4 }]}
                  onPress={handleAddSociety}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loading && (
                <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <Ionicons name="business-outline" size={40} color={C.textFaint} />
                <Text style={s.emptyText}>Aucun client SaaS trouvé</Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      </View>

      <CreateCompanyModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void loadData("refresh")}
        isSuperAdmin={isSuperAdmin}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(247,201,72,0.1)",
    borderWidth: 1,
    borderColor: "rgba(247,201,72,0.2)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  headerBadgeText: { fontSize: 9, fontWeight: "900", color: C.gold, letterSpacing: 1.2 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 2, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHigh,
    justifyContent: "center",
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: C.danger,
    borderWidth: 1.5,
    borderColor: C.bg,
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: C.textFaint,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 14,
  },

  // Actions grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  // Add button
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
  },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    fontWeight: "600",
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: C.textMuted, fontSize: 14, fontWeight: "700" },
});