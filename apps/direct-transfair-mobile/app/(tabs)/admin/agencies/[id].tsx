// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/[id].tsx
// =========================================================
// DÉTAIL SOCIÉTÉ v2.0 — Direct Transf'air · SUPER ADMIN
// Design : Premium · Violet profond · Glassmorphism léger
// ✅ Hero immersif avec avatar large + statut flottant
// ✅ Stats en pills 2×2 avec indicateurs visuels
// ✅ Infos en cards modernes avec icônes colorées
// ✅ Actions contextuelles + zone dangereuse gradient rouge
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  Alert, Animated, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";

const { width: SW } = Dimensions.get("window");

const T = {
  h1: "#1E1B4B", h2: "#312E81", h3: "#4338CA",
  pageBg: "#F5F4FF", surface: "#FFFFFF", surfaceAlt: "#FAFAFF",
  border: "#E8E6FF", borderMd: "#D4D0FF",
  ink: "#1E1B4B", inkMid: "#3730A3", inkSub: "#6B7280", inkMuted: "#9CA3AF",
  violet: "#7C3AED", violetLt: "#EDE9FE", violetMd: "#C4B5FD",
  blue: "#2563EB", blueLt: "#EFF6FF", blueMd: "#BFDBFE",
  green: "#059669", greenLt: "#ECFDF5", greenMd: "#A7F3D0",
  red: "#DC2626", redLt: "#FEE2E2", redMd: "#FECACA",
  amber: "#D97706", amberLt: "#FEF3C7", amberMd: "#FDE68A",
  teal: "#0F766E", tealLt: "#CCFBF1", tealMd: "#5EEAD4",
  indigo: "#4338CA", indigoLt: "#EEF2FF", indigoMd: "#C7D2FE",
  white: "#FFFFFF",
  r: { sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 },
  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sub: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light", default: "Trebuchet MS" }),
    mono: Platform.select({ ios: "Trebuchet MS", android: "monospace", default: "monospace" }),
  },
};

const STATUS_CFG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  ACTIVE:    { color: T.green,  bg: "#D1FAE5",  dot: T.green,  label: "Active"    },
  SUSPENDED: { color: T.amber,  bg: "#FEF3C7",  dot: T.amber,  label: "Suspendue" },
  INACTIVE:  { color: T.red,    bg: "#FEE2E2",  dot: T.red,    label: "Inactive"  },
  EXPIRED:   { color: T.red,    bg: "#FEE2E2",  dot: T.red,    label: "Expirée"   },
  TRIAL:     { color: T.violet, bg: T.violetLt, dot: T.violet, label: "Essai"     },
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

