// apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
// =========================================================
// ADMIN TRANSACTIONS v6.1 — Direct Transf'air
// ✅ v6.0 : thème clair, cartes compactes, modal d'actions
// ✅ FIX v6.1 : filtres invisibles — même bug que transactions client
//    FlatList horizontal + gap: 8 → ScrollView + marginRight sur pills
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Platform,
  TextInput, Animated, Modal, ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Tokens ──────────────────────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  blue:     "#1956F0", blueLt: "#EEF2FF", blueMd: "#C7D5FF",
  sky:      "#0284C7", skyLt:  "#E0F2FE", skyMd:  "#7DD3FC",
  violet:   "#7C3AED", violetLt: "#EDE9FE", violetMd: "#C4B5FD",
  green:    "#16A34A", greenLt: "#DCFCE7",
  red:      "#DC2626", redLt:   "#FEE2E2",
  amber:    "#D97706", amberLt: "#FEF3C7",
  teal:     "#0F766E", tealLt:  "#CCFBF1", tealMd: "#5EEAD4",
  white:    "#FFFFFF",
  radius:   { sm: 8, md: 12, lg: 16 },
  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "monospace" }),
  },
  shadow: {
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  },
};

const ROLE_ACCENT: Record<string, { color: string; lt: string; md: string; label: string }> = {
  SUPER_ADMIN:   { color: T.violet, lt: T.violetLt, md: T.violetMd, label: "SUPER ADMIN"   },
  COMPANY_ADMIN: { color: T.sky,    lt: T.skyLt,    md: T.skyMd,    label: "ADMIN SOCIÉTÉ" },
};

const STATUS_CONFIG: Record<string, {
  labelAdmin: string; labelSA: string;
  color: string; bg: string; icon: string;
}> = {
  PENDING:    { labelAdmin: "EN ATTENTE",  labelSA: "EN ATTENTE",  color: T.amber,   bg: T.amberLt,  icon: "time-outline" },
  VALIDATED:  { labelAdmin: "VALIDÉE",     labelSA: "VALIDÉE",     color: T.blue,    bg: T.blueLt,   icon: "shield-checkmark-outline" },
  PAID:       { labelAdmin: "PAYÉE",       labelSA: "REÇU",        color: T.teal,    bg: T.tealLt,   icon: "checkmark-done-circle-outline" },
  PROCESSING: { labelAdmin: "TRAITEMENT",  labelSA: "TRAITEMENT",  color: T.blue,    bg: T.blueLt,   icon: "sync-outline" },
  CANCELLED:  { labelAdmin: "ANNULÉE",     labelSA: "ANNULÉE",     color: T.inkMuted,bg: T.borderLt, icon: "close-circle-outline" },
  FAILED:     { labelAdmin: "ÉCHOUÉE",     labelSA: "ÉCHOUÉE",     color: T.red,     bg: T.redLt,    icon: "alert-circle-outline" },
  REFUNDED:   { labelAdmin: "REMBOURSÉE",  labelSA: "REMBOURSÉE",  color: T.violet,  bg: T.violetLt, icon: "return-down-back-outline" },
};

