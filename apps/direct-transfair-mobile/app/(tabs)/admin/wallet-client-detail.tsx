// apps/direct-transfair-mobile/app/(tabs)/admin/wallet-client-detail.tsx
// =========================================================
// ADMIN WALLET CLIENT DETAIL v1.0 — Direct Transf'air
// ✅ Fichier 100% indépendant — aucune modification existante
// ✅ Informations personnelles complètes
// ✅ Portefeuilles (wallets) par devise
// ✅ Transactions envoyées & reçues avec filtres
// ✅ Actions : modifier, suspendre, réactiver, supprimer
// ✅ Modal d'édition en bottom-sheet
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Alert, Platform, StatusBar,
  TextInput, Modal, KeyboardAvoidingView, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Design Tokens ───────────────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  orange:   "#F97316", orangeLt: "#FFF7ED", orangeMd: "#FED7AA",
  blue:     "#1956F0", blueLt:   "#EEF2FF", blueMd:   "#C7D5FF",
  green:    "#16A34A", greenLt:  "#DCFCE7", greenMd:  "#86EFAC",
  red:      "#DC2626", redLt:    "#FEE2E2",
  amber:    "#D97706", amberLt:  "#FEF3C7",
  violet:   "#7C3AED", violetLt: "#EDE9FE",
  teal:     "#0F766E", tealLt:   "#CCFBF1", tealMd: "#5EEAD4",
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
  },
  shadow: {
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
  },
};

// ─── Helpers ─────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  GN:"🇬🇳", SN:"🇸🇳", ML:"🇲🇱", CI:"🇨🇮", BF:"🇧🇫",
  FR:"🇫🇷", GB:"🇬🇧", US:"🇺🇸", DE:"🇩🇪", BE:"🇧🇪",
  ES:"🇪🇸", IT:"🇮🇹", PT:"🇵🇹", NL:"🇳🇱", AT:"🇦🇹",
  NE:"🇳🇪", TG:"🇹🇬", MA:"🇲🇦", NG:"🇳🇬", CM:"🇨🇲",
};

const KYC_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  LEVEL_0: { label: "Niveau 0 — Aucun", color: T.inkMuted, bg: T.pageBg  },
  LEVEL_1: { label: "Niveau 1 — Pièce ID", color: T.amber,  bg: T.amberLt },
  LEVEL_2: { label: "Niveau 2 — Domicile", color: T.blue,   bg: T.blueLt  },
  LEVEL_3: { label: "Niveau 3 — Full KYC", color: T.green,  bg: T.greenLt },
};

const COMPLIANCE_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CLEAR:   { label: "RAS",        color: T.green, bg: T.greenLt, icon: "shield-checkmark-outline" },
  REVIEW:  { label: "En révision", color: T.amber, bg: T.amberLt, icon: "time-outline"             },
  BLOCKED: { label: "Bloqué AML", color: T.red,   bg: T.redLt,   icon: "alert-circle-outline"     },
};

const CURRENCY_COLORS: Record<string, { color: string; bg: string }> = {
  EUR: { color: "#1956F0", bg: "#EEF2FF" },
  USD: { color: "#16A34A", bg: "#DCFCE7" },
  XOF: { color: "#D97706", bg: "#FEF3C7" },
  GNF: { color: "#DC2626", bg: "#FEE2E2" },
  GBP: { color: "#7C3AED", bg: "#EDE9FE" },
};

function getFlag(country?: string): string {
  if (!country) return "🌍";
  const upper = country.toUpperCase().trim();
  if (upper.length === 2) return FLAG_MAP[upper] ?? "🌍";
  const cn = upper;
  if (cn.includes("GUIN") && !cn.includes("BISS")) return "🇬🇳";
  if (cn.includes("FRANC")) return "🇫🇷";
  if (cn.includes("SÉNÉG") || cn.includes("SENEG")) return "🇸🇳";
  return "🌍";
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName ?? "").trim()[0] ?? "";
  const l = (lastName  ?? "").trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).replace(",", "");
  } catch { return "—"; }
}

