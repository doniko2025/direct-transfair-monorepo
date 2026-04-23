// components/dashboards/AgentDashboard.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const C = {
  bg: "#F2FAF7",
  surface: "#FFFFFF",
  border: "#E0F0EA",
  accent: "#065F46",
  accentMid: "#059669",
  accentLight: "#10B981",
  accentSoft: "#ECFDF5",
  blue: "#1D4ED8",
  blueSoft: "#EFF6FF",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  textFaint: "#CBD5E1",
  white: "#FFFFFF",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function OpCard({
  title, subtitle, icon, color, bgColor, onPress, badge,
}: {
  title: string; subtitle: string; icon: string; color: string; bgColor: string; onPress: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={as.opCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[as.opIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <Text style={as.opTitle}>{title}</Text>
        <Text style={as.opSub}>{subtitle}</Text>
        {badge && (
          <View style={[as.opBadge, { backgroundColor: bgColor }]}>
            <Text style={[as.opBadgeText, { color }]}>{badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function FullOpCard({ title, subtitle, icon, color, bgColor, onPress }: {
  title: string; subtitle: string; icon: string; color: string; bgColor: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={as.fullCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[as.fullIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={as.fullTitle}>{title}</Text>
          <Text style={as.fullSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  const agencyName = user?.agency?.name ?? agencyData?.name ?? "Agence";
  const currency = agencyData?.currency ?? "XOF";
  const balance = toNum(agencyData?.balance ?? user?.agency?.balance);
  const cash = toNum(agencyData?.cash);

  const loadData = async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId);
        setAgencyData(data);
      }
    } catch (e) {
      console.error(e);
    } finally { setRefreshing(false); }
  };

  useEffect(() => { void loadData(); }, []);

  return (
    <SafeAreaView style={as.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={as.header}>
        <View style={as.agencyBadge}>
          <Ionicons name="storefront" size={16} color={C.accentMid} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={as.agencyLabel}>Espace Guichet</Text>
          <Text style={as.agencyName} numberOfLines={1}>{agencyName}</Text>
        </View>
        <View style={as.headerRight}>
          <TouchableOpacity style={as.headerBtn} onPress={loadData}>
            <Ionicons name="refresh-outline" size={18} color={C.textSub} />
          </TouchableOpacity>
          <View style={as.agentBadge}>
            <Ionicons name="person" size={16} color={C.white} />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={as.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.accentMid} />}
      >
        {/* Balance Cards Row */}
        <View style={as.balanceRow}>
          {/* Main balance */}
          <View style={[as.balanceCard, { flex: 1.6 }]}>
            <View style={as.balanceDeco} />
            <Text style={as.balanceLabel}>Solde Agence</Text>
            <Text style={as.balanceAmount}>{balance.toLocaleString("fr-FR")}</Text>
            <Text style={as.balanceCurr}>{currency}</Text>
            <View style={as.balanceFooter}>
              <View style={as.activeDot} />
              <Text style={as.activeText}>En ligne</Text>
            </View>
          </View>
          {/* Cash */}
          <View style={[as.balanceCard, as.cashCard, { flex: 1 }]}>
            <Ionicons name="wallet-outline" size={18} color={C.accentLight} style={{ marginBottom: 8 }} />
            <Text style={as.cashLabel}>Caisse</Text>
            <Text style={as.cashAmount}>{cash.toLocaleString("fr-FR")}</Text>
            <Text style={as.cashCurr}>{currency}</Text>
          </View>
        </View>

        {/* Quick ops grid */}
        <Text style={as.sectionLabel}>OPÉRATIONS GUICHET</Text>
        <View style={as.opsGrid}>
          <View style={as.opsRow}>
            <OpCard title="Dépôt" subtitle="Recharger un compte" icon="arrow-down-circle-outline" color={C.accentMid} bgColor={C.accentSoft} onPress={() => router.push("/agent/deposit")} />
            <OpCard title="Retrait" subtitle="Payer un code" icon="arrow-up-circle-outline" color={C.red} bgColor={C.redSoft} onPress={() => router.push("/agent/withdraw")} />
          </View>
          <View style={as.opsRow}>
            <OpCard title="Envoi Cash" subtitle="Client de passage" icon="paper-plane-outline" color={C.blue} bgColor={C.blueSoft} onPress={() => router.push("/agent/send-cash")} badge="Nouveau" />
            <OpCard title="Mes Gains" subtitle="Commissions" icon="stats-chart-outline" color={C.amber} bgColor={C.amberSoft} onPress={() => router.push("/agent/commissions")} />
          </View>
        </View>

        {/* Full cards */}
        <Text style={[as.sectionLabel, { marginTop: 18 }]}>SUIVI & RAPPORTS</Text>
        <View style={as.fullCards}>
          <FullOpCard
            title="Journal de Caisse"
            subtitle="Toutes les opérations du jour"
            icon="list-outline"
            color={C.accent}
            bgColor={C.accentSoft}
            onPress={() => router.push("/agent/transactions")}
          />
          <FullOpCard
            title="Mes Commissions"
            subtitle="Gains, paliers et historique"
            icon="bar-chart-outline"
            color={C.purple}
            bgColor={C.purpleSoft}
            onPress={() => router.push("/agent/commissions")}
          />
          <FullOpCard
            title="Taux du Jour"
            subtitle="Devises & taux de change"
            icon="trending-up-outline"
            color={C.amber}
            bgColor={C.amberSoft}
            onPress={() => router.push("/(tabs)/rates")}
          />
        </View>

        {/* Status chip */}
        <View style={as.statusChip}>
          <Ionicons name="shield-checkmark-outline" size={14} color={C.accentMid} />
          <Text style={as.statusText}>Session sécurisée · {user?.firstName} {user?.lastName}</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const as = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1,
    borderBottomColor: C.border, gap: 12,
  },
  agencyBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.accentSoft, justifyContent: "center", alignItems: "center" },
  agencyLabel: { fontSize: 11, color: C.textMuted, fontWeight: "700", letterSpacing: 0.5 },
  agencyName: { fontSize: 15, fontWeight: "800", color: C.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.border },
  agentBadge: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentMid, justifyContent: "center", alignItems: "center" },
  content: { padding: 16 },

  // Balance
  balanceRow: { flexDirection: "row", gap: 12, marginBottom: 22 },
  balanceCard: {
    backgroundColor: C.accent, borderRadius: 22, padding: 18, overflow: "hidden",
  },
  balanceDeco: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)", top: -30, right: -30,
  },
  balanceLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  balanceAmount: { color: "#FFF", fontSize: 22, fontWeight: "900", marginTop: 6, letterSpacing: -0.5 },
  balanceCurr: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  balanceFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  activeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#34D399" },
  activeText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },

  cashCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  cashLabel: { color: C.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  cashAmount: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 4, letterSpacing: -0.3 },
  cashCurr: { color: C.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Labels
  sectionLabel: { fontSize: 11, fontWeight: "900", color: C.textMuted, letterSpacing: 1.4, marginBottom: 12, marginLeft: 2 },

  // Ops grid
  opsGrid: { gap: 10, marginBottom: 4 },
  opsRow: { flexDirection: "row", gap: 10 },

  opCard: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 6, overflow: "hidden",
  },
  opIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  opTitle: { fontSize: 13, fontWeight: "800", color: C.text },
  opSub: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  opBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginTop: 2 },
  opBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  // Full cards
  fullCards: { gap: 8 },
  fullCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 12,
  },
  fullIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  fullTitle: { fontSize: 13, fontWeight: "800", color: C.text },
  fullSub: { fontSize: 11, color: C.textMuted, fontWeight: "600", marginTop: 1 },

  // Status
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.accentSoft, borderRadius: 12, padding: 12, marginTop: 18,
    borderWidth: 1, borderColor: C.border,
  },
  statusText: { fontSize: 12, color: C.accent, fontWeight: "700" },
});