function StatPill({ icon, value, label, color, bg }: {
  icon: string; value: string | number; label: string; color: string; bg: string;
}) {
  return (
    <View style={[spS.pill, { backgroundColor: bg, borderColor: color + "30" }]}>
      <View style={[spS.iconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <View>
        <Text style={[spS.val, { color, fontFamily: T.font.mono }]}>{value}</Text>
        <Text style={[spS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      </View>
    </View>
  );
}
const spS = StyleSheet.create({
  pill:    { flexDirection: "row", alignItems: "center", gap: 10, width: (SW - 52) / 2, backgroundColor: T.surface, borderRadius: T.r.md, padding: 12, borderWidth: 1, shadowColor: "#4338CA", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  val:     { fontSize: 20, fontWeight: "800" },
  label:   { fontSize: 9, color: T.inkMuted, fontWeight: "700", marginTop: 1 },
});

function InfoItem({ icon, iconColor, iconBg, label, value, mono }: {
  icon: string; iconColor: string; iconBg: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={iiS.row}>
      <View style={[iiS.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[iiS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[iiS.value, { fontFamily: mono ? T.font.mono : T.font.sans }]} numberOfLines={1}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}
const iiS = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 10, color: T.inkMuted, fontWeight: "700", marginBottom: 2 },
  value:   { fontSize: 13, color: T.ink, fontWeight: "700" },
});

function SectionTitle({ label, color }: { label: string; color: string }) {
  return (
    <View style={stS.row}>
      <View style={[stS.bar, { backgroundColor: color }]} />
      <Text style={[stS.txt, { fontFamily: T.font.sans, color }]}>{label}</Text>
    </View>
  );
}
const stS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 },
  bar: { width: 3, height: 16, borderRadius: 99 },
  txt: { fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
});

const HERO_BR = 30;

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client,  setClient]  = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<"suspend" | "activate" | "delete" | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.getClient(Number(id));
      setClient(c);
      Animated.parallel([
        Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
        Animated.spring(heroScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }),
      ]).start();
    } catch {
      Alert.alert("Erreur", "Impossible de charger la société.");
      router.back();
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0); heroScale.setValue(0.96); void load();
  }, [load]));

  const handleSuspend = () => Alert.alert("Suspendre", `Suspendre ${client?.name} ?`, [
    { text: "Annuler", style: "cancel" },
    { text: "Suspendre", style: "destructive", onPress: async () => {
      setActing("suspend");
      try { await api.updateClientStatus(Number(id), "SUSPENDED" as any); await load(); }
      catch { Alert.alert("Erreur", "Impossible de suspendre."); }
      finally { setActing(null); }
    }},
  ]);

  const handleActivate = () => Alert.alert("Réactiver", `Réactiver ${client?.name} ?`, [
    { text: "Annuler", style: "cancel" },
    { text: "Réactiver", onPress: async () => {
      setActing("activate");
      try { await api.updateClientStatus(Number(id), "ACTIVE" as any); await load(); }
      catch { Alert.alert("Erreur", "Impossible de réactiver."); }
      finally { setActing(null); }
    }},
  ]);

  const handleDelete = () => Alert.alert(
    "⚠️ Supprimer définitivement",
    `Supprimer ${client?.name} ? Toutes les données associées seront perdues. Irréversible.`,
    [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        setActing("delete");
        try {
          await api.deleteClient(Number(id));
          Alert.alert("Supprimé", `${client?.name} a été supprimé.`, [{ text: "OK", onPress: () => router.back() }]);
        } catch { Alert.alert("Erreur", "Impossible de supprimer."); }
        finally { setActing(null); }
      }},
    ]
  );

  if (loading) return (
    <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator color={T.violet} size="large" />
    </SafeAreaView>
  );
  if (!client) return null;

  const st          = STATUS_CFG[client.subscriptionStatus?.toUpperCase()] ?? STATUS_CFG.INACTIVE;
  const isActive    = client.subscriptionStatus?.toUpperCase() === "ACTIVE";
  const isSuspended = client.subscriptionStatus?.toUpperCase() === "SUSPENDED";
  const initial     = (client.name?.[0] ?? "C").toUpperCase();
  const userCount   = toNum(client._count?.users   ?? client.users?.length   ?? 0);
  const agencyCount = toNum(client._count?.agencies ?? client.agencies?.length ?? 0);
  const walletCount = client.wallets?.length ?? 0;
  const txCount     = toNum(client._count?.transactions ?? 0);
  const sbH         = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={T.h1} />

      <Animated.View style={[s.heroWrap, { transform: [{ scale: heroScale }] }]}>
        <LinearGradient colors={[T.h1, T.h2, T.h3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: sbH + 12 }]}>
          <View style={s.deco1} /><View style={s.deco2} /><View style={s.deco3} />
          <View style={s.nav}>
            <TouchableOpacity style={s.navBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={T.white} />
            </TouchableOpacity>
            <View style={s.saLabel}>
              <View style={s.saLabelDot} />
              <Text style={[s.saLabelTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
          </View>
          <View style={s.heroBody}>
            <View style={s.avatarWrap}>
              <View style={s.avatarRing}>
                <View style={s.avatar}>
                  <Text style={[s.avatarLetter, { fontFamily: T.font.display }]}>{initial}</Text>
                </View>
              </View>
              <View style={[s.statusBadge, { backgroundColor: st.bg, borderColor: st.color + "40" }]}>
                <View style={[s.statusDot2, { backgroundColor: st.dot }]} />
                <Text style={[s.statusLabel, { color: st.color, fontFamily: T.font.sans }]}>{st.label}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.clientName, { fontFamily: T.font.display }]} numberOfLines={1}>{client.name}</Text>
              <Text style={[s.clientCode, { fontFamily: T.font.mono }]}>{client.code}</Text>
              {client.activitySector && (
                <View style={s.sectorPill}>
                  <Ionicons name="briefcase-outline" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={[s.sectorTxt, { fontFamily: T.font.sans }]}>{client.activitySector}</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
        <View style={[s.cornerL, { backgroundColor: T.pageBg }]} />
        <View style={[s.cornerR, { backgroundColor: T.pageBg }]} />
      </Animated.View>

      <Animated.ScrollView style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.statsGrid}>
          <StatPill icon="people-outline"    value={userCount}   label="Utilisateurs"  color={T.indigo} bg={T.indigoLt} />
          <StatPill icon="business-outline"  value={agencyCount} label="Agences"        color={T.teal}   bg={T.tealLt}   />
          <StatPill icon="analytics-outline" value={txCount}     label="Transactions"   color={T.violet} bg={T.violetLt} />
          <StatPill icon="wallet-outline"    value={walletCount} label="Wallets"         color={T.blue}   bg={T.blueLt}   />
        </View>

        <SectionTitle label="INFORMATIONS SOCIÉTÉ" color={T.violet} />
        <View style={s.card}>
          <InfoItem icon="mail-outline"      iconColor={T.blue}   iconBg={T.blueLt}   label="Email"             value={client.email ?? client.contactEmail ?? "—"} />
          <InfoItem icon="call-outline"      iconColor={T.green}  iconBg={T.greenLt}  label="Téléphone"         value={client.phone ?? client.contactPhone ?? "—"} />
          <InfoItem icon="globe-outline"     iconColor={T.teal}   iconBg={T.tealLt}   label="Pays"              value={client.country ?? "—"} />
          <InfoItem icon="location-outline"  iconColor={T.violet} iconBg={T.violetLt} label="Ville"             value={client.city ?? "—"} />
          <InfoItem icon="cash-outline"      iconColor={T.amber}  iconBg={T.amberLt}  label="Devise principale" value={client.defaultCurrency ?? "—"} mono />
          <InfoItem icon="card-outline"      iconColor={T.indigo} iconBg={T.indigoLt} label="Type de contrat"   value={client.subscriptionType === "PURCHASE" ? "Achat" : "Location"} />
          <InfoItem icon="calendar-outline"  iconColor={T.teal}   iconBg={T.tealLt}   label="Début abonnement"  value={fmtDate(client.subscriptionStart)} />
          <InfoItem icon="calendar-outline"  iconColor={T.blue}   iconBg={T.blueLt}   label="Fin abonnement"    value={fmtDate(client.subscriptionEnd)} />
          <InfoItem icon="time-outline"      iconColor={T.inkSub} iconBg="#F1F5F9"    label="Créé le"           value={fmtDate(client.createdAt)} />
        </View>

        {(client.ownerFirstName || client.ownerLastName) && (
          <>
            <SectionTitle label="PROPRIÉTAIRE" color={T.teal} />
            <View style={s.card}>
              <InfoItem icon="person-outline" iconColor={T.teal}   iconBg={T.tealLt}   label="Nom complet" value={`${client.ownerFirstName ?? ""} ${client.ownerLastName ?? ""}`.trim()} />
              {client.ownerCountry && <InfoItem icon="flag-outline" iconColor={T.blue} iconBg={T.blueLt}  label="Nationalité" value={client.ownerCountry} />}
              {client.ownerAddress && <InfoItem icon="home-outline" iconColor={T.violet} iconBg={T.violetLt} label="Adresse"  value={client.ownerAddress} />}
            </View>
          </>
        )}

        <SectionTitle label={isActive ? "SUSPENDRE L'ACCÈS" : "GÉRER LE STATUT"} color={isActive ? T.amber : T.green} />
        <TouchableOpacity
          style={[s.actionCard, isActive
            ? { backgroundColor: T.amberLt, borderColor: T.amberMd }
            : { backgroundColor: T.greenLt, borderColor: T.greenMd }
          ]}
          onPress={isActive ? handleSuspend : handleActivate}
          disabled={acting === "suspend" || acting === "activate"}
          activeOpacity={0.8}
        >
          <View style={[s.actionIcon, { backgroundColor: (isActive ? T.amber : T.green) + "22" }]}>
            {(acting === "suspend" || acting === "activate")
              ? <ActivityIndicator color={isActive ? T.amber : T.green} size="small" />
              : <Ionicons name={isActive ? "pause-circle-outline" : "checkmark-circle-outline"} size={24} color={isActive ? T.amber : T.green} />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionTitle, { color: isActive ? T.amber : T.green, fontFamily: T.font.sans }]}>
              {isActive ? "Suspendre la société" : isSuspended ? "Réactiver la société" : "Activer la société"}
            </Text>
            <Text style={[s.actionSub, { fontFamily: T.font.sub }]}>
              {isActive ? "Bloque l'accès sans supprimer les données" : "Restaure l'accès complet à la plateforme"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={isActive ? T.amber : T.green} />
        </TouchableOpacity>

        <SectionTitle label="ZONE DANGEREUSE" color={T.red} />
        <View style={s.dangerCard}>
          <View style={s.dangerHeader}>
            <View style={[s.dangerIconBox, { backgroundColor: T.redLt }]}>
              <Ionicons name="warning" size={20} color={T.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.dangerTitle, { fontFamily: T.font.sans }]}>Suppression définitive</Text>
              <Text style={[s.dangerDesc, { fontFamily: T.font.sub }]}>
                Supprime la société, ses admins, agences, wallets et transactions. Irréversible.
              </Text>
            </View>
          </View>
          <LinearGradient colors={["#DC2626", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <TouchableOpacity style={s.deleteInner} onPress={handleDelete} disabled={acting === "delete"} activeOpacity={0.85}>
              {acting === "delete"
                ? <ActivityIndicator color={T.white} />
                : <>
                    <Ionicons name="trash-outline" size={18} color={T.white} />
                    <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer {client.name}</Text>
                  </>
              }
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={{ height: 80 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: T.pageBg },
  scroll:      { padding: 18 },
  heroWrap:    { zIndex: 10, shadowColor: T.h1, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.32, shadowRadius: 24, elevation: 18 },
  hero:        { paddingHorizontal: 20, paddingBottom: 28, overflow: "hidden", borderBottomLeftRadius: HERO_BR, borderBottomRightRadius: HERO_BR },
  deco1:       { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.04)", top: -70, right: -60 },
  deco2:       { position: "absolute", width: 100, height: 100, borderRadius: 50,  backgroundColor: "rgba(255,255,255,0.03)", bottom: -20, left: -20 },
  deco3:       { position: "absolute", width: 60,  height: 60,  borderRadius: 30,  backgroundColor: "rgba(255,255,255,0.05)", top: 40, right: 30 },
  nav:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  navBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" },
  saLabel:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  saLabelDot:  { width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  saLabelTxt:  { color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  heroBody:    { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap:  { position: "relative" },
  avatarRing:  { width: 74, height: 74, borderRadius: 22, padding: 3, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)" },
  avatar:      { flex: 1, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center" },
  avatarLetter:{ fontSize: 30, fontWeight: "700", color: T.white },
  statusBadge: { position: "absolute", bottom: -6, right: -6, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusDot2:  { width: 5, height: 5, borderRadius: 99 },
  statusLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  clientName:  { color: T.white, fontSize: 20, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
  clientCode:  { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  sectorPill:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  sectorTxt:   { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600" },
  cornerL:     { position: "absolute", bottom: 0, left: 0, width: HERO_BR, height: HERO_BR, borderTopRightRadius: HERO_BR },
  cornerR:     { position: "absolute", bottom: 0, right: 0, width: HERO_BR, height: HERO_BR, borderTopLeftRadius: HERO_BR },
  statsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  card:        { backgroundColor: T.surface, borderRadius: T.r.lg, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 22, borderWidth: 1, borderColor: T.border, shadowColor: "#4338CA", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  actionCard:  { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: T.r.lg, borderWidth: 1.5, marginBottom: 22, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  actionIcon:  { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  actionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  actionSub:   { fontSize: 11, color: T.inkSub },
  dangerCard:  { backgroundColor: T.surface, borderRadius: T.r.lg, overflow: "hidden", borderWidth: 1.5, borderColor: "#FECACA", marginBottom: 22, shadowColor: T.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  dangerHeader:{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, paddingBottom: 14 },
  dangerIconBox:{ width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  dangerTitle: { fontSize: 14, fontWeight: "800", color: T.red, marginBottom: 4 },
  dangerDesc:  { fontSize: 11, color: T.inkSub, lineHeight: 17 },
  deleteInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  deleteTxt:   { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },
});