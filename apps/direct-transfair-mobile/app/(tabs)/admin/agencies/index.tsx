// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/index.tsx
// =========================================================
// AGENCIES LIST v6.3 — Direct Transf'air
// ✅ FIX : "Recharger" masqué pour SUPER_ADMIN
//    → prop isSuperAdmin={isSA} passée à AgenceActionSheet
//    → actions.filter((a) => a.show) — show: !isSuperAdmin pour Recharger
// ✅ FIX : DONIKO filtré de la liste des sociétés SA
// ✅ Tout le reste identique à v6.2
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
import RefillAgencyModal from "../../../../components/agencies/RefillAgencyModal";

const T = {
  pageBg:   "#F2F4F8", surface:  "#FFFFFF", border:   "#E4E9F0", borderLt: "#F1F5F9",
  ink:      "#0F172A", inkMid:   "#1E293B", inkSub:   "#6B7280", inkMuted: "#94A3B8",
  blue:     "#1956F0", blueDark: "#1240D6", blueLt:   "#EEF2FF", blueMd:   "#C7D5FF",
  purple:   "#7C3AED", purpleLt: "#EDE9FE",
  sky:      "#0284C7", skyMid:   "#0369A1", skyLt:    "#E0F2FE", skyMd:    "#7DD3FC",
  teal:     "#0F766E", tealLt:   "#CCFBF1", tealMd:   "#5EEAD4",
  green:    "#16A34A", greenLt:  "#DCFCE7",
  red:      "#DC2626", redLt:    "#FEE2E2",
  amber:    "#D97706", amberLt:  "#FEF3C7",
  white: "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "Trebuchet MS" }),
  },
  shadow: {
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
    hero: { shadowColor: "#000",    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 14 },
  },
};

const ROLE_HERO: Record<string, { g1: string; g2: string }> = {
  SUPER_ADMIN:   { g1: "#5B5BD6", g2: "#3232A8" },
  COMPANY_ADMIN: { g1: "#38BDF8", g2: "#0284C7" },
  AGENT:         { g1: "#38BDF8", g2: "#0284C7" },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: T.green, INACTIVE: T.red, SUSPENDED: T.amber, EXPIRED: T.red, TRIAL: T.purple,
};

const FLAG_MAP: Record<string, string> = {
  GN: "🇬🇳", SN: "🇸🇳", ML: "🇲🇱", CI: "🇨🇮", FR: "🇫🇷",
  GB: "🇬🇧", US: "🇺🇸", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬",
};

const PLATFORM_CODE = "DONIKO";

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

