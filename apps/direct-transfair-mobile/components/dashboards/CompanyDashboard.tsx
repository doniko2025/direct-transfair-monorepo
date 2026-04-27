// components/dashboards/CompanyDashboard.tsx
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Animated, ScrollView, SafeAreaView, StatusBar, useWindowDimensions
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEME = { primary: "#1E3A8A", light: "#EFF6FF", text: "#0F172A", muted: "#64748B", bg: "#F8FAFC", surface: "#FFFFFF", border: "#E2E8F0" };

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function MenuCard({ title, subtitle, icon, color, bgColor, onPress, badge }: any) {
  const scale = React.useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ width: '48%', marginBottom: 14, transform: [{ scale }] }}>
      <TouchableOpacity style={s.menuCard} onPress={onPress} onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()} activeOpacity={0.9}>
        <View style={s.menuHeaderRow}>
          <View style={[s.menuIcon, { backgroundColor: bgColor }]}><Ionicons name={icon as any} size={24} color={color} /></View>
          {badge && <View style={[s.badge, { backgroundColor: color }]}><Text style={s.badgeText}>{badge}</Text></View>}
        </View>
        <View style={{ width: '100%' }}>
          <Text style={s.menuTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
          <Text style={s.menuSub} numberOfLines={2}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  const clientName = useMemo(() => user?.client?.name || "Mon Entreprise", [user?.client?.name]);
  const currency = useMemo(() => (user as any)?.currency || "XOF", [user]);
  const balance = toNum(user?.balance);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try { await refreshUser(); } finally { setRefreshing(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const closeModal = () => { setModalVisible(false); setAmount(""); setRefBancaire(""); };

  const handlePay = async () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) return Platform.OS === 'web' ? alert("Saisissez un montant valide.") : Alert.alert("Erreur", "Saisissez un montant valide.");
    setProcessing(true);
    try {
      await api.declareBankTransfer(n, refBancaire);
      closeModal();
      Platform.OS === 'web' ? alert("Déclaration envoyée. En attente de validation.") : Alert.alert("Succès", "Déclaration envoyée. En attente de validation.");
      await loadData();
    } catch (e: any) {
      Platform.OS === 'web' ? alert(e?.response?.data?.message || "Erreur technique") : Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally { setProcessing(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />
      <View style={[s.header, { backgroundColor: THEME.primary }]}>
        <View style={s.headerAvatar}><Text style={s.headerAvatarText}>{(clientName[0] ?? "E").toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={s.headerBadgeWrap}><Text style={s.headerBadge}>PILOTAGE SOCIÉTÉ</Text></View>
          <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit>{clientName}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={loadData}><Ionicons name="refresh" size={20} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}><Ionicons name="notifications" size={20} color="#FFF" /><View style={s.notifDot} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, isDesktop && s.contentDesktop]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={THEME.primary} />}>
        <View style={s.hero}>
          <View style={s.heroDeco1} />
          <View style={s.heroDeco2} />
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>TRÉSORERIE GLOBALE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                <Text style={s.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{balance.toLocaleString('fr-FR')}</Text>
                <Text style={s.heroCurrency}> {currency}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.heroArrow} onPress={() => router.push("/(tabs)/admin/treasury")}><Ionicons name="wallet" size={20} color="#FFF" /></TouchableOpacity>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroBottom}>
            <View style={s.heroStatus}><View style={s.greenDot} /><Text style={s.heroStatusText}>Compte opérationnel</Text></View>
            <TouchableOpacity style={s.payBtn} onPress={() => setModalVisible(true)}><Ionicons name="document-text" size={14} color={THEME.primary} /><Text style={s.payBtnText}>Déclarer Virement</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={s.sectionLabel}>MON RÉSEAU</Text>
        <View style={s.grid}>
          <MenuCard title="Créer Agence" subtitle="Ajouter un point" icon="add-circle" color="#7C3AED" bgColor="#F5F3FF" onPress={() => router.push("/(tabs)/admin/agencies/create")} badge="Nouveau" />
          <MenuCard title="Agences" subtitle="Supervision & Caisses" icon="storefront" color="#2563EB" bgColor="#EFF6FF" onPress={() => router.push("/(tabs)/admin/agencies")} />
          <MenuCard title="Utilisateurs" subtitle="Gestion des accès" icon="people" color="#059669" bgColor="#ECFDF5" onPress={() => router.push("/(tabs)/admin/users")} />
        </View>

        <Text style={[s.sectionLabel, { marginTop: 12 }]}>FINANCE & CONFIGURATION</Text>
        <View style={s.grid}>
          <MenuCard title="Suivi Global" subtitle="Audit & Transactions" icon="pie-chart" color="#DC2626" bgColor="#FEF2F2" onPress={() => router.push("/(tabs)/admin/transactions")} />
          <MenuCard title="Commissions" subtitle="Taux & Paliers" icon="settings" color="#0891B2" bgColor="#ECFEFF" onPress={() => router.push("/(tabs)/admin/commissions/config")} />
          <MenuCard title="Change" subtitle="Devises en temps réel" icon="cash" color="#D97706" bgColor="#FFFBEB" onPress={() => router.push("/(tabs)/admin/rates")} />
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <View style={s.modalHeaderRow}>
                <View style={[s.modalIconBox, { backgroundColor: THEME.light }]}><Ionicons name="document-text" size={24} color={THEME.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>Déclarer un Virement</Text>
                  <Text style={s.modalSub}>Alimentation de compte B2B</Text>
                </View>
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>MONTANT ENVOYÉ (XOF)</Text>
                <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Ex: 500000" placeholderTextColor={THEME.muted} autoFocus />
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>RÉFÉRENCE BANCAIRE</Text>
                <TextInput style={s.input} value={refBancaire} onChangeText={setRefBancaire} placeholder="REF-VIREMENT-1234" placeholderTextColor={THEME.muted} autoCapitalize="characters" />
              </View>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: THEME.primary }, processing && { opacity: 0.7 }]} onPress={handlePay} disabled={processing}>
                {processing ? <ActivityIndicator color="#FFF" /> : <Text style={s.confirmText}>ENVOYER POUR VALIDATION</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeModal} style={s.cancelBtn} disabled={processing}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16, paddingTop: Platform.OS === 'android' ? 40 : 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, zIndex: 10 },
  headerAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  headerAvatarText: { color: "#FFF", fontSize: 20, fontFamily: FONTS.heading, fontWeight: "900" },
  headerBadgeWrap: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 2 },
  headerBadge: { color: "#FFF", fontSize: 9, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: "700", color: "#FFF" },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  notifDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: THEME.primary },
  content: { padding: 16, paddingTop: 20 },
  contentDesktop: { maxWidth: 1000, alignSelf: 'center', width: '100%' },
  hero: { backgroundColor: THEME.primary, borderRadius: 20, padding: 20, marginBottom: 20, overflow: "hidden", shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  heroDeco1: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -40, right: -40 },
  heroDeco2: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.05)", bottom: -10, left: 40 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: FONTS.body, fontWeight: "900", letterSpacing: 1 },
  heroAmount: { color: "#FFF", fontSize: 32, fontFamily: FONTS.heading, fontWeight: "800" },
  heroCurrency: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: FONTS.body, fontWeight: "700" },
  heroArrow: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginBottom: 14 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  heroStatusText: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontFamily: FONTS.body, fontWeight: "700" },
  payBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  payBtnText: { color: THEME.primary, fontSize: 11, fontFamily: FONTS.body, fontWeight: "800" },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  menuCard: { backgroundColor: THEME.surface, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 12, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  menuHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 10 },
  menuTitle: { fontSize: 13, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text, marginBottom: 2 },
  menuSub: { fontSize: 10, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600", lineHeight: 14 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginLeft: 6 },
  badgeText: { fontSize: 9, fontFamily: FONTS.body, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: THEME.border, alignSelf: "center", marginBottom: 20 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  modalIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: "700", color: THEME.text },
  modalSub: { fontSize: 12, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600", marginTop: 2 },
  inputWrap: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, marginBottom: 6, letterSpacing: 0.5 },
  input: { backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.border, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: FONTS.body, color: THEME.text, fontWeight: "700" },
  confirmBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  confirmText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  cancelText: { color: THEME.muted, fontFamily: FONTS.body, fontWeight: "800", fontSize: 14 },
});