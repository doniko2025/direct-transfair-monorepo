// components/dashboards/CompanyDashboard.tsx
import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Animated, ScrollView, SafeAreaView, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const C = {
  bg: "#F5F7FA",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E8ECF2",
  accent: "#1E40AF",
  accentMid: "#3B82F6",
  accentSoft: "#EFF6FF",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  success: "#059669",
  successSoft: "#ECFDF5",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  teal: "#0891B2",
  tealSoft: "#ECFEFF",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  textFaint: "#CBD5E1",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmtCurrency(v: unknown, currency = "XOF"): string {
  return `${toNum(v).toLocaleString("fr-FR")} ${currency}`;
}
function getErr(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const x = e as { response?: { data?: { message?: string } }; message?: string };
    return x.response?.data?.message ?? x.message ?? "Erreur technique.";
  }
  return "Erreur technique.";
}

function MenuCard({
  title, subtitle, icon, color, bgColor, onPress, wide = false, badge,
}: {
  title: string; subtitle: string; icon: string; color: string; bgColor: string;
  onPress: () => void; wide?: boolean; badge?: string;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, wide ? { width: "100%" } : { flex: 1, minWidth: 0 }]}>
      <TouchableOpacity
        style={s.menuCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[s.menuIcon, { backgroundColor: bgColor }]}>
          <Ionicons name={icon as any} size={19} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.menuTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.menuSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        {badge ? (
          <View style={[s.badge, { backgroundColor: bgColor }]}>
            <Text style={[s.badgeText, { color }]}>{badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={14} color={C.textFaint} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [refBancaire, setRefBancaire] = useState("");
  const [processing, setProcessing] = useState(false);

  const clientName = useMemo(() => user?.client?.name || "Mon Entreprise", [user?.client?.name]);
  const currency = useMemo(() => (user as any)?.currency || "XOF", [user]);

  const loadData = async () => {
    setRefreshing(true);
    try { await refreshUser(); } finally { setRefreshing(false); }
  };

  const closeModal = () => { setModalVisible(false); setAmount(""); setRefBancaire(""); };

  const handlePay = async () => {
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) return Alert.alert("Montant invalide", "Saisis un montant valide.");
    setProcessing(true);
    try {
      await api.declareBankTransfer(n, refBancaire);
      closeModal();
      Alert.alert("✓ Succès", "Paiement déclaré avec succès.");
      await loadData();
    } catch (e) {
      Alert.alert("Erreur", getErr(e));
    } finally { setProcessing(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>{(clientName[0] ?? "C").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{clientName}</Text>
          <Text style={s.headerSub}>Pilotage Société</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
          <Ionicons name="notifications-outline" size={20} color={C.textSub} />
          <View style={s.notifDot} />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn} onPress={loadData}>
          <Ionicons name="refresh-outline" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.accentMid} />}
      >
        {/* Hero Balance */}
        <View style={s.hero}>
          <View style={s.heroDeco1} />
          <View style={s.heroDeco2} />
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>Trésorerie Globale</Text>
              <Text style={s.heroAmount}>{fmtCurrency(user?.balance, currency)}</Text>
            </View>
            <TouchableOpacity style={s.heroArrow} onPress={() => router.push("/(tabs)/admin/treasury")}>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroBottom}>
            <View style={s.heroStatus}>
              <View style={s.greenDot} />
              <Text style={s.heroStatusText}>Compte actif</Text>
            </View>
            <TouchableOpacity style={s.payBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="card-outline" size={13} color={C.accent} />
              <Text style={s.payBtnText}>Payer une facture</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Strip */}
        <View style={s.strip}>
          {[
            { icon: "storefront-outline", val: "—", lbl: "Agences", color: C.accentMid },
            { icon: "people-outline", val: "—", lbl: "Staff", color: C.purple },
            { icon: "checkmark-circle-outline", val: "Actif", lbl: "Statut", color: C.success },
          ].map((item, i) => (
            <View key={item.lbl} style={[s.stripChip, i < 2 && s.stripBorder]}>
              <Ionicons name={item.icon as any} size={16} color={item.color} />
              <Text style={[s.stripVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.stripLbl}>{item.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Réseau */}
        <Text style={s.sectionLabel}>RÉSEAU</Text>
        <View style={s.section}>
          <MenuCard title="Créer une Agence" subtitle="Étendre votre réseau physique"
            icon="add-circle-outline" color={C.purple} bgColor={C.purpleSoft}
            onPress={() => router.push("/(tabs)/admin/agencies/create")} wide badge="Nouveau" />
          <View style={s.row}>
            <MenuCard title="Agences" subtitle="Voir la liste"
              icon="storefront-outline" color={C.accentMid} bgColor={C.accentSoft}
              onPress={() => router.push("/(tabs)/admin/agencies")} />
            <MenuCard title="Utilisateurs" subtitle="Staff & agents"
              icon="people-outline" color={C.amber} bgColor={C.amberSoft}
              onPress={() => router.push("/(tabs)/admin/users")} />
          </View>
        </View>

        {/* Finance */}
        <Text style={[s.sectionLabel, { marginTop: 18 }]}>FINANCE & COMMISSIONS</Text>
        <View style={s.section}>
          <View style={s.row}>
            <MenuCard title="Config. Règles" subtitle="Taux & paliers"
              icon="settings-outline" color={C.teal} bgColor={C.tealSoft}
              onPress={() => router.push("/(tabs)/admin/commissions/config")} />
            <MenuCard title="Suivi Global" subtitle="Gains & audit"
              icon="pie-chart-outline" color={C.danger} bgColor={C.dangerSoft}
              onPress={() => router.push("/admin/commissions")} />
          </View>
          <MenuCard title="Taux de Change" subtitle="Devises & conversions en temps réel"
            icon="cash-outline" color={C.success} bgColor={C.successSoft}
            onPress={() => router.push("/(tabs)/admin/rates")} wide />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Modal Paiement */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Payer une Facture</Text>
            <Text style={s.modalSub}>Déclaration de virement bancaire</Text>

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Montant (FCFA)</Text>
              <View style={s.inputRow}>
                <Ionicons name="cash-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                <TextInput style={s.input} value={amount} onChangeText={setAmount}
                  keyboardType="numeric" placeholder="Ex: 500 000" placeholderTextColor={C.textFaint} />
              </View>
            </View>

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Référence virement <Text style={{ color: C.textMuted, fontWeight: "500" }}>(optionnel)</Text></Text>
              <View style={s.inputRow}>
                <Ionicons name="document-text-outline" size={18} color={C.textMuted} style={{ marginRight: 8 }} />
                <TextInput style={s.input} value={refBancaire} onChangeText={setRefBancaire}
                  placeholder="REF-2024-XXXX" placeholderTextColor={C.textFaint} autoCapitalize="characters" />
              </View>
            </View>

            <TouchableOpacity style={[s.confirmBtn, processing && { opacity: 0.7 }]} onPress={handlePay} disabled={processing}>
              {processing ? <ActivityIndicator color="#FFF" /> : (
                <><Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={s.confirmText}>VALIDER LE PAIEMENT</Text></>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={closeModal} style={s.cancelBtn} disabled={processing}>
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: C.white, borderBottomWidth: 1,
    borderBottomColor: C.border, gap: 10,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.accentSoft, justifyContent: "center", alignItems: "center" },
  headerAvatarText: { color: C.accent, fontSize: 16, fontWeight: "900" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  headerSub: { fontSize: 11, color: C.textMuted, fontWeight: "600", marginTop: 1 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.border },
  notifDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 99, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.white },
  content: { padding: 16 },
  hero: { backgroundColor: C.accent, borderRadius: 24, padding: 22, marginBottom: 14, overflow: "hidden" },
  heroDeco1: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -40, right: -40 },
  heroDeco2: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.05)", bottom: -10, left: 40 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  heroAmount: { color: "#FFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  heroArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 16 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  greenDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: "#34D399" },
  heroStatusText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  payBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  payBtnText: { color: C.accent, fontSize: 11, fontWeight: "800" },
  strip: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20, overflow: "hidden" },
  stripChip: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 3 },
  stripBorder: { borderRightWidth: 1, borderRightColor: C.border },
  stripVal: { fontSize: 14, fontWeight: "900" },
  stripLbl: { fontSize: 10, color: C.textMuted, fontWeight: "700", letterSpacing: 0.5 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: C.textMuted, letterSpacing: 1.4, marginBottom: 10, marginLeft: 2 },
  section: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  menuCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, gap: 12 },
  menuIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  menuTitle: { fontSize: 13, fontWeight: "800", color: C.text },
  menuSub: { fontSize: 11, color: C.textMuted, fontWeight: "600", marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: "900" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: C.textMuted, fontWeight: "600", marginBottom: 22 },
  inputWrap: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: C.textSub, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13 },
  input: { flex: 1, fontSize: 15, color: C.text, fontWeight: "600" },
  confirmBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  confirmText: { color: "#FFF", fontWeight: "800", fontSize: 14, letterSpacing: 0.4 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelText: { color: C.textMuted, fontWeight: "700", fontSize: 14 },
});