// components/dashboards/ClientDashboard.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated, useWindowDimensions
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#059669", // Vert Émeraude vif
  primaryDark: "#047857", // Vert profond pour le contraste
  light: "#ECFDF5",
  text: "#0F172A",
  muted: "#64748B",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function ActionButton({ icon, label, color, bgColor, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, { flex: 1, minWidth: 70 }]}>
      <TouchableOpacity
        style={{ alignItems: 'center' }}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        activeOpacity={0.9}
      >
        <View style={[cs.actionIconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <Text style={cs.actionLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [refreshing, setRefreshing] = useState(false);
  const [recentTxs, setRecentTxs] = useState<any[]>([]); // A brancher plus tard si besoin

  const firstName = user?.firstName ?? "Client";
  const balance = toNum(user?.balance);
  const currency = (user as any)?.currency ?? "XOF";

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try { await refreshUser(); } finally { setRefreshing(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  return (
    <SafeAreaView style={cs.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />

      <View style={[cs.header, { backgroundColor: THEME.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={cs.greeting}>Bon retour, 👋</Text>
          <Text style={cs.name} numberOfLines={1} adjustsFontSizeToFit>{firstName}</Text>
        </View>
        <View style={cs.headerRight}>
          <TouchableOpacity style={cs.headerBtn} onPress={() => router.push("/(tabs)/notifications")}>
            <Ionicons name="notifications" size={20} color="#FFF" />
            <View style={cs.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity style={cs.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Text style={cs.avatarText}>{(firstName[0] || 'C').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[cs.content, isDesktop && cs.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={THEME.primary} />}
      >
        {/* CARTE WALLET */}
        <View style={cs.balanceCard}>
          <View style={cs.balanceDeco1} />
          <View style={cs.balanceDeco2} />
          <Text style={cs.balanceLabel}>SOLDE DISPONIBLE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginVertical: 6 }}>
            <Text style={cs.balanceAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {balance.toLocaleString("fr-FR")}
            </Text>
            <Text style={cs.balanceCurrency}> {currency}</Text>
          </View>
          <View style={cs.balanceDivider} />
          <View style={cs.balanceActions}>
            <TouchableOpacity style={cs.topUpBtn} onPress={() => router.push("/topup")}>
              <Ionicons name="add-circle" size={18} color={THEME.primaryDark} />
              <Text style={cs.topUpText}>Recharger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.histBtn} onPress={() => router.push("/(tabs)/transactions")}>
              <Ionicons name="list" size={18} color="#FFF" />
              <Text style={cs.histText}>Historique</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACTIONS RAPIDES */}
        <View style={cs.actionsCard}>
          <ActionButton icon="paper-plane" label="Envoyer" color={THEME.primary} bgColor={THEME.light} onPress={() => router.push("/(tabs)/send")} />
          <View style={cs.actionsDivider} />
          <ActionButton icon="people" label="Contacts" color="#0284C7" bgColor="#ECFEFF" onPress={() => router.push("/(tabs)/beneficiaries")} />
          <View style={cs.actionsDivider} />
          <ActionButton icon="qr-code" label="QR Code" color="#D97706" bgColor="#FFFBEB" onPress={() => router.push("/(tabs)/qr")} />
        </View>

        {/* BANNIERE PROMO */}
        <TouchableOpacity style={cs.promoBanner} activeOpacity={0.9}>
          <View style={cs.promoIconBox}><Ionicons name="gift" size={24} color="#D97706" /></View>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={cs.promoTitle}>🎉 Transferts gratuits ce week-end</Text>
            <Text style={cs.promoSub}>Profitez de 0 frais vers toutes les destinations.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#D97706" />
        </TouchableOpacity>

        {/* TRANSACTIONS RECENTES */}
        <View style={cs.txContainer}>
          <View style={cs.txHeader}>
            <Text style={cs.sectionTitle}>TRANSACTIONS RÉCENTES</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
              <Text style={cs.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          
          <View style={cs.emptyState}>
            <View style={cs.emptyIconBg}><Ionicons name="swap-horizontal" size={32} color="#CBD5E1" /></View>
            <Text style={cs.emptyText}>Aucune transaction récente</Text>
            <Text style={cs.emptySub}>Vos futurs envois apparaîtront ici.</Text>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, zIndex: 10 },
  greeting: { fontSize: 13, fontFamily: FONTS.body, color: "rgba(255,255,255,0.9)", fontWeight: "700", letterSpacing: 0.5 },
  name: { fontSize: 26, fontFamily: FONTS.heading, fontWeight: "700", color: "#FFF", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  notifDot: { position: "absolute", top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444", borderWidth: 2, borderColor: THEME.primary },
  avatarBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  avatarText: { color: THEME.primary, fontSize: 18, fontFamily: FONTS.heading, fontWeight: "900" },
  
  content: { padding: 20, paddingTop: 16 },
  contentDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },

  balanceCard: { backgroundColor: THEME.primaryDark, borderRadius: 24, padding: 24, marginBottom: 20, overflow: "hidden", shadowColor: THEME.primaryDark, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  balanceDeco1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -50 },
  balanceDeco2: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 30 },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  balanceAmount: { color: "#FFF", fontSize: 36, fontFamily: FONTS.heading, fontWeight: "800", flexShrink: 1 },
  balanceCurrency: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontFamily: FONTS.body, fontWeight: "700" },
  balanceDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 16 },
  balanceActions: { flexDirection: "row", gap: 12 },
  topUpBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8, backgroundColor: "#FFF", paddingVertical: 12, borderRadius: 14 },
  topUpText: { color: THEME.primaryDark, fontFamily: FONTS.body, fontWeight: "800", fontSize: 13 },
  histBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8, backgroundColor: "rgba(255,255,255,0.2)", paddingVertical: 12, borderRadius: 14 },
  histText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 13 },

  actionsCard: { flexDirection: "row", alignItems: "center", justifyContent: 'space-between', backgroundColor: THEME.surface, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: THEME.border },
  actionsDivider: { width: 1, height: 50, backgroundColor: THEME.border },
  actionIconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text },

  promoBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEB", borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#FEF3C7" },
  promoIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FEF3C7", justifyContent: 'center', alignItems: 'center' },
  promoTitle: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "800", color: "#D97706", marginBottom: 2 },
  promoSub: { fontSize: 11, fontFamily: FONTS.body, color: "#B45309", fontWeight: "600" },

  txContainer: { backgroundColor: THEME.surface, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: THEME.border },
  txHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.2 },
  seeAll: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "800", color: THEME.primary },
  
  emptyState: { alignItems: "center", paddingVertical: 24 },
  emptyIconBg: { width: 64, height: 64, borderRadius: 20, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { color: THEME.text, fontFamily: FONTS.body, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  emptySub: { color: THEME.muted, fontFamily: FONTS.body, fontSize: 12, fontWeight: "600" }
});