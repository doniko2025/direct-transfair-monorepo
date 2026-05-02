// apps/direct-transfair-mobile/app/(tabs)/admin/clients/details.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/clients/details.tsx
// =========================================================
// CLIENT DETAILS v4.0 — Direct Transf'air
// Design: Obsidian Luxury (Super Admin uniquement)
// ✅ Wallets v4 société, stats, gérant, adresse parsée
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Alert, Platform, StatusBar, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

const T = {
  ink: "#0A0A0F", inkMid: "#12121A", inkLight: "#1C1C28", inkBorder: "#2A2A3A",
  gold: "#D4A853", goldSoft: "#F0C97A", goldGlow: "rgba(212,168,83,0.15)",
  cream: "#F5EFE0", creamDim: "#C4B89A",
  white: "#FFFFFF", ghost: "rgba(255,255,255,0.06)", ghostMid: "rgba(255,255,255,0.10)",
  green: "#22C55E", red: "#EF4444", amber: "#F59E0B", blue: "#60A5FA",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_COLORS = { ACTIVE: T.green, SUSPENDED: T.amber, INACTIVE: T.red, TRIAL: T.blue };
const SUBSCRIPTION_COLORS = { PURCHASE: T.gold, RENTAL: T.blue };
const CURRENCY_COLORS = { EUR: "#60A5FA", USD: "#34D399", XOF: T.gold, GNF: "#F87171", GBP: "#A78BFA" };

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={irS.row}>
      <View style={irS.iconBox}>
        <Ionicons name={icon as any} size={16} color={T.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[irS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[irS.value, { fontFamily: T.font.sans }]} numberOfLines={2}>{value || "—"}</Text>
      </View>
    </View>
  );
}
const irS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.goldGlow, justifyContent: "center", alignItems: "center",
  },
  label: { fontSize: 9, fontWeight: "900", color: T.creamDim, letterSpacing: 1, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: "700", color: T.white },
});

function WalletRow({ wallet }: { wallet: any }) {
  const currency = wallet.currency ?? "XOF";
  const color = CURRENCY_COLORS[currency as keyof typeof CURRENCY_COLORS] ?? T.gold;
  const balance = toNum(wallet.balance);
  const reserved = toNum(wallet.reservedBalance ?? 0);
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={wrS.row}>
      <View style={[wrS.colorDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={wrS.topRow}>
          <Text style={[wrS.code, { color, fontFamily: T.font.mono }]}>{currency}</Text>
          <Text style={[wrS.balance, { fontFamily: T.font.mono }]}>{fmt(balance, currency)}</Text>
        </View>
        <View style={wrS.progBg}>
          <View style={[wrS.progFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={[wrS.avail, { fontFamily: T.font.sans }]}>
          Disponible: {fmt(available, currency)} · Réservé: {fmt(reserved, currency)}
        </Text>
      </View>
    </View>
  );
}
const wrS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  colorDot: { width: 4, height: 52, borderRadius: 99, marginTop: 3 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  code: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  balance: { color: T.white, fontSize: 16, fontWeight: "800" },
  progBg: { height: 3, backgroundColor: T.ghost, borderRadius: 99, overflow: "hidden", marginBottom: 4 },
  progFill: { height: 3, borderRadius: 99 },
  avail: { color: T.creamDim, fontSize: 10, fontWeight: "600" },
});

function ActionBox({ icon, label, color, onPress, loading: load }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[axS.box, { backgroundColor: `${color}10`, borderColor: `${color}25` }]}
        onPress={onPress} disabled={load}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        {load ? <ActivityIndicator size="small" color={color} />
          : <>
              <Ionicons name={icon} size={20} color={color} />
              <Text style={[axS.label, { color, fontFamily: T.font.sans }]}>{label}</Text>
            </>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}
const axS = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: T.radius.md, borderWidth: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: "800" },
});

