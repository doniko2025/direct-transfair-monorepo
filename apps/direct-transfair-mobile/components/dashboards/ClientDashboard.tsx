// components/dashboards/ClientDashboard.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: W } = Dimensions.get("window");

// ─── Palette (warm premium) ───────────────────────────────────────────────────
const C = {
  bg: "#FAFBFF",
  surface: "#FFFFFF",
  border: "#EEF1F8",
  accent: "#2563EB",
  accentSoft: "#EFF6FF",
  accentGrad1: "#1D4ED8",
  accentGrad2: "#3B82F6",
  success: "#059669",
  successSoft: "#ECFDF5",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  rose: "#E11D48",
  roseSoft: "#FFF1F2",
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

// ─── Action Button ─────────────────────────────────────────────────────────
function ActionButton({ icon, label, color, bgColor, onPress }: {
  icon: string; label: string; color: string; bgColor: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, actionStyles.wrap]}>
      <TouchableOpacity
        style={actionStyles.btn}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[actionStyles.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <Text style={actionStyles.label}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const actionStyles = StyleSheet.create({
  wrap: { flex: 1 },
  btn: { alignItems: "center", gap: 8 },
  iconBox: { width: 54, height: 54, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 11, fontWeight: "700", color: C.textSub, textAlign: "center" },
});

// ─── Recent Transaction Item ──────────────────────────────────────────────────
function TxItem({ tx }: { tx: any }) {
  const isOut = ["PENDING", "VALIDATED"].includes(tx.status) && tx.type === "TRANSFER";
  const amount = toNum(tx.total);
  const color = isOut ? C.danger : C.success;
  return (
    <View style={txStyles.row}>
      <View style={[txStyles.dot, { backgroundColor: `${color}18` }]}>
        <Ionicons name={isOut ? "arrow-up" : "arrow-down"} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={txStyles.name} numberOfLines={1}>{tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "—"}</Text>
        <Text style={txStyles.date}>{new Date(tx.createdAt).toLocaleDateString("fr-FR")}</Text>
      </View>
      <Text style={[txStyles.amount, { color }]}>{isOut ? "−" : "+"}{amount.toLocaleString("fr-FR")}</Text>
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  dot: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 13, fontWeight: "700", color: C.text },
  date: { fontSize: 11, color: C.textMuted, fontWeight: "600", marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "800" },
});

export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);

  const firstName = user?.firstName ?? "Vous";
  const balance = toNum(user?.balance);
  const currency = (user as any)?.currency ?? "XOF";

  const loadData = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      // Optionnel : charger les transactions récentes
      // const txs = await api.getTransactions({ limit: 5 });
      // setRecentTxs(txs);
    } finally { setRefreshing(false); }
  };

  return (
    <SafeAreaView style={cs.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={cs.header}>
        <View>
          <Text style={cs.greeting}>Bonjour 👋</Text>
          <Text style={cs.name}>{firstName}</Text>
        </View>
        <View style={cs.headerRight}>
          <TouchableOpacity style={cs.headerBtn} onPress={() => router.push("/(tabs)/notifications")}>
            <Ionicons name="notifications-outline" size={20} color={C.textSub} />
            <View style={cs.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity style={cs.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Text style={cs.avatarText}>{firstName[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={cs.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.accent} />}
      >
        {/* Balance Card */}
        <View style={cs.balanceCard}>
          <View style={cs.balanceDeco1} />
          <View style={cs.balanceDeco2} />
          <Text style={cs.balanceLabel}>Solde disponible</Text>
          <Text style={cs.balanceAmount}>{balance.toLocaleString("fr-FR")}</Text>
          <Text style={cs.balanceCurrency}>{currency}</Text>
          <View style={cs.balanceDivider} />
          <View style={cs.balanceActions}>
            <TouchableOpacity style={cs.topUpBtn} onPress={() => router.push("/topup")}>
              <Ionicons name="add" size={14} color={C.accent} />
              <Text style={cs.topUpText}>Recharger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.histBtn} onPress={() => router.push("/(tabs)/transactions")}>
              <Ionicons name="list-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={cs.histText}>Historique</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={cs.actionsCard}>
          <ActionButton icon="paper-plane-outline" label="Envoyer" color={C.accent} bgColor={C.accentSoft} onPress={() => router.push("/(tabs)/send")} />
          <View style={cs.actionsDivider} />
          <ActionButton icon="people-outline" label="Bénéficiaires" color={C.success} bgColor={C.successSoft} onPress={() => router.push("/(tabs)/beneficiaries")} />
          <View style={cs.actionsDivider} />
          <ActionButton icon="qr-code-outline" label="QR Code" color={C.warning} bgColor={C.warningSoft} onPress={() => router.push("/(tabs)/qr")} />
          <View style={cs.actionsDivider} />
          <ActionButton icon="card-outline" label="Recharge" color={C.rose} bgColor={C.roseSoft} onPress={() => router.push("/topup")} />
        </View>

        {/* Promotions Banner */}
        <TouchableOpacity style={cs.promoBanner} activeOpacity={0.9}>
          <View>
            <Text style={cs.promoTitle}>🎉 Envoi gratuit ce weekend</Text>
            <Text style={cs.promoSub}>Frais offerts sur tous les transferts</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={C.warning} />
        </TouchableOpacity>

        {/* Recent Transactions */}
        <View style={cs.txCard}>
          <View style={cs.txHeader}>
            <Text style={cs.sectionTitle}>Transactions récentes</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
              <Text style={cs.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {recentTxs.length === 0 ? (
            <View style={cs.empty}>
              <Ionicons name="swap-horizontal-outline" size={32} color={C.textFaint} />
              <Text style={cs.emptyText}>Aucune transaction récente</Text>
            </View>
          ) : (
            recentTxs.slice(0, 5).map((tx) => <TxItem key={tx.id} tx={tx} />)
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  greeting: { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  name: { fontSize: 22, fontWeight: "900", color: C.text, letterSpacing: -0.4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  notifDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 99, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.bg },
  avatarBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.accent, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  content: { paddingHorizontal: 16 },
  // Balance
  balanceCard: { backgroundColor: C.accent, borderRadius: 24, padding: 24, marginBottom: 14, overflow: "hidden" },
  balanceDeco1: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.07)", top: -50, right: -50 },
  balanceDeco2: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.05)", bottom: -20, left: 30 },
  balanceLabel: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  balanceAmount: { color: "#FFF", fontSize: 42, fontWeight: "900", letterSpacing: -1.5, marginTop: 4 },
  balanceCurrency: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700", marginTop: 2 },
  balanceDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 18 },
  balanceActions: { flexDirection: "row", gap: 10 },
  topUpBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  topUpText: { color: C.accent, fontWeight: "800", fontSize: 12 },
  histBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  histText: { color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 12 },
  // Actions
  actionsCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 14 },
  actionsDivider: { width: 1, height: 40, backgroundColor: C.border },
  // Promo
  promoBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.warningSoft, borderRadius: 16, borderWidth: 1, borderColor: "#FDE68A", padding: 16, marginBottom: 18 },
  promoTitle: { fontSize: 13, fontWeight: "800", color: C.text, marginBottom: 3 },
  promoSub: { fontSize: 11, color: C.textSub, fontWeight: "600" },
  // Transactions
  txCard: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16 },
  txHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  seeAll: { fontSize: 12, fontWeight: "700", color: C.accent },
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
});