function fmtDateShort(d?: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return "—"; }
}

// ─── Info Row ──────────────────────────────────────────────
function InfoRow({ label, value, icon, accent = T.blue }: {
  label: string; value?: string | null; icon: string; accent?: string;
}) {
  if (!value) return null;
  return (
    <View style={ir.row}>
      <View style={[ir.iconBox, { backgroundColor: `${accent}12` }]}>
        <Ionicons name={icon as any} size={14} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ir.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[ir.value, { fontFamily: T.font.sans }]}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" },
  value:   { fontSize: 13, fontWeight: "700", color: T.ink },
});

// ─── Section Header ────────────────────────────────────────
function SH({ dot, label, right }: { dot: string; label: string; right?: React.ReactNode }) {
  return (
    <View style={sh.row}>
      <View style={[sh.dot, { backgroundColor: dot }]} />
      <Text style={[sh.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {right}
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dot:   { width: 6, height: 6, borderRadius: 99 },
  label: { flex: 1, fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Wallet Row ────────────────────────────────────────────
function WalletRow({ wallet }: { wallet: any }) {
  const currency  = wallet.currency ?? "XOF";
  const cfg       = CURRENCY_COLORS[currency] ?? { color: T.blue, bg: T.blueLt };
  const balance   = toNum(wallet.balance);
  const reserved  = toNum(wallet.reservedBalance ?? 0);
  const available = balance - reserved;
  const pct       = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;
  const isFrozen  = !!wallet.isFrozen;

  return (
    <View style={[wr.row, isFrozen && { opacity: 0.6 }]}>
      <View style={[wr.currBox, { backgroundColor: cfg.bg }]}>
        <Text style={[wr.curr, { color: cfg.color, fontFamily: T.font.mono }]}>{currency}</Text>
        {isFrozen && <Ionicons name="snow-outline" size={10} color={cfg.color} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={wr.topRow}>
          <Text style={[wr.lbl, { fontFamily: T.font.sans }]}>Solde total</Text>
          <Text style={[wr.balance, { color: cfg.color, fontFamily: T.font.mono }]}>
            {fmt(balance, currency)}
          </Text>
        </View>
        <View style={[wr.progBg, { backgroundColor: `${cfg.color}15` }]}>
          <View style={[wr.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
        </View>
        <View style={wr.subRow}>
          <Text style={[wr.sub, { fontFamily: T.font.sans }]}>Dispo: {fmt(available, currency)}</Text>
          <Text style={[wr.sub, { fontFamily: T.font.sans }]}>Réservé: {fmt(reserved, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
const wr = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  currBox: { width: 50, height: 50, borderRadius: 13, justifyContent: "center", alignItems: "center", gap: 2 },
  curr:    { fontSize: 11, fontWeight: "900" },
  topRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  lbl:     { fontSize: 10, color: T.inkMuted, fontWeight: "700" },
  balance: { fontSize: 14, fontWeight: "800" },
  progBg:  { height: 4, borderRadius: 99, overflow: "hidden", marginBottom: 5 },
  progFill:{ height: 4, borderRadius: 99 },
  subRow:  { flexDirection: "row", justifyContent: "space-between" },
  sub:     { fontSize: 10, color: T.inkSub, fontWeight: "600" },
});

// ─── Transaction Card (compact) ───────────────────────────
function TxCard({ tx, clientId, onPress }: {
  tx: any; clientId: string; onPress: () => void;
}) {
  const isSent     = tx.senderId === clientId || tx.sender?.id === clientId;
  const amount     = toNum(tx.amount);
  const currency   = tx.currency ?? "XOF";

  const STATUS_COLOR: Record<string, string> = {
    PAID: T.teal, VALIDATED: T.blue, PENDING: T.amber,
    CANCELLED: T.inkMuted, FAILED: T.red,
  };
  const stripe = STATUS_COLOR[tx.status] ?? T.inkMuted;

  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[tc.stripe, { backgroundColor: stripe }]} />
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: isSent ? T.orangeLt : T.greenLt, justifyContent: "center", alignItems: "center", margin: 12 }}>
        <Ionicons name={isSent ? "arrow-up-outline" : "arrow-down-outline"} size={14} color={isSent ? T.orange : T.green} />
      </View>
      <View style={{ flex: 1, paddingVertical: 12 }}>
        <Text style={[tc.ref,  { fontFamily: T.font.mono }]} numberOfLines={1}>{tx.reference}</Text>
        <Text style={[tc.date, { fontFamily: T.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end", paddingRight: 12, paddingVertical: 12 }}>
        <Text style={[tc.amount, { color: isSent ? T.orange : T.green, fontFamily: T.font.mono }]}>
          {isSent ? "−" : "+"}{fmt(amount, currency)}
        </Text>
        <Text style={[tc.cur, { fontFamily: T.font.mono }]}>{currency}</Text>
      </View>
    </TouchableOpacity>
  );
}
const tc = StyleSheet.create({
  card:   { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: T.radius.md, marginBottom: 8, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
  stripe: { width: 3, alignSelf: "stretch" },
  ref:    { fontSize: 11, fontWeight: "700", color: T.ink, marginBottom: 2 },
  date:   { fontSize: 10, color: T.inkMuted, fontWeight: "600" },
  amount: { fontSize: 13, fontWeight: "800" },
  cur:    { fontSize: 9, color: T.inkMuted, fontWeight: "700", marginTop: 1 },
});

// ─── Action Box ────────────────────────────────────────────
function ActionBox({ icon, label, color, bg, onPress, loading: load, destructive }: {
  icon: string; label: string; color: string; bg: string;
  onPress: () => void; loading?: boolean; destructive?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[ax.box, { backgroundColor: bg, borderColor: `${color}25` }]}
        onPress={onPress} disabled={load}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        {load
          ? <ActivityIndicator size="small" color={color} />
          : <>
              <Ionicons name={icon as any} size={20} color={color} />
              <Text style={[ax.label, { color, fontFamily: T.font.sans }]}>{label}</Text>
            </>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}
const ax = StyleSheet.create({
  box:   { alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: T.radius.md, borderWidth: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: "800", textAlign: "center" },
});

// ─── Edit Modal ────────────────────────────────────────────
function EditModal({ visible, client, onClose, onSaved }: {
  visible: boolean; client: any; onClose: () => void; onSaved: (updated: any) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [city,      setCity]      = useState("");
  const [saving,    setSaving]    = useState(false);

  React.useEffect(() => {
    if (visible && client) {
      setFirstName(client.firstName ?? "");
      setLastName( client.lastName  ?? "");
      setEmail(    client.email     ?? "");
      setPhone(    client.phone     ?? "");
      setCity(     client.city      ?? "");
    }
  }, [visible, client]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Erreur", "Prénom et nom sont obligatoires."); return;
    }
    setSaving(true);
    try {
      const res = await (api.http as any).patch(`/users/${client.id}`, {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim()  || undefined,
        phone:     phone.trim()  || undefined,
        city:      city.trim()   || undefined,
      });
      onSaved(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Impossible de modifier.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={em.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={em.sheet}>
            <View style={em.handle} />
            <View style={em.header}>
              <View style={{ flex: 1 }}>
                <Text style={[em.title, { fontFamily: T.font.display }]}>Modifier le client</Text>
                <Text style={[em.sub, { fontFamily: T.font.sans }]}>
                  {client?.firstName} {client?.lastName}
                </Text>
              </View>
              <TouchableOpacity style={em.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={17} color={T.inkSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={em.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Nom */}
              <View style={em.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[em.label, { fontFamily: T.font.sans }]}>PRÉNOM *</Text>
                  <View style={em.inputBox}>
                    <TextInput
                      style={[em.input, { fontFamily: T.font.sans }]}
                      value={firstName} onChangeText={setFirstName}
                      placeholder="Prénom" placeholderTextColor={T.inkMuted}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[em.label, { fontFamily: T.font.sans }]}>NOM *</Text>
                  <View style={em.inputBox}>
                    <TextInput
                      style={[em.input, { fontFamily: T.font.sans }]}
                      value={lastName} onChangeText={setLastName}
                      placeholder="Nom" placeholderTextColor={T.inkMuted}
                    />
                  </View>
                </View>
              </View>

              {/* Email */}
              <Text style={[em.label, { fontFamily: T.font.sans }]}>EMAIL</Text>
              <View style={em.inputBox}>
                <TextInput
                  style={[em.input, { fontFamily: T.font.sans }]}
                  value={email} onChangeText={setEmail}
                  placeholder="email@exemple.com" placeholderTextColor={T.inkMuted}
                  keyboardType="email-address" autoCapitalize="none"
                />
              </View>

              {/* Téléphone */}
              <Text style={[em.label, { fontFamily: T.font.sans }]}>TÉLÉPHONE</Text>
              <View style={em.inputBox}>
                <TextInput
                  style={[em.input, { fontFamily: T.font.sans }]}
                  value={phone} onChangeText={setPhone}
                  placeholder="+224 620 000 000" placeholderTextColor={T.inkMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Ville */}
              <Text style={[em.label, { fontFamily: T.font.sans }]}>VILLE</Text>
              <View style={em.inputBox}>
                <TextInput
                  style={[em.input, { fontFamily: T.font.sans }]}
                  value={city} onChangeText={setCity}
                  placeholder="Conakry, Paris…" placeholderTextColor={T.inkMuted}
                />
              </View>

              {/* Bouton */}
              <TouchableOpacity
                style={[em.saveBtn, saving && { opacity: 0.65 }]}
                onPress={handleSave} disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={T.white} />
                  : <>
                      <Ionicons name="save-outline" size={17} color={T.white} />
                      <Text style={[em.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={em.cancelBtn} onPress={onClose} disabled={saving}>
                <Text style={[em.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const em = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%" },
  handle:    { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  header:    { flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border, gap: 12 },
  title:     { color: T.ink, fontSize: 18, fontWeight: "700" },
  sub:       { color: T.inkSub, fontSize: 12, fontWeight: "600", marginTop: 2 },
  closeBtn:  { width: 30, height: 30, borderRadius: 8, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },
  body:      { padding: 20 },
  row2:      { flexDirection: "row", gap: 12 },
  label:     { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  inputBox:  { backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, marginBottom: 14 },
  input:     { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: T.ink, fontWeight: "600" },
  saveBtn:   { backgroundColor: T.orange, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginBottom: 10 },
  saveTxt:   { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelTxt: { color: T.inkSub, fontWeight: "700", fontSize: 14 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function WalletClientDetailScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user: adminUser } = useAuth();

  const clientId = Array.isArray(id) ? id[0] : id;

  const [client,       setClient]       = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [processing,   setProcessing]   = useState(false);
  const [editModal,    setEditModal]    = useState(false);
  const [txFilter,     setTxFilter]     = useState<"ALL" | "SENT" | "RECEIVED">("ALL");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Chargement ─────────────────────────────────────────
  const loadClient = useCallback(async () => {
    if (!clientId) { setErrorMsg("ID invalide."); setLoading(false); return; }
    setLoading(true); setErrorMsg(null);
    try {
      // Charge le client
      let clientData: any = null;
      try {
        const res = await (api.http as any).get(`/users/${clientId}`);
        clientData = res.data;
      } catch {
        // Fallback : filtrer depuis la liste complète
        const all  = await api.getUsers();
        const arr  = Array.isArray(all) ? all : (all as any)?.data ?? [];
        clientData = arr.find((u: any) => String(u.id) === String(clientId)) ?? null;
      }
      setClient(clientData);

      // Charge les transactions
      try {
        const allTx = await api.adminGetTransactions();
        const arr   = Array.isArray(allTx) ? allTx : [];
        const userTx = arr.filter((tx: any) =>
          String(tx.senderId)    === String(clientId) ||
          String(tx.recipientId) === String(clientId) ||
          String(tx.sender?.id)  === String(clientId),
        );
        setTransactions(userTx);
      } catch { setTransactions([]); }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e: any) {
      setErrorMsg(e?.response?.status === 404 ? "Client introuvable." : "Erreur lors du chargement.");
    } finally { setLoading(false); }
  }, [clientId, fadeAnim]);

  useFocusEffect(useCallback(() => { void loadClient(); return () => {}; }, [loadClient]));

  // ── Actions ────────────────────────────────────────────
  const handleSuspend = () => {
    Alert.alert("Suspendre le compte", `Confirmer la suspension de ${client?.firstName} ${client?.lastName} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Suspendre", style: "destructive",
        onPress: async () => {
          setProcessing(true);
          try {
            await api.suspendUser(clientId!);
            setClient((prev: any) => ({ ...prev, isSuspended: true, suspendedAt: new Date().toISOString() }));
            Alert.alert("✅ Suspendu", "Compte suspendu avec succès.");
          } catch (e: any) {
            Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de suspendre.");
          } finally { setProcessing(false); }
        },
      },
    ]);
  };

  const handleReactivate = () => {
    Alert.alert("Réactiver le compte", `Confirmer la réactivation de ${client?.firstName} ${client?.lastName} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Réactiver",
        onPress: async () => {
          setProcessing(true);
          try {
            await api.reactivateUser(clientId!);
            setClient((prev: any) => ({ ...prev, isSuspended: false, suspendedAt: null }));
            Alert.alert("✅ Réactivé", "Compte réactivé avec succès.");
          } catch (e: any) {
            Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de réactiver.");
          } finally { setProcessing(false); }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      "⚠️ Supprimer le compte",
      `Cette action est irréversible.\n\nVoulez-vous supprimer définitivement le compte de ${client?.firstName} ${client?.lastName} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            setProcessing(true);
            try {
              await (api.http as any).delete(`/users/${clientId}`);
              Alert.alert("🗑️ Supprimé", "Compte supprimé avec succès.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert("Erreur", e?.response?.data?.message ?? "Impossible de supprimer.");
            } finally { setProcessing(false); }
          },
        },
      ],
    );
  };

  // ── Transactions filtrées ──────────────────────────────
  const filteredTx = React.useMemo(() => {
    if (!client) return [];
    if (txFilter === "SENT")     return transactions.filter(tx => String(tx.senderId)    === String(clientId) || String(tx.sender?.id) === String(clientId));
    if (txFilter === "RECEIVED") return transactions.filter(tx => String(tx.recipientId) === String(clientId));
    return transactions;
  }, [transactions, txFilter, client, clientId]);

  // ── Loading / Error states ────────────────────────────
  if (loading) return (
    <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator color={T.orange} size="large" />
      <Text style={[{ color: T.inkMuted, marginTop: 14, fontFamily: T.font.sans, fontSize: 13 }]}>
        Chargement du client…
      </Text>
    </SafeAreaView>
  );

  if (errorMsg || !client) return (
    <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
      <Ionicons name="alert-circle-outline" size={48} color={T.red} />
      <Text style={[{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16, textAlign: "center", fontFamily: T.font.sans }]}>
        {errorMsg ?? "Client introuvable"}
      </Text>
      <TouchableOpacity
        style={[{ marginTop: 24, backgroundColor: T.orangeLt, paddingHorizontal: 24, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.orangeMd }]}
        onPress={() => router.back()}
      >
        <Text style={[{ color: T.orange, fontWeight: "800", fontFamily: T.font.sans }]}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const fullName    = [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
  const initials    = getInitials(client.firstName, client.lastName);
  const flag        = getFlag(client.country);
  const wallets     = Array.isArray(client.wallets) ? client.wallets : [];
  const kycCfg      = KYC_LABELS[client.kycLevel] ?? KYC_LABELS.LEVEL_0;
  const compCfg     = COMPLIANCE_LABELS[client.complianceStatus] ?? COMPLIANCE_LABELS.CLEAR;
  const txSentCount = transactions.filter(tx => String(tx.senderId) === String(clientId) || String(tx.sender?.id) === String(clientId)).length;
  const txRecvCount = transactions.filter(tx => String(tx.recipientId) === String(clientId)).length;

  // Avatar color
  const COLORS = ["#1956F0", "#16A34A", "#D97706", "#7C3AED", "#0F766E", "#DC2626", "#F97316"];
  const avatarColor = COLORS[(initials.charCodeAt(0) || 0) % COLORS.length];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.pageBg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1}>
          {fullName}
        </Text>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: T.orangeLt, borderColor: T.orangeMd }]}
          onPress={() => setEditModal(true)}
        >
          <Ionicons name="pencil" size={16} color={T.orange} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: `${T.orange}12` }]}
          onPress={() => void loadClient()}
        >
          <Ionicons name="refresh" size={19} color={T.orange} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <View style={s.heroCard}>
          <View style={[s.heroBar, { backgroundColor: client.isSuspended ? T.amber : client.deletedAt ? T.red : T.orange }]} />
          <View style={s.heroInner}>
            <View style={s.heroRow}>
              {/* Avatar */}
              <View style={[s.avatar, { backgroundColor: `${avatarColor}15`, borderColor: `${avatarColor}30` }]}>
                <Text style={[s.avatarTxt, { color: avatarColor, fontFamily: T.font.display }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroName, { fontFamily: T.font.display }]} numberOfLines={1}>{fullName}</Text>
                <View style={s.heroMeta}>
                  <Text style={{ fontSize: 16 }}>{flag}</Text>
                  <Text style={[s.heroCountry, { fontFamily: T.font.sans }]}>
                    {client.city ? `${client.city}, ` : ""}{client.country ?? "—"}
                  </Text>
                </View>
                <View style={s.heroMeta}>
                  {/* Status */}
                  {client.deletedAt ? (
                    <View style={[s.statusPill, { backgroundColor: T.redLt, borderColor: `${T.red}30` }]}>
                      <Ionicons name="trash-outline" size={9} color={T.red} />
                      <Text style={[s.statusTxt, { color: T.red, fontFamily: T.font.sans }]}>SUPPRIMÉ</Text>
                    </View>
                  ) : client.isSuspended ? (
                    <View style={[s.statusPill, { backgroundColor: T.amberLt, borderColor: `${T.amber}30` }]}>
                      <Ionicons name="pause-circle-outline" size={9} color={T.amber} />
                      <Text style={[s.statusTxt, { color: T.amber, fontFamily: T.font.sans }]}>SUSPENDU</Text>
                    </View>
                  ) : (
                    <View style={[s.statusPill, { backgroundColor: T.greenLt, borderColor: `${T.green}30` }]}>
                      <Ionicons name="checkmark-circle-outline" size={9} color={T.green} />
                      <Text style={[s.statusTxt, { color: T.green, fontFamily: T.font.sans }]}>ACTIF</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Stats rapides */}
            <View style={s.heroStats}>
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: T.orange, fontFamily: T.font.display }]}>{wallets.length}</Text>
                <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>WALLETS</Text>
              </View>
              <View style={s.heroStatSep} />
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: T.blue, fontFamily: T.font.display }]}>{txSentCount}</Text>
                <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>ENVOIS</Text>
              </View>
              <View style={s.heroStatSep} />
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: T.green, fontFamily: T.font.display }]}>{txRecvCount}</Text>
                <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>RÉCEPTIONS</Text>
              </View>
              <View style={s.heroStatSep} />
              <View style={s.heroStat}>
                <Text style={[s.heroStatVal, { color: kycCfg.color, fontFamily: T.font.display }]}>
                  {(client.kycLevel ?? "LEVEL_0").replace("LEVEL_", "")}
                </Text>
                <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>KYC</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── INFOS PERSONNELLES ── */}
        <View style={s.card}>
          <SH dot={T.blue} label="Informations personnelles" />
          <InfoRow label="Email"        value={client.email}     icon="mail-outline"         accent={T.blue}   />
          <InfoRow label="Téléphone"    value={client.phone}     icon="call-outline"         accent={T.orange} />
          <InfoRow label="Pays"         value={client.country}   icon="location-outline"     accent={T.violet} />
          <InfoRow label="Ville"        value={client.city}      icon="home-outline"         accent={T.violet} />
          <InfoRow label="Date de naissance" value={client.birthDate} icon="calendar-outline" accent={T.inkSub} />
          <InfoRow label="Nationalité"  value={client.nationality} icon="flag-outline"       accent={T.inkSub} />
          <InfoRow label="Inscrit le"   value={fmtDateShort(client.createdAt)} icon="time-outline" accent={T.teal} />
          <InfoRow label="Mobile Money" value={client.mobileMoneyNumber ? `${client.mobileMoneyOperator ?? ""} · ${client.mobileMoneyNumber}` : null} icon="phone-portrait-outline" accent={T.green} />

          {/* KYC + Compliance en ligne */}
          <View style={s.badgeRow}>
            <View style={[s.infoBadge, { backgroundColor: kycCfg.bg }]}>
              <Ionicons name="id-card-outline" size={11} color={kycCfg.color} />
              <Text style={[s.infoBadgeTxt, { color: kycCfg.color, fontFamily: T.font.sans }]}>{kycCfg.label}</Text>
            </View>
            <View style={[s.infoBadge, { backgroundColor: compCfg.bg }]}>
              <Ionicons name={compCfg.icon as any} size={11} color={compCfg.color} />
              <Text style={[s.infoBadgeTxt, { color: compCfg.color, fontFamily: T.font.sans }]}>{compCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* ── PORTEFEUILLES ── */}
        {wallets.length > 0 && (
          <View style={s.card}>
            <SH dot={T.orange} label={`Portefeuilles · ${wallets.length}`} />
            {wallets.map((w: any) => <WalletRow key={w.id} wallet={w} />)}
          </View>
        )}

        {/* ── TRANSACTIONS ── */}
        <View style={s.card}>
          <SH dot={T.violet} label={`Transactions · ${transactions.length}`} />

          {/* Filtres tx */}
          <View style={s.txFilters}>
            {(["ALL", "SENT", "RECEIVED"] as const).map((f) => {
              const labels = { ALL: "Toutes", SENT: "Envois", RECEIVED: "Réceptions" };
              const colors = { ALL: T.violet, SENT: T.orange, RECEIVED: T.green };
              const counts = { ALL: transactions.length, SENT: txSentCount, RECEIVED: txRecvCount };
              const isA    = txFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[s.txFilterPill, isA && { backgroundColor: `${colors[f]}12`, borderColor: `${colors[f]}30` }]}
                  onPress={() => setTxFilter(f)}
                >
                  <Text style={[s.txFilterTxt, { color: isA ? colors[f] : T.inkSub, fontFamily: T.font.sans }]}>
                    {labels[f]}
                  </Text>
                  <Text style={[s.txFilterCount, { color: isA ? colors[f] : T.inkMuted, fontFamily: T.font.mono }]}>
                    {counts[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filteredTx.length === 0 ? (
            <View style={s.emptyTx}>
              <Ionicons name="swap-horizontal-outline" size={28} color={T.inkMuted} />
              <Text style={[s.emptyTxTxt, { fontFamily: T.font.sans }]}>Aucune transaction</Text>
            </View>
          ) : (
            filteredTx.slice(0, 20).map((tx) => (
              <TxCard key={tx.id} tx={tx} clientId={String(clientId)} onPress={() => {}} />
            ))
          )}

          {filteredTx.length > 20 && (
            <Text style={[s.moreTx, { fontFamily: T.font.sans }]}>
              + {filteredTx.length - 20} autres transactions
            </Text>
          )}
        </View>

        {/* ── ACTIONS ── */}
        {!client.deletedAt && (
          <View style={s.card}>
            <SH dot={T.red} label="Actions admin" />

            {/* Ligne 1 : Modifier + Suspendre/Réactiver */}
            <View style={s.actionsRow}>
              <ActionBox
                icon="pencil-outline"
                label="Modifier"
                color={T.blue}
                bg={T.blueLt}
                onPress={() => setEditModal(true)}
              />
              {client.isSuspended ? (
                <ActionBox
                  icon="play-circle-outline"
                  label="Réactiver"
                  color={T.green}
                  bg={T.greenLt}
                  onPress={handleReactivate}
                  loading={processing}
                />
              ) : (
                <ActionBox
                  icon="pause-circle-outline"
                  label="Suspendre"
                  color={T.amber}
                  bg={T.amberLt}
                  onPress={handleSuspend}
                  loading={processing}
                />
              )}
            </View>

            {/* Ligne 2 : Supprimer (pleine largeur) */}
            <TouchableOpacity
              style={[s.deleteBtn, processing && { opacity: 0.6 }]}
              onPress={handleDelete} disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color={T.red} size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color={T.red} />
                  <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>
                    Supprimer le compte
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[s.deleteWarning, { fontFamily: T.font.sans }]}>
              ⚠️ La suppression est une action irréversible. Les données du client seront marquées comme supprimées (soft delete).
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ── Modal édition ── */}
      <EditModal
        visible={editModal}
        client={client}
        onClose={() => setEditModal(false)}
        onSaved={(updated) => {
          setClient((prev: any) => ({ ...prev, ...updated }));
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 8,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, color: T.ink, fontSize: 18, fontWeight: "700" },
  editBtn:     { width: 38, height: 38, borderRadius: 11, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  iconBtn:     { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },

  scroll: { padding: 14 },

  heroCard:   { backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 14, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.card },
  heroBar:    { height: 4 },
  heroInner:  { padding: 16 },
  heroRow:    { flexDirection: "row", gap: 14, marginBottom: 16 },
  avatar:     { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  avatarTxt:  { fontSize: 20, fontWeight: "800" },
  heroName:   { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 4 },
  heroMeta:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  heroCountry:{ fontSize: 11, color: T.inkSub, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  statusTxt:  { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  heroStats:  { flexDirection: "row", backgroundColor: T.pageBg, borderRadius: T.radius.md, padding: 12, alignItems: "center" },
  heroStat:   { flex: 1, alignItems: "center" },
  heroStatVal:{ fontSize: 18, fontWeight: "700" },
  heroStatLbl:{ fontSize: 8, color: T.inkMuted, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  heroStatSep:{ width: 1, height: 28, backgroundColor: T.border },

  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: T.border, ...T.shadow.soft },

  badgeRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  infoBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  infoBadgeTxt:{ fontSize: 10, fontWeight: "700" },

  txFilters:     { flexDirection: "row", gap: 8, marginBottom: 14 },
  txFilterPill:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border },
  txFilterTxt:   { fontSize: 11, fontWeight: "700" },
  txFilterCount: { fontSize: 10, fontWeight: "900" },

  emptyTx:    { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyTxTxt: { color: T.inkMuted, fontSize: 13, fontWeight: "600" },
  moreTx:     { textAlign: "center", color: T.inkMuted, fontSize: 12, fontWeight: "600", marginTop: 8 },

  actionsRow:  { flexDirection: "row", gap: 10, marginBottom: 10 },
  deleteBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: T.redLt, borderRadius: T.radius.md, borderWidth: 1, borderColor: `${T.red}25`, marginBottom: 12 },
  deleteTxt:   { color: T.red, fontWeight: "800", fontSize: 14 },
  deleteWarning:{ fontSize: 10, color: T.inkMuted, lineHeight: 15, textAlign: "center" },
});