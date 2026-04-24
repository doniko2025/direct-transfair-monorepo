// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
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
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const IS_WEB = Platform.OS === "web";

// ─── THÈMES & TYPOGRAPHIES ──────────────────────────────────────────────
const THEMES = {
  SUPER_ADMIN: { primary: "#7F1D1D", light: "#FEF2F2", text: "#450A0A" },
  COMPANY_ADMIN: { primary: "#1E3A8A", light: "#EFF6FF", text: "#1E3A8A" },
};

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F8FAFC",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  value: { fontSize: 26, fontFamily: FONTS.heading, fontWeight: "800", marginBottom: 2 },
  label: { fontSize: 11, fontFamily: FONTS.body, color: "#64748B", fontWeight: "700", letterSpacing: 0.5 },
});

// ─── Quick Action Card (Grille 2x2) ─────────────────────────────────────────
function QuickActionCard({ action }: { action: any }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], width: '48%', marginBottom: 16 }}>
      <TouchableOpacity
        onPress={action.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        style={[quickStyles.card, { borderColor: `${action.color}30` }]}
      >
        <View style={[quickStyles.iconWrap, { backgroundColor: `${action.color}15` }]}>
          <Ionicons name={action.icon as any} size={24} color={action.color} />
        </View>
        <Text style={quickStyles.title} numberOfLines={1} adjustsFontSizeToFit>{action.title}</Text>
        <Text style={quickStyles.sub} numberOfLines={1}>{action.subtitle}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const quickStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: "#1E293B", marginBottom: 4, textAlign: "center" },
  sub: { fontSize: 12, fontFamily: FONTS.body, color: "#94A3B8", fontWeight: "600", textAlign: "center" },
});

// ─── Helpers ─────────────────────────────────────────────────────────────
const getStatusColor = (status: string) => {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "#10B981";
  if (s === "SUSPENDED") return "#F59E0B";
  if (s === "INACTIVE" || s === "EXPIRED") return "#EF4444";
  return "#64748B";
};

