// components/dashboards/AgentDashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated, Platform, useWindowDimensions
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#78350F", // Marron chaud
  light: "#FFF7ED",
  text: "#451A03",
  muted: "#94A3B8",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#F1F5F9",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function OpCard({ title, subtitle, icon, color, bgColor, onPress, badge }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, minWidth: 140, transform: [{ scale }] }}>
      <TouchableOpacity
        style={s.opCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={0.9}
      >
        <View style={[s.opIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <Text style={s.opTitle}>{title}</Text>
        <Text style={s.opSub} numberOfLines={1}>{subtitle}</Text>
        {badge && (
          <View style={[s.opBadge, { backgroundColor: bgColor }]}>
            <Text style={[s.opBadgeText, { color }]}>{badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function FullOpCard({ title, subtitle, icon, color, bgColor, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        style={s.fullCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={0.9}
      >
        <View style={[s.fullIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fullTitle}>{title}</Text>
          <Text style={s.fullSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgentDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  const agencyName = user?.agency?.name ?? agencyData?.name ?? "Mon Agence";
  const currency = agencyData?.currency ?? "XOF";
  const balance = toNum(agencyData?.balance ?? user?.agency?.balance);
  const cash = toNum(agencyData?.cash);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId);
        setAgencyData(data);
      }
    } catch (e) {
      console.error(e);
    } finally { setRefreshing(false); }
  }, [user?.agencyId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />

      <View style={[s.header, { backgroundColor: THEME.primary }]}>
        <View style={{ flex: 1 }}>
          <View style={s.headerBadgeWrap}>
            <Ionicons name="shield-checkmark" size={12} color="#FDE68A" />
            <Text style={s.headerBadge}>ESPACE GUICHET</Text>
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>Bonjour, {user?.firstName || "Agent"}</Text>
          <Text style={s.headerSub} numberOfLines={1}><Ionicons name="storefront" size={14} color="#FFF"/> {agencyName}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={loadData}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
            <Ionicons name="notifications" size={20} color="#FFF" />
            <View style={s.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={THEME.primary} />}
      >
        <View style={[s.balanceRow, isDesktop && { flexDirection: 'row' }]}>
          <View style={[s.balanceCard, { backgroundColor: THEME.primary }]}>
            <View style={s.balanceDeco} />
            <Text style={s.balanceLabel}>SOLDE AGENCE (VIRTUEL)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
              <Text style={s.balanceAmount}>{balance.toLocaleString("fr-FR")}</Text>
              <Text style={s.balanceCurr}> {currency}</Text>
            </View>
            <View style={s.balanceFooter}>
              <View style={s.activeDot} />
              <Text style={s.activeText}>Caisse en ligne</Text>
            </View>
          </View>

          <View style={[s.cashCard, isDesktop && { marginLeft: 16 }]}>
            <View style={[s.cashIconWrap, { backgroundColor: THEME.light }]}>
              <Ionicons name="cash" size={20} color={THEME.primary} />
            </View>
            <View>
              <Text style={s.cashLabel}>ESPÈCES EN CAISSE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                <Text style={s.cashAmount}>{cash.toLocaleString("fr-FR")}</Text>
                <Text style={s.cashCurrDark}> {currency}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={s.sectionLabel}>OPÉRATIONS RAPIDES</Text>
        <View style={s.opsGrid}>
          <OpCard title="Dépôt Client" subtitle="Recharger compte" icon="arrow-down" color="#10B981" bgColor="#ECFDF5" onPress={() => router.push("/agent/deposit")} />
          <OpCard title="Retrait Client" subtitle="Payer un code" icon="arrow-up" color="#EF4444" bgColor="#FEF2F2" onPress={() => router.push("/agent/withdraw")} />
          <OpCard title="Envoi Cash" subtitle="Sans compte" icon="paper-plane" color="#3B82F6" bgColor="#EFF6FF" onPress={() => router.push("/agent/send-cash")} badge="Nouveau" />
          <OpCard title="Clôture" subtitle="Bilan journalier" icon="calculator" color="#F59E0B" bgColor="#FFFBEB" onPress={() => router.push("/agent/commissions")} />
        </View>

        <Text style={[s.sectionLabel, { marginTop: 24 }]}>SUIVI & RAPPORTS</Text>
        <View style={s.fullCardsGrid}>
          <FullOpCard title="Journal de Caisse" subtitle="Toutes les opérations du jour" icon="list" color={THEME.primary} bgColor={THEME.light} onPress={() => router.push("/agent/transactions")} />
          <FullOpCard title="Mes Commissions" subtitle="Gains, paliers et historique" icon="bar-chart" color="#7C3AED" bgColor="#F5F3FF" onPress={() => router.push("/agent/commissions")} />
          <FullOpCard title="Taux du Jour" subtitle="Devises & taux de change" icon="trending-up" color="#D97706" bgColor="#FFFBEB" onPress={() => router.push("/(tabs)/rates")} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 24, paddingVertical: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, zIndex: 10 },
  headerBadgeWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8, gap: 4 },
  headerBadge: { color: "#FDE68A", fontSize: 10, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  headerTitle: { fontSize: 26, fontFamily: FONTS.heading, color: "#FFF", fontWeight: "700", marginBottom: 2 },
  headerSub: { fontSize: 14, fontFamily: FONTS.body, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  headerRight: { flexDirection: "row", gap: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  notifDot: { position: "absolute", top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444", borderWidth: 2, borderColor: THEME.primary },
  content: { padding: 20, paddingTop: 24 },
  contentDesktop: { maxWidth: 1000, alignSelf: 'center', width: '100%' },
  
  balanceRow: { marginBottom: 24 },
  balanceCard: { borderRadius: 24, padding: 24, overflow: "hidden", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  balanceDeco: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.06)", top: -40, right: -40 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  balanceAmount: { color: "#FFF", fontSize: 36, fontFamily: FONTS.heading, fontWeight: "800" },
  balanceCurr: { color: "rgba(255,255,255,0.7)", fontSize: 16, fontFamily: FONTS.body, fontWeight: "700" },
  balanceFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  activeText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontFamily: FONTS.body, fontWeight: "700" },

  cashCard: { backgroundColor: THEME.surface, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.border, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  cashIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cashLabel: { color: THEME.muted, fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  cashAmount: { color: THEME.text, fontSize: 22, fontFamily: FONTS.heading, fontWeight: "800" },
  cashCurrDark: { color: THEME.muted, fontSize: 12, fontFamily: FONTS.body, fontWeight: "700" },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  opsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  opCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, padding: 16, flex: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  opIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  opTitle: { fontSize: 14, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text, marginBottom: 4 },
  opSub: { fontSize: 11, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600" },
  opBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  opBadgeText: { fontSize: 9, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 0.5 },

  fullCardsGrid: { flexDirection: 'column' },
  fullCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, padding: 16, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  fullIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 16 },
  fullTitle: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text, marginBottom: 2 },
  fullSub: { fontSize: 12, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600" },
});