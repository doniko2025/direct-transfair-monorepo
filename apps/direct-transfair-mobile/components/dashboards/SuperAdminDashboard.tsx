// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// SuperAdminDashboard.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, FlatList, ActivityIndicator, TextInput, RefreshControl, Alert, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

// Imports depuis les fichiers extraits
import { ClientSaas, QuickAction, normalizeClients, statusColor, statusLabel, subscriptionLabel } from "./SuperAdmin.utils";
import CreateCompanyModal from "./CreateCompanyModal";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = (user?.role ?? "") === "SUPER_ADMIN";

  const [clients, setClients] = useState<ClientSaas[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [q, setQ] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  const headerTopPadding = useMemo(() => {
    if (Platform.OS === "android") return (StatusBar.currentHeight ?? 0) + 10;
    if (Platform.OS === "web") return 18;
    return 12;
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const raw = await api.getClients();
      const normalized = normalizeClients(raw).filter((c) => c.code !== "DONIKO");
      setClients(normalized);
    } catch (e: unknown) {
      console.error("SuperAdminDashboard loadData error:", e);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData("init"); return () => {}; }, [loadData]));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => `${c.name} ${c.code} ${c.subscriptionStatus ?? ""} ${c.subscriptionType ?? ""}`.toLowerCase().includes(needle));
  }, [clients, q]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => (c.subscriptionStatus ?? "").toUpperCase() === "ACTIVE").length;
    return { total, active, inactive: total - active };
  }, [clients]);

  const actions: QuickAction[] = useMemo(() => [
    { title: "Trésorerie", subtitle: "Super admin", icon: "wallet-outline", color: "#10B981", onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux EUR", subtitle: "Change", icon: "trending-up-outline", color: "#8B5CF6", onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Audit Transac", subtitle: "Contrôle", icon: "analytics-outline", color: "#3B82F6", onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Gestion Users", subtitle: "Comptes", icon: "people-outline", color: "#64748B", onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  const handleAddNewSociety = useCallback(() => {
    if (!isSuperAdmin) return Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
    setCreateOpen(true);
  }, [isSuperAdmin]);

  const renderClientItem = useCallback(({ item }: { item: ClientSaas }) => {
    const dot = statusColor(item.subscriptionStatus);
    return (
      <TouchableOpacity style={styles.clientCard} onPress={() => router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })} activeOpacity={0.9}>
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.clientMeta} numberOfLines={1}>Code: <Text style={styles.clientMetaStrong}>{item.code}</Text></Text>
            <View style={[styles.badge, { borderColor: dot }]}><Text style={[styles.badgeText, { color: dot }]}>{statusLabel(item.subscriptionStatus)}</Text></View>
            <View style={[styles.badge, { borderColor: "#E2E8F0" }]}><Text style={[styles.badgeText, { color: "#334155" }]}>{subscriptionLabel(item.subscriptionType)}</Text></View>
          </View>
        </View>
        <View style={styles.cardActions}><Ionicons name="chevron-forward" size={18} color="#94A3B8" /></View>
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: headerTopPadding }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Super Console</Text>
            <Text style={styles.headerSubtitle}>Direct Transf’air Cloud • {user?.firstName ? `${user.firstName}` : "SUPER_ADMIN"}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => void loadData("refresh")}><Ionicons name="refresh-outline" size={20} color="#E2E8F0" /></TouchableOpacity>
            <TouchableOpacity style={styles.profileBadge} activeOpacity={0.9}><Ionicons name="shield-checkmark" size={22} color="#FFD700" /></TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} />}
          ListHeaderComponent={
            <View>
              <View style={styles.topCard}>
                <View style={styles.statBox}><Text style={styles.statLabel}>SOCIÉTÉS</Text><Text style={styles.statValue}>{stats.total}</Text></View>
                <View style={styles.dividerV} />
                <View style={styles.statBox}><Text style={styles.statLabel}>ACTIVES</Text><Text style={styles.statValue}>{stats.active}</Text></View>
                <View style={styles.dividerV} />
                <View style={styles.statBox}><Text style={styles.statLabel}>INACTIVES</Text><Text style={styles.statValue}>{stats.inactive}</Text></View>
              </View>

              <Text style={styles.sectionLabel}>PILOTAGE RÉSEAU</Text>
              <View style={styles.grid}>{actions.map((a) => <QuickActionCard key={a.title} action={a} />)}</View>

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" />
                <TextInput value={q} onChangeText={setQ} placeholder="Rechercher une société (nom, code, statut...)" placeholderTextColor="#94A3B8" style={styles.searchInput} autoCapitalize="none" autoCorrect={false} />
                {!!q && <TouchableOpacity onPress={() => setQ("")} style={styles.clearBtn}><Ionicons name="close" size={18} color="#64748B" /></TouchableOpacity>}
              </View>

              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionLabel}>CLIENTS SAAS (SOCIÉTÉS)</Text>
                <TouchableOpacity style={[styles.plusButton, !isSuperAdmin && { opacity: 0.55 }]} onPress={handleAddNewSociety} activeOpacity={0.9}>
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 18, marginBottom: 10 }} />}
            </View>
          }
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Aucun client SaaS trouvé.</Text> : null}
          ListFooterComponent={<View style={{ height: 110 }} />}
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

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <TouchableOpacity style={styles.pCard} onPress={action.onPress} activeOpacity={0.9}>
      <View style={[styles.pIconBox, { backgroundColor: "rgba(15, 23, 42, 0.04)" }]}><Ionicons name={action.icon} size={22} color={action.color} /></View>
      <Text style={styles.pTitle}>{action.title}</Text>
      {!!action.subtitle && <Text style={styles.pSubtitle}>{action.subtitle}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Conserve ici UNIQUEMENT les styles du layout principal (safeArea, header, listContent, topCard, clientCard, etc.)
  safeArea: { flex: 1, backgroundColor: "#0F172A" },
  screen: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#0F172A" },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#94A3B8", fontSize: 13, fontWeight: "500", marginTop: 3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  profileBadge: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  listContent: { paddingTop: 16, paddingHorizontal: 18, backgroundColor: "#F8FAFC", borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: "100%" },
  topCard: { backgroundColor: "#FFFFFF", borderRadius: 20, paddingVertical: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18, elevation: 2 },
  statBox: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "800", letterSpacing: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginTop: 6 },
  dividerV: { width: 1, height: 38, backgroundColor: "#E2E8F0" },
  sectionLabel: { fontSize: 12, fontWeight: "900", color: "#64748B", letterSpacing: 1.4, marginBottom: 12, marginLeft: 4 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  pCard: { width: "48%", backgroundColor: "#FFFFFF", padding: 14, borderRadius: 18, elevation: 1, marginBottom: 12 },
  pIconBox: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  pTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  pSubtitle: { marginTop: 3, fontSize: 12, color: "#64748B", fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput: { flex: 1, paddingLeft: 10, fontSize: 13, color: "#0F172A", fontWeight: "600" },
  clearBtn: { width: 32, height: 32, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(148,163,184,0.15)" },
  plusButton: { backgroundColor: "#F59E0B", width: 40, height: 40, borderRadius: 14, justifyContent: "center", alignItems: "center", elevation: 4 },
  clientCard: { flexDirection: "row", backgroundColor: "#FFFFFF", padding: 16, borderRadius: 18, marginBottom: 12, alignItems: "center", elevation: 1 },
  statusDot: { width: 6, height: 46, borderRadius: 999, marginRight: 14 },
  clientName: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6, gap: 8 },
  clientMeta: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  clientMetaStrong: { color: "#334155", fontWeight: "900" },
  badge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(248,250,252,0.7)" },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  cardActions: { paddingLeft: 10 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 22, fontSize: 14, fontWeight: "700" }
});