// ─── Client Row Card ─────────────────────────────────────────────────────────
function ClientCard({ item, onPress, themePrimary }: { item: any; onPress: () => void; themePrimary: string }) {
  const dot = getStatusColor(item.subscriptionStatus);

  return (
    <TouchableOpacity style={clientStyles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[clientStyles.avatar, { backgroundColor: `${themePrimary}15` }]}>
        <Ionicons name="business" size={26} color={themePrimary} />
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={clientStyles.name} numberOfLines={1}>{item.name}</Text>
        <View style={clientStyles.metaRow}>
          <Text style={clientStyles.code}>{item.code}</Text>
          <View style={[clientStyles.pill, { backgroundColor: `${dot}15` }]}>
            <View style={[clientStyles.pillDot, { backgroundColor: dot }]} />
            <Text style={[clientStyles.pillText, { color: dot }]}>{item.subscriptionStatus}</Text>
          </View>
        </View>
      </View>

      <View style={clientStyles.rightSide}>
        <View style={[clientStyles.pill, { backgroundColor: "#F1F5F9", marginBottom: 6 }]}>
          <Text style={[clientStyles.pillText, { color: "#64748B" }]}>
            {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );
}

const clientStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F8FAFC",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  name: { fontSize: 17, fontFamily: FONTS.heading, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  code: { fontSize: 12, fontFamily: FONTS.body, color: "#64748B", fontWeight: "800", letterSpacing: 0.5 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontFamily: FONTS.body, fontWeight: "800", letterSpacing: 0.5 },
  rightSide: { alignItems: "flex-end", justifyContent: "space-between" },
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  
  const role = user?.role || "SUPER_ADMIN";
  const theme = THEMES[role as keyof typeof THEMES] || THEMES.SUPER_ADMIN;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const headerTopPadding = useMemo(() => {
    if (Platform.OS === "android") return (StatusBar.currentHeight ?? 0) + 16;
    if (IS_WEB) return 24;
    return 16;
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const raw = await api.getClients();
      
      // ✅ COURT-CIRCUIT : On bypass les utilitaires qui filtrent silencieusement
      let list = Array.isArray(raw) ? raw : (raw as any)?.data;
      if (!Array.isArray(list)) list = [];

      const formatted = list.map((c: any) => ({
        id: c.id?.toString(),
        name: c.name || "Client Sans Nom",
        code: c.code || "N/A",
        subscriptionStatus: c.subscriptionStatus || c.status || "ACTIVE",
        subscriptionType: c.subscriptionType || "RENTAL",
        ...c
      }));

      setClients(formatted);
      
    } catch (e: any) {
      console.error(e);
      Alert.alert("Erreur réseau", e?.response?.data?.message || "Impossible de charger les sociétés.");
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
      `${c.name} ${c.code} ${c.subscriptionStatus} ${c.subscriptionType}`.toLowerCase().includes(n)
    );
  }, [clients, q]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => (c.subscriptionStatus || "").toUpperCase() === "ACTIVE").length;
    return { total, active, inactive: total - active };
  }, [clients]);

  const actions = useMemo(() => [
    { title: "Trésorerie", subtitle: "Supervision globale", icon: "wallet", color: "#3B82F6", onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux & Devises", subtitle: "Gestion de change", icon: "trending-up", color: "#8B5CF6", onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Transactions", subtitle: "Audit temps réel", icon: "analytics", color: "#10B981", onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs", subtitle: "Comptes & Accès", icon: "people", color: "#F59E0B", onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  const handleAddSociety = useCallback(() => {
    if (!isSuperAdmin) return Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
    setCreateOpen(true);
  }, [isSuperAdmin]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={theme.primary} barStyle="light-content" />
      
      <View style={s.screen}>
        {/* ── Header coloré ── */}
        <View style={[s.header, { paddingTop: headerTopPadding, backgroundColor: theme.primary }]}>
          <View style={{ flex: 1 }}>
            <View style={s.headerBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FCD34D" />
              <Text style={s.headerBadgeText}>{role.replace("_", " ")}</Text>
            </View>
            <Text style={s.headerTitle}>Super Console</Text>
            <Text style={s.headerSub}>
              {user?.firstName ? `${user.firstName} · ` : ""}Direct Transf'air Cloud
            </Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => void loadData("refresh")}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
              <Ionicons name="notifications" size={22} color="#FFF" />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Contenu Scrollable ── */}
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              themePrimary={theme.primary}
              onPress={() => router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={theme.primary}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Stats row */}
              <View style={s.statsRow}>
                <StatCard label="SOCIÉTÉS" value={stats.total} color="#3B82F6" icon="business" />
                <StatCard label="ACTIVES" value={stats.active} color="#10B981" icon="checkmark-circle" />
                <StatCard label="INACTIVES" value={stats.inactive} color="#EF4444" icon="close-circle" />
              </View>

              {/* Quick actions (Grille 2x2 Premium) */}
              <Text style={s.sectionLabel}>PILOTAGE RÉSEAU</Text>
              <View style={s.actionsGrid}>
                {actions.map((a, i) => (
                  <QuickActionCard key={a.title} action={a} />
                ))}
              </View>

              {/* Search */}
              <View style={s.searchRow}>
                <Ionicons name="search" size={22} color="#94A3B8" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor="#94A3B8"
                  style={s.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section title + Add */}
              <View style={s.sectionRow}>
                <Text style={s.sectionLabel}>CLIENTS SAAS ({filtered.length})</Text>
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: theme.primary }, !isSuperAdmin && { opacity: 0.5 }]}
                  onPress={handleAddSociety}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loading && (
                <ActivityIndicator color={theme.primary} style={{ marginVertical: 30 }} size="large" />
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIconBg}>
                  <Ionicons name="business" size={48} color="#94A3B8" />
                </View>
                <Text style={s.emptyText}>Aucun client trouvé</Text>
                <Text style={s.emptySubtext}>Modifiez votre recherche ou ajoutez un nouveau client SaaS.</Text>
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
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  headerBadgeText: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "800", color: "#FCD34D", letterSpacing: 1 },
  headerTitle: { fontSize: 32, fontFamily: FONTS.heading, fontWeight: "700", color: "#FFF", marginBottom: 2 },
  headerSub: { fontSize: 14, fontFamily: FONTS.body, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 12, paddingBottom: 6 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFF",
  },

  list: { paddingHorizontal: 20, paddingTop: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 28 },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "900", color: "#64748B", letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 16 },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 10 },

  addBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },

  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 18, height: 60, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: "#F1F5F9" },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, fontFamily: FONTS.body, color: "#0F172A", fontWeight: "600" },
  clearBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 16 },
  emptyIconBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#1E293B", fontFamily: FONTS.heading, fontSize: 22, fontWeight: "700" },
  emptySubtext: { color: "#94A3B8", fontFamily: FONTS.body, fontSize: 14, textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
});