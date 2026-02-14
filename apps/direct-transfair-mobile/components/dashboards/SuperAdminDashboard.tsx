//apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

type SubscriptionStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED" | string;
type SubscriptionType = "RENTAL" | "PURCHASE" | string;

type ClientSaas = {
  id: string;
  name: string;
  code: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionType?: SubscriptionType;
  primaryColor?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function normalizeClients(raw: unknown): ClientSaas[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? (raw.data as unknown[])
      : [];

  const out: ClientSaas[] = [];

  for (const item of arr) {
    if (!isRecord(item)) continue;
    const id = toStr(item.id);
    const name = toStr(item.name);
    const code = toStr(item.code);
    if (!id || !code) continue;

    out.push({
      id,
      name: name || code,
      code,
      subscriptionStatus: toStr(item.subscriptionStatus) || undefined,
      subscriptionType: toStr(item.subscriptionType) || undefined,
      primaryColor: isRecord(item) ? (item.primaryColor as string | null | undefined) ?? null : null,
    });
  }

  return out;
}

function statusLabel(s?: string) {
  if (!s) return "INCONNU";
  const up = s.toUpperCase();
  if (up === "ACTIVE") return "ACTIF";
  if (up === "INACTIVE") return "INACTIF";
  if (up === "EXPIRED") return "EXPIRÉ";
  if (up === "SUSPENDED") return "SUSPENDU";
  return up;
}

function statusColor(s?: string) {
  const up = (s ?? "").toUpperCase();
  if (up === "ACTIVE") return "#10B981";
  if (up === "INACTIVE") return "#64748B";
  if (up === "EXPIRED") return "#EF4444";
  if (up === "SUSPENDED") return "#F59E0B";
  return "#94A3B8";
}

function subscriptionLabel(t?: string) {
  const up = (t ?? "").toUpperCase();
  if (up === "PURCHASE") return "ACHAT";
  if (up === "RENTAL") return "LOCATION";
  return up || "—";
}

type QuickAction = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [clients, setClients] = useState<ClientSaas[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [q, setQ] = useState<string>("");

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const raw = await api.getClients(); // unknown côté TS -> normalisation safe
      const normalized = normalizeClients(raw).filter((c) => c.code !== "DONIKO");
      setClients(normalized);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("SuperAdminDashboard loadData error:", msg);
      Alert.alert("Erreur", "Impossible de charger la liste des clients SaaS.");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData("init");
      return () => {};
    }, [loadData]),
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;

    return clients.filter((c) => {
      const hay = `${c.name} ${c.code} ${c.subscriptionStatus ?? ""} ${c.subscriptionType ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [clients, q]);

  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => (c.subscriptionStatus ?? "").toUpperCase() === "ACTIVE").length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [clients]);

  const actions: QuickAction[] = useMemo(
    () => [
      {
        title: "Trésorerie",
        subtitle: "Super admin",
        icon: "wallet-outline",
        color: "#10B981",
        onPress: () => router.push("/(tabs)/admin/treasury"),
      },
      {
        title: "Taux EUR",
        subtitle: "Change",
        icon: "trending-up-outline",
        color: "#8B5CF6",
        onPress: () => router.push("/(tabs)/admin/rates"),
      },
      {
        title: "Audit Transac",
        subtitle: "Contrôle",
        icon: "analytics-outline",
        color: "#3B82F6",
        onPress: () => router.push("/(tabs)/admin/transactions"),
      },
      {
        title: "Gestion Users",
        subtitle: "Comptes",
        icon: "people-outline",
        color: "#64748B",
        onPress: () => router.push("/(tabs)/admin/users"),
      },
    ],
    [router],
  );

  const handleAddNewSociety = useCallback(() => {
    const randomCode = `SOC${Math.floor(1000 + Math.random() * 9000)}`;
    const tempPassword = `Pass-${Math.floor(1000 + Math.random() * 9000)}`;

    Alert.alert(
      "Nouvelle société (préparation)",
      `Code société : ${randomCode}\nMot de passe admin : ${tempPassword}\n\nNote : copie manuelle pour l’instant (si tu veux, je t’ajoute le copy-to-clipboard Expo propre).`,
      [{ text: "OK" }],
    );
  }, []);

  const openClient = useCallback(
    (client: ClientSaas) => {
      // On reste sur ton schéma actuel: écran admin qui sait gérer params { id }
      router.push({ pathname: "/(tabs)/admin", params: { id: client.id } });
    },
    [router],
  );

  const renderClientItem = useCallback(
    ({ item }: { item: ClientSaas }) => {
      const dot = statusColor(item.subscriptionStatus);
      const status = statusLabel(item.subscriptionStatus);
      const sub = subscriptionLabel(item.subscriptionType);

      return (
        <TouchableOpacity style={styles.clientCard} onPress={() => openClient(item)} activeOpacity={0.9}>
          <View style={[styles.statusDot, { backgroundColor: dot }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.clientMeta} numberOfLines={1}>
                Code: <Text style={styles.clientMetaStrong}>{item.code}</Text>
              </Text>

              <View style={[styles.badge, { borderColor: dot }]}>
                <Text style={[styles.badgeText, { color: dot }]}>{status}</Text>
              </View>

              <View style={[styles.badge, { borderColor: "#E2E8F0" }]}>
                <Text style={[styles.badgeText, { color: "#334155" }]}>{sub}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </TouchableOpacity>
      );
    },
    [openClient],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Super Console</Text>
          <Text style={styles.headerSubtitle}>
            Direct Transf’air Cloud • {user?.firstName ? `${user.firstName}` : "SUPER_ADMIN"}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => void loadData("refresh")}>
            <Ionicons name="refresh-outline" size={20} color="#E2E8F0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileBadge} activeOpacity={0.9}>
            <Ionicons name="shield-checkmark" size={22} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderClientItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} />}
        ListHeaderComponent={
          <View>
            {/* TOP STATS */}
            <View style={styles.topCard}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>SOCIÉTÉS</Text>
                <Text style={styles.statValue}>{stats.total}</Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>ACTIVES</Text>
                <Text style={styles.statValue}>{stats.active}</Text>
              </View>
              <View style={styles.dividerV} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>INACTIVES</Text>
                <Text style={styles.statValue}>{stats.inactive}</Text>
              </View>
            </View>

            {/* QUICK ACTIONS */}
            <Text style={styles.sectionLabel}>PILOTAGE RÉSEAU</Text>
            <View style={styles.grid}>
              {actions.map((a) => (
                <QuickActionCard key={a.title} action={a} />
              ))}
            </View>

            {/* SEARCH */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Rechercher une société (nom, code, statut...)"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ("")} style={styles.clearBtn}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* CLIENTS HEADER */}
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionLabel}>CLIENTS SAAS (SOCIÉTÉS)</Text>
              <TouchableOpacity style={styles.plusButton} onPress={handleAddNewSociety} activeOpacity={0.9}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 18, marginBottom: 10 }} />}
          </View>
        }
        ListEmptyComponent={
          loading ? null : <Text style={styles.emptyText}>Aucun client SaaS trouvé.</Text>
        }
        ListFooterComponent={<View style={{ height: 110 }} />}
      />
    </SafeAreaView>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <TouchableOpacity style={styles.pCard} onPress={action.onPress} activeOpacity={0.9}>
      <View style={[styles.pIconBox, { backgroundColor: "rgba(15, 23, 42, 0.04)" }]}>
        <Ionicons name={action.icon} size={22} color={action.color} />
      </View>
      <Text style={styles.pTitle}>{action.title}</Text>
      {!!action.subtitle && <Text style={styles.pSubtitle}>{action.subtitle}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0F172A" },

  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  headerSubtitle: { color: "#94A3B8", fontSize: 13, fontWeight: "500", marginTop: 3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  listContent: {
    paddingTop: 16,
    paddingHorizontal: 18,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: "100%",
  },

  topCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  statBox: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "800", letterSpacing: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#1E293B", marginTop: 6 },
  dividerV: { width: 1, height: 38, backgroundColor: "#E2E8F0" },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1.4,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 18,
    elevation: 1,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  pTitle: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
  pSubtitle: { marginTop: 3, fontSize: 12, color: "#64748B", fontWeight: "600" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    paddingLeft: 10,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.15)",
  },

  plusButton: {
    backgroundColor: "#F59E0B",
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  clientCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  statusDot: { width: 6, height: 46, borderRadius: 999, marginRight: 14 },
  clientName: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6, gap: 8 as any },
  clientMeta: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  clientMetaStrong: { color: "#334155", fontWeight: "900" },

  badge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(248,250,252,0.7)",
  },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },

  cardActions: { paddingLeft: 10 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 22, fontSize: 14, fontWeight: "700" },
});
