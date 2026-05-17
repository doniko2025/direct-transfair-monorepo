// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/index.tsx
// =========================================================
// AGENCIES LIST v6.0 — Direct Transf'air
// ✅ SuperAdmin : 2 sections bien distinctes
//    1. SOCIÉTÉS SAAS   → api.getClients()   (bleu/violet)
//    2. AGENCES RÉSEAU  → api.getAgencies()  (teal/vert)
// ✅ CompanyAdmin : agences uniquement
// ✅ Bouton + : crée société (SuperAdmin) ou agence (CompanyAdmin)
// ✅ Thème 100% CLAIR
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, RefreshControl,
  TextInput, Modal, Alert, Platform, Animated, StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";
import CreateCompanyModal from "../../../../components/dashboards/CreateCompanyModal";

// ─── Design Tokens ────────────────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",

  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",

  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",

  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",

  white: "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
    hero: { shadowColor: "#000",    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 14 },
  },
};

const ROLE_HERO: Record<string, { g1: string; g2: string; accent: string }> = {
  SUPER_ADMIN:   { g1: "#5B5BD6", g2: "#3232A8", accent: "#1956F0" },
  COMPANY_ADMIN: { g1: "#991B1B", g2: "#7F1D1D", accent: "#DC2626" },
  AGENT:         { g1: "#B45309", g2: "#92400E", accent: "#D97706" },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: T.green, INACTIVE: T.red, SUSPENDED: T.amber, EXPIRED: T.red, TRIAL: T.purple,
};

const FLAG_MAP: Record<string, string> = {
  GN: "🇬🇳", SN: "🇸🇳", ML: "🇲🇱", CI: "🇨🇮", FR: "🇫🇷",
  GB: "🇬🇧", US: "🇺🇸", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬",
};

const HERO_BR = 28;

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

// ─── Section Header ───────────────────────────────────────
function SectionBlock({
  icon, title, desc, color, colorLt, colorMd, count,
}: {
  icon: string; title: string; desc: string;
  color: string; colorLt: string; colorMd: string; count: number;
}) {
  return (
    <View style={[sbS.wrap, { borderColor: colorMd, borderLeftColor: color }]}>
      <View style={[sbS.iconBox, { backgroundColor: colorLt, borderColor: colorMd }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sbS.title, { color, fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[sbS.desc, { fontFamily: T.font.subtitle }]}>{desc}</Text>
      </View>
      <View style={[sbS.countBox, { backgroundColor: colorLt, borderColor: colorMd }]}>
        <Text style={[sbS.countTxt, { color, fontFamily: T.font.mono }]}>{count}</Text>
      </View>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap:     { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 12, marginBottom: 12, borderWidth: 1, borderLeftWidth: 4, ...T.shadow.soft },
  iconBox:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  title:    { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  desc:     { fontSize: 10, color: T.inkMuted, marginTop: 2 },
  countBox: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  countTxt: { fontSize: 13, fontWeight: "900" },
});

// ─── Séparateur entre sections ────────────────────────────
function Divider() {
  return (
    <View style={dvS.wrap}>
      <View style={dvS.line} />
      <View style={dvS.pill}>
        <Ionicons name="git-branch-outline" size={11} color={T.inkMuted} />
        <Text style={[dvS.txt, { fontFamily: T.font.sans }]}>AGENCES DU RÉSEAU</Text>
      </View>
      <View style={dvS.line} />
    </View>
  );
}
const dvS = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginVertical: 22, gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: T.border },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.borderLt, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: T.border },
  txt:  { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1 },
});