function SectionBlock({ icon, title, desc, color, colorLt, colorMd, count }: any) {
  return (
    <View style={[sbS.wrap, { borderColor: colorMd, borderLeftColor: color }]}>
      <View style={[sbS.iconBox, { backgroundColor: colorLt, borderColor: colorMd }]}>
        <Ionicons name={icon} size={15} color={color} />
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

function SocieteCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const statusColor = STATUS_COLORS[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  const agencyCount = toNum(item._count?.agencies ?? item.agencies?.length ?? 0);
  const userCount   = toNum(item._count?.users    ?? item.users?.length    ?? 0);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={scS.card} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={scS.sideBar} />
        <View style={scS.body}>
          <View style={scS.topRow}>
            <View style={scS.avatar}>
              <Text style={[scS.avatarLetter, { fontFamily: T.font.display }]}>{(item.name?.[0] ?? "S").toUpperCase()}</Text>
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
                  <Text style={[scS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>{item.subscriptionStatus}</Text>
                </View>
              </View>
            </View>
            <View style={scS.chevron}><Ionicons name="chevron-forward" size={13} color={T.blue} /></View>
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
              <Text style={[scS.cTxt, { color: T.amber, fontFamily: T.font.mono }]}>{item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}</Text>
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

function AgenceCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const isActive = item.isActive !== false && item.status !== "INACTIVE";
  const primaryWallet = Array.isArray(item.wallets)
  ? (item.wallets.find((w: any) => w.isDefault) ?? item.wallets[0])
  : null;
  const balance  = toNum(primaryWallet?.balance ?? item.balance ?? 0);
  const currency = primaryWallet?.currency ?? item.primaryCurrency ?? item.currency ?? "XOF";
  const flag     = item.country ? (FLAG_MAP[item.country.toUpperCase().substring(0, 2)] ?? "🌍") : "🌍";
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={agcS.card} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[agcS.sideBar, { backgroundColor: isActive ? T.teal : T.red }]} />
        <View style={agcS.body}>
          <View style={agcS.topRow}>
            <View style={agcS.flagBox}><Text style={{ fontSize: 20 }}>{flag}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={agcS.nameRow}>
                <Text style={[agcS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
                <View style={[agcS.typeBadge, { backgroundColor: item.type === "PARTNER" ? T.amberLt : T.tealLt, borderColor: item.type === "PARTNER" ? T.amber + "30" : T.tealMd }]}>
                  <Ionicons name="storefront-outline" size={8} color={item.type === "PARTNER" ? T.amber : T.teal} />
                  <Text style={[agcS.typeTxt, { color: item.type === "PARTNER" ? T.amber : T.teal, fontFamily: T.font.sans }]}>
                    {item.type === "PARTNER" ? "PARTENAIRE" : "FILIALE"}
                  </Text>
                </View>
              </View>
              <Text style={[agcS.city, { fontFamily: T.font.subtitle }]}>{item.city ?? "—"}{item.country ? `  ·  ${item.country}` : ""}</Text>
            </View>
            <View style={agcS.right}>
              <Text style={[agcS.balance, { color: T.teal, fontFamily: T.font.mono }]}>{fmt(balance, currency)}</Text>
              <Text style={[agcS.currency, { fontFamily: T.font.sans }]}>{currency === "XOF" ? "CFA" : currency}</Text>
            </View>
          </View>
          <View style={agcS.footRow}>
            <View style={[agcS.statusPill, { backgroundColor: isActive ? T.tealLt : T.redLt, borderColor: isActive ? T.tealMd : T.red + "35" }]}>
              <View style={[agcS.dot, { backgroundColor: isActive ? T.teal : T.red }]} />
              <Text style={[agcS.statusTxt, { color: isActive ? T.teal : T.red, fontFamily: T.font.sans }]}>{isActive ? "Opérationnelle" : "Suspendue"}</Text>
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
// ✅ FIX v6.3 : "Recharger" masqué pour SUPER_ADMIN via prop isSuperAdmin
function AgenceActionSheet({ agency, visible, isSuperAdmin, onClose, onViewDetails, onEdit, onRefill, onDelete }: {
  agency: any; visible: boolean; isSuperAdmin: boolean;
  onClose: () => void; onViewDetails: () => void;
  onEdit: () => void; onRefill: () => void; onDelete: () => void;
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

  // ✅ show: !isSuperAdmin sur "Recharger" — le SA n'a pas de wallet société à débiter
  const actions = [
    { icon: "eye-outline",             label: "Voir les détails",   color: T.blue,   bg: T.blueLt,   onPress: onViewDetails,              show: true             },
    { icon: "arrow-up-circle-outline", label: "Recharger",          color: T.teal,   bg: T.tealLt,   onPress: onRefill,                   show: !isSuperAdmin    },
    { icon: "pencil-outline",          label: "Modifier",           color: T.inkSub, bg: T.borderLt, onPress: onEdit,                     show: true             },
    { icon: "trash-outline",           label: "Supprimer l'agence", color: T.red,    bg: T.redLt,    onPress: () => setDeleteFlow(true),  show: true             },
  ].filter((a) => a.show);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { onClose(); reset(); }}>
      <View style={asS.overlay}>
        <View style={asS.sheet}>
          <View style={asS.handle} />
          <Text style={[asS.title, { fontFamily: T.font.display }]} numberOfLines={1}>{agency?.name}</Text>
          <Text style={[asS.sub, { fontFamily: T.font.sans }]}>{agency?.city}</Text>
          {!deleteFlow ? (
            <View style={asS.actions}>
              {actions.map((a) => (
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
            <View style={asS.actions}>
              <View style={asS.warningBox}>
                <Ionicons name="warning-outline" size={20} color={T.red} />
                <Text style={[asS.warningTxt, { fontFamily: T.font.sans }]}>Action irréversible. Confirmez avec votre numéro.</Text>
              </View>
              <Text style={[asS.inputLabel, { fontFamily: T.font.sans }]}>NUMÉRO ADMINISTRATEUR</Text>
              <TextInput style={[asS.input, { fontFamily: T.font.sans }]} value={phone} onChangeText={setPhone} placeholder="Ex: 620 000 000" placeholderTextColor={T.inkMuted} keyboardType="phone-pad" editable={!deleting} />
              <TouchableOpacity style={[asS.deleteConfirmBtn, deleting && { opacity: 0.6 }]} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={T.white} size="small" /> : <Text style={[asS.deleteConfirmTxt, { fontFamily: T.font.sans }]}>CONFIRMER LA SUPPRESSION</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={asS.cancelRow} onPress={() => reset()}>
                <Text style={[asS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={asS.dismissRow} onPress={() => { onClose(); reset(); }}>
            <Text style={[asS.dismissTxt, { fontFamily: T.font.sans }]}>Fermer</Text>
          </TouchableOpacity>
          <View style={{ height: Platform.OS === "ios" ? 24 : 12 }} />
        </View>
      </View>
    </Modal>
  );
}
const asS = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:            { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: T.border },
  handle:           { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14 },
  title:            { fontSize: 18, fontWeight: "800", color: T.ink, textAlign: "center", marginTop: 16, paddingHorizontal: 20 },
  sub:              { fontSize: 12, color: T.inkSub, fontWeight: "600", textAlign: "center", marginTop: 4, marginBottom: 8 },
  actions:          { paddingHorizontal: 16, paddingTop: 8 },
  actionRow:        { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  actionIcon:       { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  actionLabel:      { flex: 1, fontSize: 15, fontWeight: "700" },
  warningBox:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.redLt, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: T.red + "30", marginBottom: 16 },
  warningTxt:       { flex: 1, fontSize: 13, color: T.red, fontWeight: "600" },
  inputLabel:       { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6 },
  input:            { backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: T.ink, marginBottom: 14 },
  deleteConfirmBtn: { backgroundColor: T.red, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  deleteConfirmTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  cancelRow:        { alignItems: "center", paddingVertical: 10 },
  cancelTxt:        { fontSize: 14, fontWeight: "700", color: T.inkSub },
  dismissRow:       { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  dismissTxt:       { fontSize: 15, fontWeight: "700", color: T.inkMuted },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgenciesScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const role      = user?.role ?? "COMPANY_ADMIN";
  const heroTheme = ROLE_HERO[role] ?? ROLE_HERO.COMPANY_ADMIN;
  const isSA      = role === "SUPER_ADMIN";

  const [clients,     setClients]     = useState<any[]>([]);
  const [agencies,    setAgencies]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [q,           setQ]           = useState("");
  const [sheetAgency,  setSheetAgency]  = useState<any>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refillAgency,  setRefillAgency]  = useState<any>(null);
  const [refillVisible, setRefillVisible] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const agencyList = await api.getAgencies();
      setAgencies(Array.isArray(agencyList) ? agencyList : []);
      if (isSA) {
        const clientList = await (api as any).getClients?.() ?? [];
        // ✅ Exclure DONIKO — c'est la plateforme, pas une société cliente
        setClients(Array.isArray(clientList) ? clientList.filter((c: any) => c.code !== PLATFORM_CODE) : []);
      }
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isSA, fadeAnim]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh  = () => { setRefreshing(true); fetchData(); };
  const openSheet  = (agency: any) => { setSheetAgency(agency); setSheetVisible(true); };
  const closeSheet = () => { setSheetVisible(false); setTimeout(() => setSheetAgency(null), 300); };
  const openRefill = (agency: any) => { closeSheet(); setTimeout(() => { setRefillAgency(agency); setRefillVisible(true); }, 350); };

  const filteredAgencies = agencies.filter((a) => !q.trim() || `${a.name} ${a.city} ${a.country}`.toLowerCase().includes(q.toLowerCase()));
  const filteredClients  = clients.filter((c)  => !q.trim() || `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <LinearGradient colors={[heroTheme.g1, heroTheme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: T.font.display }]}>{isSA ? "Réseau & Sociétés" : "Réseau d'Agences"}</Text>
            <Text style={[s.heroSub, { fontFamily: T.font.sans }]}>
              {isSA
                ? `${clients.length} société${clients.length > 1 ? "s" : ""} · ${agencies.length} agence${agencies.length > 1 ? "s" : ""}`
                : `${agencies.length} agence${agencies.length > 1 ? "s" : ""}`}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => isSA ? setShowCreateCompany(true) : router.push("/(tabs)/admin/agencies/create" as any)}>
            <Ionicons name="add" size={24} color={T.white} />
          </TouchableOpacity>
        </View>

        <View style={s.searchWrap}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" />
            <TextInput style={[s.searchInput, { fontFamily: T.font.sans }]} value={q} onChangeText={setQ} placeholder="Rechercher..." placeholderTextColor="rgba(255,255,255,0.45)" />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.6)" /></TouchableOpacity>}
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={T.white} size="large" /></View>
        ) : (
          <Animated.ScrollView style={[s.listContainer, { opacity: fadeAnim }]} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.white} />}>
            {isSA && (
              <>
                <SectionBlock icon="briefcase-outline" title="SOCIÉTÉS SAAS" desc="Clients abonnés à la plateforme" color={T.blue} colorLt={T.blueLt} colorMd={T.blueMd} count={filteredClients.length} />
                {filteredClients.map((item) => (
                  <SocieteCard key={item.id} item={item} onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/[id]" as any, params: { id: item.id } })} />
                ))}
                <Divider />
              </>
            )}
            <SectionBlock icon="storefront-outline" title="AGENCES DU RÉSEAU" desc="Points de service — filiales et partenaires opérationnels" color={T.teal} colorLt={T.tealLt} colorMd={T.tealMd} count={filteredAgencies.length} />
            {filteredAgencies.map((item) => (
              <AgenceCard key={item.id} item={item} onPress={() => openSheet(item)} />
            ))}
            {filteredAgencies.length === 0 && !loading && (
              <View style={s.empty}>
                <Ionicons name="storefront-outline" size={32} color="rgba(255,255,255,0.3)" />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>{q ? "Aucun résultat" : "Aucune agence"}</Text>
              </View>
            )}
            <View style={{ height: 80 }} />
          </Animated.ScrollView>
        )}

        {/* ✅ isSuperAdmin={isSA} — masque "Recharger" pour le SA */}
        <AgenceActionSheet
          agency={sheetAgency} visible={sheetVisible}
          isSuperAdmin={isSA}
          onClose={closeSheet}
          onViewDetails={() => { closeSheet(); router.push({ pathname: "/(tabs)/admin/agencies/details" as any, params: { id: sheetAgency?.id } }); }}
          onEdit={() => { closeSheet(); router.push({ pathname: "/(tabs)/admin/agencies/edit" as any, params: { id: sheetAgency?.id } }); }}
          onRefill={() => openRefill(sheetAgency)}
          onDelete={() => fetchData()}
        />

        <RefillAgencyModal
          visible={refillVisible} agency={refillAgency}
          onClose={() => { setRefillVisible(false); setTimeout(() => setRefillAgency(null), 300); }}
          onSuccess={() => fetchData()}
        />

        {isSA && <CreateCompanyModal visible={showCreateCompany} onClose={() => setShowCreateCompany(false)} onSuccess={() => fetchData()} isSuperAdmin />}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14 },
  heroTitle:     { color: T.white, fontSize: 22, fontWeight: "800" },
  heroSub:       { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  addBtn:        { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", justifyContent: "center", alignItems: "center" },
  searchWrap:    { paddingHorizontal: 16, paddingBottom: 12 },
  searchBox:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  searchInput:   { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  listContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: T.pageBg, flex: 1 },
  list:          { paddingHorizontal: 16, paddingTop: 20 },
  empty:         { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxt:      { color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: "600" },
});