const STATUS_FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED"] as const;

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }).replace(",", "");
  } catch { return "—"; }
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status, isSA }: { status: string; isSA: boolean }) {
  const cfg = STATUS_CONFIG[status] ?? {
    labelAdmin: status, labelSA: status,
    color: T.inkMuted, bg: T.borderLt, icon: "help-circle-outline",
  };
  return (
    <View style={[sbS.pill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}35` }]}>
      <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[sbS.txt, { color: cfg.color, fontFamily: T.font.sans }]}>
        {isSA ? cfg.labelSA : cfg.labelAdmin}
      </Text>
    </View>
  );
}
const sbS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  txt:  { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});

// ─── Tx Card ─────────────────────────────────────────────
function TxCard({ item, isSA, accent, onPress }: {
  item: any; isSA: boolean; accent: string; onPress: () => void;
}) {
  const scale       = useRef(new Animated.Value(1)).current;
  const amount      = toNum(item.amount);
  const isB2B       = item.type === "SERVICE_PAYMENT";
  const stripeColor = STATUS_CONFIG[item.status]?.color ?? T.inkMuted;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tcS.card} activeOpacity={1} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[tcS.stripe, { backgroundColor: stripeColor }]} />
        <View style={tcS.body}>
          <View style={tcS.row}>
            <View style={[tcS.iconBox, { backgroundColor: isB2B ? T.violetLt : T.skyLt }]}>
              <Ionicons
                name={isB2B ? "swap-horizontal" : "paper-plane-outline"}
                size={15} color={isB2B ? T.violet : T.sky}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tcS.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>
                {item.reference}
              </Text>
              <Text style={[tcS.date, { fontFamily: T.font.sans }]}>
                {fmtDate(item.createdAt)}
                {item.sender ? `  ·  ${item.sender.firstName} ${item.sender.lastName}` : ""}
              </Text>
            </View>
            <View style={tcS.right}>
              <Text style={[tcS.amount, { color: T.ink, fontFamily: T.font.display }]}>
                {fmt(amount, item.currency)}
              </Text>
              <Text style={[tcS.currency, { color: accent, fontFamily: T.font.mono }]}>
                {item.currency}
              </Text>
            </View>
          </View>
          <View style={tcS.foot}>
            <StatusBadge status={item.status} isSA={isSA} />
            <View style={tcS.chevronWrap}>
              <Ionicons name="chevron-forward" size={13} color={T.inkMuted} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const tcS = StyleSheet.create({
  card:      { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft },
  stripe:    { width: 4 },
  body:      { flex: 1, padding: 13, gap: 10 },
  row:       { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox:   { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  ref:       { fontSize: 12, fontWeight: "800", color: T.ink, marginBottom: 2 },
  date:      { fontSize: 10, color: T.inkMuted, fontWeight: "600" },
  right:     { alignItems: "flex-end" },
  amount:    { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  currency:  { fontSize: 9, fontWeight: "800", marginTop: 2 },
  foot:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chevronWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
});

// ─── Modal d'actions ──────────────────────────────────────
function TxActionModal({ visible, onClose, tx, isSA, accent, accentLt, onRefresh }: {
  visible: boolean; onClose: () => void; tx: any; isSA: boolean;
  accent: string; accentLt: string; onRefresh: () => void;
}) {
  const [loading,   setLoading]   = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [newAmount, setNewAmount] = useState("");

  const reset = () => { setEditMode(false); setNewAmount(""); };
  const handleClose = () => { reset(); onClose(); };
  if (!tx) return null;

  const amount    = toNum(tx.amount);
  const fees      = toNum(tx.fees ?? 0);
  const isB2B     = tx.type === "SERVICE_PAYMENT";
  const isPending = tx.status === "PENDING";
  const stripeColor = STATUS_CONFIG[tx.status]?.color ?? T.inkMuted;

  const handleValidate = async () => {
    setLoading(true);
    try {
      if (isB2B) await api.validateBankTransfer(tx.id);
      else await api.adminUpdateTransactionStatus(tx.id, "VALIDATED");
      Alert.alert("✅ Validée", "Transaction validée avec succès.");
      handleClose(); onRefresh();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de valider.");
    } finally { setLoading(false); }
  };

  const handleReject = () => {
    Alert.alert("Rejeter la transaction", "Cette action est irréversible. Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Rejeter", style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            if (isB2B) await api.rejectBankTransfer(tx.id);
            else await api.adminUpdateTransactionStatus(tx.id, "CANCELLED");
            Alert.alert("❌ Rejetée", "Transaction rejetée.");
            handleClose(); onRefresh();
          } catch (e: any) {
            Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de rejeter.");
          } finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert("Supprimer la transaction", "Cette action est irréversible. Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await api.adminUpdateTransactionStatus(tx.id, "CANCELLED");
            Alert.alert("🗑️ Supprimée", "Transaction annulée.");
            handleClose(); onRefresh();
          } catch (e: any) {
            Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de supprimer.");
          } finally { setLoading(false); }
        },
      },
    ]);
  };

  const handleEditAmount = async () => {
    const parsed = Number(newAmount.replace(/\s/g, "").replace(",", "."));
    if (!parsed || parsed <= 0) { Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0."); return; }
    setLoading(true);
    try {
      await api.http.patch(`/transactions/${tx.id}`, { amount: parsed });
      Alert.alert("✅ Modifiée", `Nouveau montant : ${fmt(parsed, tx.currency)} ${tx.currency}`);
      reset(); handleClose(); onRefresh();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message ?? "Modification impossible.");
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={maS.overlay}>
        <View style={maS.sheet}>
          <View style={maS.handle} />
          <View style={maS.header}>
            <View style={[maS.stripe, { backgroundColor: stripeColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[maS.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>{tx.reference}</Text>
              <Text style={[maS.date, { fontFamily: T.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
            </View>
            <TouchableOpacity style={maS.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={17} color={T.inkSub} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={maS.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={maS.detailCard}>
              <View style={maS.detailRow}>
                <Text style={[maS.detailLabel, { fontFamily: T.font.sans }]}>MONTANT</Text>
                <Text style={[maS.detailVal, { fontFamily: T.font.display, color: T.ink }]}>{fmt(amount, tx.currency)} {tx.currency}</Text>
              </View>
              {fees > 0 && (
                <View style={maS.detailRow}>
                  <Text style={[maS.detailLabel, { fontFamily: T.font.sans }]}>FRAIS</Text>
                  <Text style={[maS.detailVal, { fontFamily: T.font.mono, color: T.inkSub }]}>{fmt(fees, tx.currency)}</Text>
                </View>
              )}
              {tx.sender && (
                <View style={maS.detailRow}>
                  <Text style={[maS.detailLabel, { fontFamily: T.font.sans }]}>ÉMETTEUR</Text>
                  <Text style={[maS.detailVal, { fontFamily: T.font.sans, color: T.ink }]}>{tx.sender.firstName} {tx.sender.lastName}</Text>
                </View>
              )}
              <View style={[maS.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={[maS.detailLabel, { fontFamily: T.font.sans }]}>STATUT</Text>
                <StatusBadge status={tx.status} isSA={isSA} />
              </View>
            </View>

            {/* SUPER_ADMIN */}
            {isSA && (
              <>
                <View style={[maS.roleBanner, { backgroundColor: T.violetLt, borderColor: T.violetMd }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={T.violet} />
                  <Text style={[maS.roleBannerTxt, { color: T.violet, fontFamily: T.font.sans }]}>Super Admin · Vous recevez ce montant</Text>
                </View>
                {isPending ? (
                  <View style={maS.actionsCol}>
                    <TouchableOpacity style={[maS.actionBtn, { backgroundColor: T.tealLt, borderColor: T.tealMd }]} onPress={handleValidate} disabled={loading}>
                      {loading ? <ActivityIndicator color={T.teal} size="small" /> : <>
                        <Ionicons name="checkmark-circle-outline" size={20} color={T.teal} />
                        <Text style={[maS.actionTxt, { color: T.teal, fontFamily: T.font.sans }]}>Valider · Créditer mon compte</Text>
                      </>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[maS.actionBtn, { backgroundColor: T.redLt, borderColor: `${T.red}35` }]} onPress={handleReject} disabled={loading}>
                      <Ionicons name="close-circle-outline" size={20} color={T.red} />
                      <Text style={[maS.actionTxt, { color: T.red, fontFamily: T.font.sans }]}>Rejeter · Rembourser l'admin</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={maS.noActionBox}>
                    <Ionicons name="lock-closed-outline" size={18} color={T.inkMuted} />
                    <Text style={[maS.noActionTxt, { fontFamily: T.font.sans }]}>Transaction déjà traitée — aucune action disponible</Text>
                  </View>
                )}
              </>
            )}

            {/* COMPANY_ADMIN */}
            {!isSA && (
              <>
                <View style={[maS.roleBanner, { backgroundColor: T.skyLt, borderColor: T.skyMd }]}>
                  <Ionicons name="business-outline" size={14} color={T.sky} />
                  <Text style={[maS.roleBannerTxt, { color: T.sky, fontFamily: T.font.sans }]}>Admin Société · Gestion de vos transactions</Text>
                </View>
                {!editMode ? (
                  <View style={maS.actionsCol}>
                    <TouchableOpacity style={[maS.actionBtn, { backgroundColor: T.skyLt, borderColor: T.skyMd }]} onPress={() => { setNewAmount(String(amount)); setEditMode(true); }} disabled={loading}>
                      <Ionicons name="pencil-outline" size={20} color={T.sky} />
                      <Text style={[maS.actionTxt, { color: T.sky, fontFamily: T.font.sans }]}>Modifier le montant</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[maS.actionBtn, { backgroundColor: T.redLt, borderColor: `${T.red}35` }]} onPress={handleDelete} disabled={loading}>
                      {loading ? <ActivityIndicator color={T.red} size="small" /> : <>
                        <Ionicons name="trash-outline" size={20} color={T.red} />
                        <Text style={[maS.actionTxt, { color: T.red, fontFamily: T.font.sans }]}>Supprimer la transaction</Text>
                      </>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={maS.editBlock}>
                    <Text style={[maS.editLabel, { fontFamily: T.font.sans }]}>NOUVEAU MONTANT</Text>
                    <View style={maS.editRow}>
                      <TextInput
                        style={[maS.editInput, { fontFamily: T.font.mono }]}
                        value={newAmount} onChangeText={setNewAmount}
                        keyboardType="numeric" placeholder={fmt(amount, tx.currency)}
                        placeholderTextColor={T.inkMuted} autoFocus
                      />
                      <View style={maS.editCurrTag}>
                        <Text style={[maS.editCurrTxt, { fontFamily: T.font.sans }]}>{tx.currency}</Text>
                      </View>
                    </View>
                    <View style={maS.editActions}>
                      <TouchableOpacity style={maS.editCancelBtn} onPress={() => { setEditMode(false); setNewAmount(""); }} disabled={loading}>
                        <Text style={[maS.editCancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[maS.editConfirmBtn, { backgroundColor: T.sky }]} onPress={handleEditAmount} disabled={loading}>
                        {loading ? <ActivityIndicator color={T.white} size="small" /> :
                          <Text style={[maS.editConfirmTxt, { fontFamily: T.font.sans }]}>Confirmer</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const maS = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "80%", borderWidth: 1, borderColor: T.border },
  handle:   { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  header:   { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  stripe:   { width: 4, height: 40, borderRadius: 99 },
  ref:      { fontSize: 13, fontWeight: "800", color: T.ink, marginBottom: 2 },
  date:     { fontSize: 11, color: T.inkMuted, fontWeight: "600" },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
  body:     { padding: 16 },
  detailCard:  { backgroundColor: T.borderLt, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, marginBottom: 16, overflow: "hidden" },
  detailRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  detailLabel: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8 },
  detailVal:   { fontSize: 14, fontWeight: "700" },
  roleBanner:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 14 },
  roleBannerTxt: { fontSize: 11, fontWeight: "700" },
  actionsCol:    { gap: 10, marginBottom: 8 },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: T.radius.md, borderWidth: 1.5 },
  actionTxt:     { fontSize: 14, fontWeight: "700", flex: 1 },
  noActionBox:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.borderLt, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: T.border },
  noActionTxt:   { flex: 1, fontSize: 12, color: T.inkMuted, fontWeight: "600" },
  editBlock:       { gap: 10 },
  editLabel:       { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 4 },
  editRow:         { flexDirection: "row", gap: 10 },
  editInput:       { flex: 1, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: "700", color: T.ink },
  editCurrTag:     { paddingHorizontal: 14, paddingVertical: 12, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.skyMd, backgroundColor: T.skyLt, justifyContent: "center" },
  editCurrTxt:     { fontSize: 12, fontWeight: "900", color: T.sky },
  editActions:     { flexDirection: "row", gap: 10, marginTop: 4 },
  editCancelBtn:   { flex: 1, paddingVertical: 13, borderRadius: T.radius.md, backgroundColor: T.borderLt, borderWidth: 1, borderColor: T.border, alignItems: "center" },
  editCancelTxt:   { fontSize: 13, fontWeight: "700", color: T.inkSub },
  editConfirmBtn:  { flex: 2, paddingVertical: 13, borderRadius: T.radius.md, alignItems: "center" },
  editConfirmTxt:  { fontSize: 13, fontWeight: "900", color: T.white },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AdminTransactionsScreen() {
  const router    = useRouter();
  const { user }  = useAuth();
  const isSA      = user?.role === "SUPER_ADMIN";
  const roleTheme = ROLE_ACCENT[user?.role ?? "COMPANY_ADMIN"] ?? ROLE_ACCENT.COMPANY_ADMIN;
  const accent    = roleTheme.color;

  const [transactions,  setTransactions]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeFilter,  setActiveFilter]  = useState<string>("ALL");
  const [q,             setQ]             = useState("");
  const [selectedTx,    setSelectedTx]    = useState<any>(null);
  const [modalVisible,  setModalVisible]  = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const data = await api.adminGetTransactions();
      setTransactions(Array.isArray(data) ? data : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { void loadTransactions(); }, [loadTransactions]));

  const openModal  = (tx: any) => { setSelectedTx(tx); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setTimeout(() => setSelectedTx(null), 300); };

  const filtered = transactions.filter((tx) => {
    if (activeFilter !== "ALL" && tx.status !== activeFilter) return false;
    if (q.trim()) {
      const sq = q.toLowerCase();
      return (tx.reference ?? "").toLowerCase().includes(sq)
        || `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.toLowerCase().includes(sq)
        || (tx.currency ?? "").toLowerCase().includes(sq);
    }
    return true;
  });

  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Transactions</Text>
          <Text style={[s.headerSub, { color: accent, fontFamily: T.font.sans }]}>
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
            {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
          </Text>
        </View>
        <View style={[s.roleBadge, { backgroundColor: roleTheme.lt, borderColor: roleTheme.md }]}>
          <Text style={[s.roleTxt, { color: accent, fontFamily: T.font.sans }]}>{roleTheme.label}</Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: `${accent}12` }]} onPress={() => void loadTransactions()}>
          <Ionicons name="refresh" size={19} color={accent} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={T.inkMuted} />
        <TextInput
          style={[s.searchInput, { fontFamily: T.font.sans }]}
          value={q} onChangeText={setQ}
          placeholder="Référence, nom, devise..."
          placeholderTextColor={T.inkMuted}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
            <Ionicons name="close" size={13} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ FIX v6.1 — ScrollView + marginRight au lieu de FlatList + gap ──── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtersWrap}
        contentContainerStyle={s.filtersList}
      >
        {STATUS_FILTERS.map((item) => {
          const isActive = activeFilter === item;
          const cfg = item !== "ALL" ? STATUS_CONFIG[item as keyof typeof STATUS_CONFIG] : null;
          const count = item === "ALL"
            ? transactions.length
            : transactions.filter((t) => t.status === item).length;
          return (
            <TouchableOpacity
              key={item}
              style={[
                s.filterPill,
                isActive && { backgroundColor: cfg ? cfg.bg : roleTheme.lt, borderColor: cfg ? `${cfg.color}30` : roleTheme.md },
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[
                s.filterTxt,
                { fontFamily: T.font.sans, color: isActive ? (cfg?.color ?? accent) : T.inkSub },
              ]}>
                {item === "ALL" ? "Toutes" : (isSA ? cfg?.labelSA : cfg?.labelAdmin) ?? item}
              </Text>
              <View style={[s.filterCount, { backgroundColor: isActive ? `${(cfg?.color ?? accent)}15` : T.pageBg }]}>
                <Text style={[
                  s.filterCountTxt,
                  { color: isActive ? (cfg?.color ?? accent) : T.inkMuted, fontFamily: T.font.mono },
                ]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Liste ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TxCard item={item} isSA={isSA} accent={accent} onPress={() => openModal(item)} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="analytics-outline" size={36} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune transaction</Text>
              <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>Modifiez les filtres</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      <TxActionModal
        visible={modalVisible} onClose={closeModal} tx={selectedTx}
        isSA={isSA} accent={accent} accentLt={roleTheme.lt}
        onRefresh={() => { closeModal(); void loadTransactions(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.surface,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.ink, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  roleBadge:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  roleTxt:     { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  iconBtn:     { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  searchBox:   { flexDirection: "row", alignItems: "center", margin: 14, marginBottom: 0, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10, ...T.shadow.soft },
  searchInput: { flex: 1, fontSize: 13, color: T.ink, fontWeight: "600" },
  clearBtn:    { width: 24, height: 24, borderRadius: 7, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },

  // ✅ FIX v6.1 : pas de gap ici → marginRight sur chaque pill
  filtersWrap: { marginTop: 12, flexShrink: 0 },
  filtersList: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: T.radius.md,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
    marginRight: 8,  // ✅ remplace gap dans le parent
  },
  filterTxt:      { fontSize: 11, fontWeight: "800" },
  filterCount:    { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },

  list:     { padding: 14 },
  empty:    { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTxt: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 13, fontWeight: "600" },
});