function isDigitsOnly(s: string) { return /^[0-9]+$/.test(s); }

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const idStr = Array.isArray(id) ? id[0] : id;
  const clientId = idStr && isDigitsOnly(idStr) ? Number(idStr) : NaN;

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchDetails = useCallback(async () => {
    if (!Number.isFinite(clientId)) { setErrorMsg("ID société invalide."); setLoading(false); return; }
    setLoading(true); setErrorMsg(null);
    try {
      const data = await api.getClient(clientId);
      setClient(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e: any) {
      setErrorMsg(e.response?.status === 404 ? "Société introuvable (404)." : "Erreur lors du chargement.");
    } finally { setLoading(false); }
  }, [clientId]);

  useFocusEffect(useCallback(() => { void fetchDetails(); return () => {}; }, [fetchDetails]));

  const handleToggleStatus = () => {
    const current = String(client.subscriptionStatus ?? "").toUpperCase();
    const nextStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const label = nextStatus === "ACTIVE" ? "activer" : "suspendre";
    const confirm = () => {
      setProcessing(true);
      api.updateClientStatus(client.id, nextStatus as any)
        .then((updated) => setClient(updated))
        .catch(() => Alert.alert("Erreur", "Impossible de changer le statut."))
        .finally(() => setProcessing(false));
    };
    if (Platform.OS === "web") { if (window.confirm(`Voulez-vous ${label} cette société ?`)) confirm(); }
    else Alert.alert("Confirmation", `Voulez-vous ${label} cette société ?`, [{ text: "Annuler", style: "cancel" }, { text: "OUI", onPress: confirm }]);
  };

  const handleDelete = () => {
    const confirm = () => {
      setProcessing(true);
      api.deleteClient(client.id)
        .then(() => { Alert.alert("Supprimé", "Société supprimée.", [{ text: "OK", onPress: () => router.back() }]); })
        .catch((e: any) => Alert.alert("Erreur", e?.response?.data?.message || "Impossible de supprimer."))
        .finally(() => setProcessing(false));
    };
    if (Platform.OS === "web") { if (window.confirm("Supprimer ? Action irréversible.")) confirm(); }
    else Alert.alert("Confirmation", "Supprimer cette société ? Action irréversible.", [
      { text: "Annuler", style: "cancel" }, { text: "SUPPRIMER", style: "destructive", onPress: confirm },
    ]);
  };

  if (loading) {
    return (
      <LinearGradient colors={[T.ink, T.inkMid]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={T.gold} size="large" />
      </LinearGradient>
    );
  }

  if (errorMsg || !client) {
    return (
      <LinearGradient colors={[T.ink, T.inkMid]} style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color={T.red} />
        <Text style={[{ color: T.white, fontSize: 16, fontWeight: "700", marginTop: 16, textAlign: "center", fontFamily: T.font.sans }]}>
          {errorMsg ?? "Erreur inconnue"}
        </Text>
        <TouchableOpacity style={[{ marginTop: 24, backgroundColor: T.goldGlow, paddingHorizontal: 24, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1, borderColor: `${T.gold}30` }]} onPress={() => router.back()}>
          <Text style={[{ color: T.gold, fontWeight: "800", fontFamily: T.font.sans }]}>Retour</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const isActive = String(client.subscriptionStatus ?? "").toUpperCase() === "ACTIVE";
  const statusColor = STATUS_COLORS[client.subscriptionStatus as keyof typeof STATUS_COLORS] ?? T.creamDim;
  const subColor = SUBSCRIPTION_COLORS[client.subscriptionType as keyof typeof SUBSCRIPTION_COLORS] ?? T.gold;
  const wallets = Array.isArray(client.wallets) ? client.wallets : [];
  const rawAddress = client.ownerAddress || client.address || "";
  const parts = rawAddress.split(",").map((s: string) => s.trim());

  return (
    <LinearGradient colors={[T.ink, T.inkMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1}>{client.name}</Text>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push({ pathname: "/(tabs)/admin/clients/edit", params: { id: client.id } })}
          >
            <Ionicons name="pencil" size={18} color={T.gold} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Status & Code */}
          <View style={s.statusRow}>
            <View style={[s.codePill, { borderColor: `${T.gold}30` }]}>
              <Text style={[s.codeTxt, { fontFamily: T.font.mono }]}>{client.code}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}25` }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[s.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
                {isActive ? "ACTIVE" : "SUSPENDUE"}
              </Text>
            </View>
            <View style={[s.subPill, { backgroundColor: `${subColor}10`, borderColor: `${subColor}25` }]}>
              <Text style={[s.subTxt, { color: subColor, fontFamily: T.font.sans }]}>
                {client.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Ionicons name="people-outline" size={18} color={T.blue} />
              <Text style={[s.statValue, { color: T.blue, fontFamily: T.font.display }]}>
                {client._count?.users ?? 0}
              </Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>Utilisateurs</Text>
            </View>
            <View style={s.statBox}>
              <Ionicons name="storefront-outline" size={18} color={T.gold} />
              <Text style={[s.statValue, { color: T.gold, fontFamily: T.font.display }]}>
                {client._count?.agencies ?? 0}
              </Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>Agences</Text>
            </View>
          </View>

          {/* Wallets */}
          {wallets.length > 0 && (
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.gold }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>WALLETS SOCIÉTÉ</Text>
              </View>
              {wallets.map((w: any) => <WalletRow key={w.id} wallet={w} />)}
            </View>
          )}

          {/* Infos société */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>SOCIÉTÉ & CONTACT</Text>
            </View>
            <InfoRow label="EMAIL ADMINISTRATEUR" value={client.email || client.contactEmail || ""} icon="mail-outline" />
            <InfoRow label="TÉLÉPHONE" value={client.phone || client.contactPhone || ""} icon="call-outline" />
            <InfoRow label="SECTEUR" value={client.activitySector || ""} icon="briefcase-outline" />
            <InfoRow label="DEVISE PRINCIPALE" value={client.defaultCurrency || ""} icon="cash-outline" />
          </View>

          {/* Gérant */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>GÉRANT</Text>
            </View>
            <InfoRow
              label="NOM COMPLET"
              value={`${client.ownerFirstName || ""} ${client.ownerLastName || ""}`.trim() || "—"}
              icon="person-outline"
            />
            <InfoRow
              label="NAISSANCE"
              value={[client.ownerBirthDate, client.ownerBirthPlace].filter(Boolean).join(" · ") || "—"}
              icon="calendar-outline"
            />
            <InfoRow label="NATIONALITÉ / PAYS" value={client.ownerCountry || ""} icon="flag-outline" />
          </View>

          {/* Adresse */}
          {rawAddress && (
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.green }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ADRESSE</Text>
              </View>
              {parts.map((part: string, i: number) => part ? (
                <Text key={i} style={[s.addressLine, { fontFamily: T.font.sans }]}>{part}</Text>
              ) : null)}
            </View>
          )}

          {/* Actions */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ACTIONS</Text>
          </View>
          <View style={s.actionsRow}>
            <ActionBox icon="pencil-outline" label="Modifier" color={T.blue} onPress={() => router.push({ pathname: "/(tabs)/admin/clients/edit", params: { id: client.id } })} loading={false} />
            <ActionBox icon={isActive ? "pause-circle-outline" : "play-circle-outline"} label={isActive ? "Suspendre" : "Activer"} color={T.amber} onPress={handleToggleStatus} loading={processing} />
            <ActionBox icon="trash-outline" label="Supprimer" color={T.red} onPress={handleDelete} loading={false} />
          </View>

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { flex: 1, color: T.white, fontSize: 20, fontWeight: "700" },
  editBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.goldGlow, borderWidth: 1, borderColor: `${T.gold}30`,
    justifyContent: "center", alignItems: "center",
  },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  codePill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: T.goldGlow, borderWidth: 1,
  },
  codeTxt: { color: T.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  subPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  subTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  statBox: {
    flex: 1, backgroundColor: T.ghost, borderRadius: T.radius.md, padding: 16,
    alignItems: "center", gap: 4, borderWidth: 1, borderColor: T.inkBorder,
  },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "900", color: T.creamDim, letterSpacing: 0.8 },
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.creamDim, letterSpacing: 1.5 },
  addressLine: { color: T.white, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
});