// ─── SOCIÉTÉ Card — bleu, badge SOCIÉTÉ ───────────────────
function SocieteCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale       = useRef(new Animated.Value(1)).current;
  const statusColor = STATUS_COLORS[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  const agencyCount = toNum(item._count?.agencies ?? item.agencies?.length ?? 0);
  const userCount   = toNum(item._count?.users    ?? item.users?.length    ?? 0);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={scS.card}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={scS.sideBar} />
        <View style={scS.body}>
          <View style={scS.topRow}>
            <View style={scS.avatar}>
              <Text style={[scS.avatarLetter, { fontFamily: T.font.display }]}>
                {(item.name?.[0] ?? "S").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={scS.nameRow}>
                <Text style={[scS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
                <View style={scS.typeBadge}>
                  <Ionicons name="briefcase-outline" size={8} color={T.blue} />
                  <Text style={[scS.typeTxt, { fontFamily: T.font.sans }]}>SOCIÉTÉ</Text>
                </View>
              </View>
              <View style={scS.metaRow}>
                <Text style={[scS.code, { fontFamily: T.font.mono }]}>{item.code}</Text>
                <View style={[scS.statusPill, { backgroundColor: statusColor + "14", borderColor: statusColor + "30" }]}>
                  <View style={[scS.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[scS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
                    {item.subscriptionStatus}
                  </Text>
                </View>
              </View>
            </View>
            <View style={scS.chevron}>
              <Ionicons name="chevron-forward" size={13} color={T.blue} />
            </View>
          </View>
          <View style={scS.counters}>
            <View style={[scS.cPill, { backgroundColor: T.blueLt, borderColor: T.blueMd }]}>
              <Ionicons name="business-outline" size={9} color={T.blue} />
              <Text style={[scS.cTxt, { color: T.blue, fontFamily: T.font.mono }]}>{agencyCount} agence{agencyCount > 1 ? "s" : ""}</Text>
            </View>
            <View style={[scS.cPill, { backgroundColor: T.purpleLt, borderColor: T.purple + "30" }]}>
              <Ionicons name="people-outline" size={9} color={T.purple} />
              <Text style={[scS.cTxt, { color: T.purple, fontFamily: T.font.mono }]}>{userCount} utilisateur{userCount > 1 ? "s" : ""}</Text>
            </View>
            <View style={[scS.cPill, { backgroundColor: T.amberLt, borderColor: T.amber + "30" }]}>
              <Ionicons name="repeat-outline" size={9} color={T.amber} />
              <Text style={[scS.cTxt, { color: T.amber, fontFamily: T.font.mono }]}>
                {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const scS = StyleSheet.create({
  card:         { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.blueMd, overflow: "hidden", ...T.shadow.card },
  sideBar:      { width: 5, backgroundColor: T.blue },
  body:         { flex: 1, padding: 13 },
  topRow:       { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 },
  avatar:       { width: 42, height: 42, borderRadius: 12, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd, justifyContent: "center", alignItems: "center" },
  avatarLetter: { fontSize: 18, fontWeight: "700", color: T.blue },
  nameRow:      { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  name:         { fontSize: 14, fontWeight: "700", color: T.ink, flexShrink: 1 },
  typeBadge:    { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: T.blueLt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: T.blueMd },
  typeTxt:      { fontSize: 8, fontWeight: "900", color: T.blue, letterSpacing: 0.5 },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 7 },
  code:         { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.8 },
  statusPill:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusDot:    { width: 4, height: 4, borderRadius: 99 },
  statusTxt:    { fontSize: 9, fontWeight: "800" },
  chevron:      { width: 28, height: 28, borderRadius: 8, backgroundColor: T.blueLt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.blueMd },
  counters:     { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  cPill:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  cTxt:         { fontSize: 9, fontWeight: "800" },
});

// ─── AGENCE Card — teal, badge AGENCE ─────────────────────
function AgenceCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const isActive = item.isActive !== false && item.status !== "INACTIVE";
  const currency = item.primaryCurrency ?? item.currency ?? "XOF";
  const balance  = toNum(item.balance ?? 0);
  const flag     = item.country ? (FLAG_MAP[item.country.toUpperCase().substring(0, 2)] ?? "🌍") : "🌍";

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={agcS.card}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[agcS.sideBar, { backgroundColor: isActive ? T.teal : T.red }]} />
        <View style={agcS.body}>
          <View style={agcS.topRow}>
            <View style={agcS.flagBox}>
              <Text style={{ fontSize: 20 }}>{flag}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={agcS.nameRow}>
                <Text style={[agcS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
                <View style={[agcS.typeBadge, {
                  backgroundColor: item.type === "PARTNER" ? T.amberLt : T.tealLt,
                  borderColor:     item.type === "PARTNER" ? T.amber + "30" : T.tealMd,
                }]}>
                  <Ionicons name="storefront-outline" size={8} color={item.type === "PARTNER" ? T.amber : T.teal} />
                  <Text style={[agcS.typeTxt, { color: item.type === "PARTNER" ? T.amber : T.teal, fontFamily: T.font.sans }]}>
                    {item.type === "PARTNER" ? "PARTENAIRE" : "FILIALE"}
                  </Text>
                </View>
              </View>
              <Text style={[agcS.city, { fontFamily: T.font.subtitle }]}>
                {item.city ?? "—"}{item.country ? `  ·  ${item.country}` : ""}
              </Text>
            </View>
            <View style={agcS.right}>
              <Text style={[agcS.balance, { color: T.teal, fontFamily: T.font.mono }]}>
                {fmt(balance, currency)}
              </Text>
              <Text style={[agcS.currency, { fontFamily: T.font.sans }]}>
                {currency === "XOF" ? "CFA" : currency}
              </Text>
            </View>
          </View>
          <View style={agcS.footRow}>
            <View style={[agcS.statusPill, { backgroundColor: isActive ? T.tealLt : T.redLt, borderColor: isActive ? T.tealMd : T.red + "35" }]}>
              <View style={[agcS.dot, { backgroundColor: isActive ? T.teal : T.red }]} />
              <Text style={[agcS.statusTxt, { color: isActive ? T.teal : T.red, fontFamily: T.font.sans }]}>
                {isActive ? "Opérationnelle" : "Suspendue"}
              </Text>
            </View>
            {item.managerName && (
              <View style={agcS.managerRow}>
                <Ionicons name="person-outline" size={10} color={T.inkMuted} />
                <Text style={[agcS.managerTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.managerName}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const agcS = StyleSheet.create({
  card:      { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.tealMd, overflow: "hidden", ...T.shadow.soft },
  sideBar:   { width: 5 },
  body:      { flex: 1, padding: 13 },
  topRow:    { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 },
  flagBox:   { width: 42, height: 42, borderRadius: 12, backgroundColor: T.tealLt, borderWidth: 1.5, borderColor: T.tealMd, justifyContent: "center", alignItems: "center" },
  nameRow:   { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 3 },
  name:      { fontSize: 14, fontWeight: "700", color: T.ink, flexShrink: 1 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  typeTxt:   { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  city:      { fontSize: 10, color: T.inkSub },
  right:     { alignItems: "flex-end" },
  balance:   { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  currency:  { fontSize: 8, color: T.teal, fontWeight: "700" },
  footRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  dot:       { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "800" },
  managerRow:{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "45%" },
  managerTxt:{ fontSize: 9, color: T.inkMuted, fontWeight: "600" },
});

// ─── Action Sheet ─────────────────────────────────────────
function AgenceActionSheet({ agency, visible, onClose, onViewDetails, onEdit, onDelete }: {
  agency: any; visible: boolean;
  onClose: () => void; onViewDetails: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [deleteFlow, setDeleteFlow] = useState(false);
  const [phone,      setPhone]      = useState("");
  const [deleting,   setDeleting]   = useState(false);
  const reset = () => { setDeleteFlow(false); setPhone(""); };

  const confirmDelete = async () => {
    if (!phone.trim() || phone.length < 6) { Alert.alert("Sécurité", "Numéro invalide."); return; }
    setDeleting(true);
    try {
      await api.deleteAgency(agency!.id.toString());
      Alert.alert("Supprimé", `${agency!.name} supprimée.`);
      onClose(); reset(); onDelete();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message ?? "Suppression impossible.");
    } finally { setDeleting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { onClose(); reset(); }}>
      <View style={asS.overlay}>
        <View style={asS.sheet}>
          <View style={asS.handle} />
          <Text style={[asS.title, { fontFamily: T.font.display }]} numberOfLines={1}>{agency?.name}</Text>
          <Text style={[asS.sub, { fontFamily: T.font.sans }]}>{agency?.city}</Text>
          {!deleteFlow ? (
            <View style={asS.actions}>
              {[
                { icon: "eye-outline",    label: "Voir les détails",   color: T.blue,   bg: T.blueLt,  onPress: onViewDetails },
                { icon: "pencil-outline", label: "Modifier",           color: T.inkSub, bg: T.borderLt, onPress: onEdit },
                { icon: "trash-outline",  label: "Supprimer l'agence", color: T.red,    bg: T.redLt,   onPress: () => setDeleteFlow(true) },
              ].map((a) => (
                <TouchableOpacity key={a.label} style={asS.actionRow} onPress={a.onPress} activeOpacity={0.8}>
                  <View style={[asS.actionIcon, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon as any} size={17} color={a.color} />
                  </View>
                  <Text style={[asS.actionLabel, { color: a.color, fontFamily: T.font.sans }]}>{a.label}</Text>
                  <Ionicons name="chevron-forward" size={13} color={T.inkMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <View style={asS.warningBox}>
                <Ionicons name="warning-outline" size={20} color={T.red} />
                <Text style={[asS.warningTxt, { fontFamily: T.font.sans }]}>Action irréversible. Confirmez avec votre numéro.</Text>
              </View>
              <Text style={[asS.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO ADMINISTRATEUR</Text>
              <TextInput style={[asS.input, { fontFamily: T.font.sans }]} value={phone} onChangeText={setPhone} placeholder="Ex: 620 000 000" placeholderTextColor={T.inkMuted} keyboardType="phone-pad" editable={!deleting} />
              <TouchableOpacity style={[asS.deleteBtn, deleting && { opacity: 0.7 }]} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={T.white} /> : <Text style={[asS.deleteBtnTxt, { fontFamily: T.font.sans }]}>Confirmer la suppression</Text>}
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={asS.cancelBtn} onPress={() => { onClose(); reset(); }}>
            <Text style={[asS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const asS = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 28, borderWidth: 1, borderColor: T.border },
  handle:     { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 20 },
  title:      { fontSize: 20, fontWeight: "700", color: T.ink, textAlign: "center", marginBottom: 4 },
  sub:        { fontSize: 12, color: T.inkSub, textAlign: "center", marginBottom: 20 },
  actions:    { gap: 10 },
  actionRow:  { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.pageBg, borderRadius: T.radius.md, padding: 13, borderWidth: 1, borderColor: T.border },
  actionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionLabel:{ flex: 1, fontSize: 13, fontWeight: "700" },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: T.redLt, borderRadius: T.radius.md, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: T.red + "25" },
  warningTxt: { flex: 1, color: T.red, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  inputLabel: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6 },
  input:      { backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: T.ink, fontWeight: "600", marginBottom: 14 },
  deleteBtn:  { backgroundColor: T.red, borderRadius: T.radius.md, paddingVertical: 16, alignItems: "center" },
  deleteBtnTxt: { color: T.white, fontWeight: "900", fontSize: 14 },
  cancelBtn:  { marginTop: 18, paddingVertical: 14, alignItems: "center" },
  cancelTxt:  { color: T.inkSub, fontWeight: "800", fontSize: 14 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgenciesListScreen() {
  const router       = useRouter();
  const { user }     = useAuth();
  const role         = user?.role ?? "COMPANY_ADMIN";
  const hero         = ROLE_HERO[role] ?? ROLE_HERO.COMPANY_ADMIN;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [societes,   setSocietes]   = useState<any[]>([]);
  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q,          setQ]          = useState("");
  const [selected,   setSelected]   = useState<any>(null);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      // ── Étape 1 : agences directes + sociétés en parallèle ──
      const [rawAgenciesDirect, rawClients] = await Promise.all([
        api.getAgencies().catch(() => []),
        isSuperAdmin ? api.getClients().catch(() => []) : Promise.resolve([]),
      ]);

      const clList = Array.isArray(rawClients)
        ? rawClients
        : ((rawClients as any)?.data ?? []);

      // ── Étape 2 : SuperAdmin — fallback via getClient() individuel ──
      // Le backend actuel filtre /agencies par clientId même pour le SuperAdmin.
      // On charge donc chaque société en détail pour récupérer ses agences.
      let agList: any[] = Array.isArray(rawAgenciesDirect) ? rawAgenciesDirect : [];

      if (isSuperAdmin && agList.length === 0 && clList.length > 0) {
        const detailed = await Promise.all(
          clList.map((c: any) =>
            api.getClient(Number(c.id)).catch(() => null)
          )
        );
        for (const detail of detailed) {
          if (!detail) continue;
          const embedded = Array.isArray((detail as any).agencies)
            ? (detail as any).agencies
            : [];
          agList.push(
            ...embedded.map((a: any) => ({
              ...a,
              clientName: (detail as any).name,
              clientCode: (detail as any).code,
            }))
          );
        }
      }

      // ── Étape 3 : normalisation ──
      setAgencies(agList.map((a: any) => ({
        ...a,
        type:     a.type ?? (a.subscriptionType === "PURCHASE" ? "PARTNER" : "SUBSIDIARY"),
        balance:  a.balance ?? 0,
        status:   a.isActive === false ? "INACTIVE" : (a.status ?? "ACTIVE"),
        currency: a.primaryCurrency ?? a.currency ?? "XOF",
      })));

      if (isSuperAdmin) {
        setSocietes(clList);
      }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error("Load error", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isSuperAdmin]);

  useFocusEffect(useCallback(() => { void loadData("init"); return () => {}; }, [loadData]));

  const filteredSocietes = societes.filter((s) =>
    !q.trim() || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase())
  );
  const filteredAgencies = agencies.filter((a) =>
    !q.trim() || `${a.name} ${a.city ?? ""} ${a.country ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  const sbH = Platform.OS === "android" ? 44 : 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={hero.g2} />

      {/* ── Hero ── */}
      <Animated.View style={[s.heroOuter, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
        <LinearGradient colors={[hero.g1, hero.g2]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={[s.heroGrad, { paddingTop: sbH + 12 }]}>
          <View style={s.deco1} />
          <View style={s.deco2} />
          <View style={s.heroRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color={T.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { fontFamily: T.font.display }]}>
                {isSuperAdmin ? "Sociétés & Agences" : "Réseau d'Agences"}
              </Text>
              <Text style={[s.heroSub, { fontFamily: T.font.subtitle }]}>
                {isSuperAdmin
                  ? `${societes.length} société${societes.length > 1 ? "s" : ""}  ·  ${agencies.length} agence${agencies.length > 1 ? "s" : ""}`
                  : `${agencies.length} agence${agencies.length > 1 ? "s" : ""}`
                }
              </Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => isSuperAdmin ? setCreateCompanyOpen(true) : router.push("/(tabs)/admin/agencies/create")}>
              <Ionicons name="add" size={20} color={hero.g2} />
            </TouchableOpacity>
          </View>
          <View style={s.searchBox}>
            <Ionicons name="search" size={15} color="rgba(255,255,255,0.6)" />
            <TextInput style={[s.searchInput, { fontFamily: T.font.sans }]} value={q} onChangeText={setQ} placeholder="Rechercher..." placeholderTextColor="rgba(255,255,255,0.45)" underlineColorAndroid="transparent" />
            {!!q && <TouchableOpacity onPress={() => setQ("")} hitSlop={8}><Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.6)" /></TouchableOpacity>}
          </View>
        </LinearGradient>
        <View style={s.cornerL} />
        <View style={s.cornerR} />
      </Animated.View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={hero.accent} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} tintColor={hero.accent} />}
        >
          {/* ══════════════════════════════════
              SECTION 1 — SOCIÉTÉS SAAS (bleu)
          ══════════════════════════════════ */}
          {isSuperAdmin && (
            <>
              <SectionBlock
                icon="briefcase-outline"
                title="Sociétés SaaS"
                desc="Clients abonnés — chaque société gère ses propres agences"
                color={T.blue}
                colorLt={T.blueLt}
                colorMd={T.blueMd}
                count={filteredSocietes.length}
              />

              {filteredSocietes.length === 0 ? (
                <View style={[s.emptyInline, { borderColor: T.blueMd }]}>
                  <Ionicons name="briefcase-outline" size={18} color={T.blueMd} />
                  <Text style={[s.emptyInlineTxt, { color: T.blue, fontFamily: T.font.sans }]}>
                    Aucune société trouvée
                  </Text>
                </View>
              ) : (
                filteredSocietes.map((item) => (
                  <SocieteCard
                    key={item.id?.toString()}
                    item={item}
                    onPress={() => router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })}
                  />
                ))
              )}

              <Divider />
            </>
          )}

          {/* ══════════════════════════════════
              SECTION 2 — AGENCES RÉSEAU (teal)
          ══════════════════════════════════ */}
          <SectionBlock
            icon="storefront-outline"
            title="Agences du Réseau"
            desc="Points de service — filiales et partenaires opérationnels"
            color={T.teal}
            colorLt={T.tealLt}
            colorMd={T.tealMd}
            count={filteredAgencies.length}
          />

          {filteredAgencies.length === 0 ? (
            <View style={[s.emptyInline, { borderColor: T.tealMd }]}>
              <Ionicons name="storefront-outline" size={18} color={T.tealMd} />
              <Text style={[s.emptyInlineTxt, { color: T.teal, fontFamily: T.font.sans }]}>
                {q ? "Aucune agence trouvée" : "Aucune agence pour l'instant"}
              </Text>
            </View>
          ) : (
            filteredAgencies.map((item) => (
              <AgenceCard
                key={item.id?.toString()}
                item={item}
                onPress={() => { setSelected(item); setMenuOpen(true); }}
              />
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <AgenceActionSheet
        agency={selected} visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onViewDetails={() => { setMenuOpen(false); router.push({ pathname: "/(tabs)/admin/agencies/details", params: { id: selected!.id.toString() } }); }}
        onEdit={() => { setMenuOpen(false); router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: selected!.id.toString() } }); }}
        onDelete={() => void loadData("refresh")}
      />

      <CreateCompanyModal
        visible={createCompanyOpen}
        onClose={() => setCreateCompanyOpen(false)}
        onSuccess={() => void loadData("refresh")}
        isSuperAdmin={isSuperAdmin}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroOuter: { zIndex: 10, ...T.shadow.hero },
  heroGrad:  { borderBottomLeftRadius: HERO_BR, borderBottomRightRadius: HERO_BR, overflow: "hidden", paddingBottom: 20 },
  deco1:     { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -45, right: -30 },
  deco2:     { position: "absolute", width: 70,  height: 70,  borderRadius: 35, backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10 },
  heroRow:   { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  backBtn:   { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center", marginBottom: 2 },
  heroTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  heroSub:   { color: "rgba(255,255,255,0.60)", fontSize: 10, marginTop: 2 },
  addBtn:    { width: 36, height: 36, borderRadius: 11, backgroundColor: T.white, justifyContent: "center", alignItems: "center", marginBottom: 2, ...T.shadow.soft },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: T.radius.md, marginHorizontal: 20, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 13, color: T.white, fontWeight: "600" },
  cornerL:   { position: "absolute", bottom: 0, left: 0,  width: HERO_BR, height: HERO_BR, backgroundColor: T.pageBg, borderTopRightRadius: HERO_BR },
  cornerR:   { position: "absolute", bottom: 0, right: 0, width: HERO_BR, height: HERO_BR, backgroundColor: T.pageBg, borderTopLeftRadius:  HERO_BR },
  scroll:    { paddingHorizontal: 18, paddingTop: 18 },
  emptyInline: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 16, marginBottom: 12, borderWidth: 1, borderStyle: "dashed" },
  emptyInlineTxt: { fontSize: 12, fontWeight: "600" },
});