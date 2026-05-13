// apps/direct-transfair-mobile/app/(tabs)/admin/clients/details.tsx
// =========================================================
// CLIENT DETAILS v5.0 — Direct Transf'air
// ✅ Thème CLAIR — zéro dark/sombre
// ✅ Style inspiré capture Grand Chef (fond blanc, cartes blanches)
// ✅ Données 100% API — aucune valeur en dur
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

// ─── Design Tokens (LIGHT) ───────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderMd: "#CDD5E0",

  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",

  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  greenMd:  "#86EFAC",

  red:      "#DC2626",
  redLt:    "#FEE2E2",

  amber:    "#D97706",
  amberLt:  "#FEF3C7",

  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  white:    "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    subtitle: Platform.select({ ios: "Avenir Next", android: "sans-serif-light",  default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
  shadow: {
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
  },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: T.green, SUSPENDED: T.amber, INACTIVE: T.red, TRIAL: "#6366F1",
};
const CURRENCY_COLORS: Record<string, string> = {
  EUR: "#1956F0", USD: "#16A34A", XOF: "#D97706", GNF: "#DC2626", GBP: "#7C3AED",
};
const CURRENCY_BG: Record<string, string> = {
  EUR: "#EEF2FF", USD: "#DCFCE7", XOF: "#FEF3C7", GNF: "#FEE2E2", GBP: "#EDE9FE",
};

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

// ─── Info Row ──────────────────────────────────────────────
function InfoRow({ label, value, icon, accent = T.blue }: {
  label: string; value: string; icon: string; accent?: string;
}) {
  if (!value) return null;
  return (
    <View style={irS.row}>
      <View style={[irS.iconBox, { backgroundColor: `${accent}12` }]}>
        <Ionicons name={icon as any} size={15} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[irS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[irS.value, { fontFamily: T.font.sans }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}
const irS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" },
  value: { fontSize: 14, fontWeight: "700", color: T.ink },
});

// ─── Wallet Row ────────────────────────────────────────────
function WalletRow({ wallet }: { wallet: any }) {
  const currency = wallet.currency ?? "XOF";
  const color = CURRENCY_COLORS[currency] ?? T.blue;
  const bg    = CURRENCY_BG[currency]    ?? T.blueLt;
  const balance   = toNum(wallet.balance);
  const reserved  = toNum(wallet.reservedBalance ?? 0);
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={wrS.row}>
      <View style={[wrS.currencyBox, { backgroundColor: bg }]}>
        <Text style={[wrS.currencyCode, { color, fontFamily: T.font.mono }]}>{currency}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={wrS.topRow}>
          <Text style={[wrS.balLabel, { fontFamily: T.font.sans }]}>Solde total</Text>
          <Text style={[wrS.balance, { color, fontFamily: T.font.mono }]}>{fmt(balance, currency)}</Text>
        </View>
        <View style={[wrS.progBg, { backgroundColor: `${color}15` }]}>
          <View style={[wrS.progFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
        <View style={wrS.subRow}>
          <Text style={[wrS.subTxt, { fontFamily: T.font.sans }]}>Dispo: {fmt(available, currency)}</Text>
          <Text style={[wrS.subTxt, { fontFamily: T.font.sans }]}>Réservé: {fmt(reserved, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
const wrS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  currencyBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  currencyCode: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  balLabel: { fontSize: 10, color: T.inkMuted, fontWeight: "700" },
  balance: { fontSize: 15, fontWeight: "800" },
  progBg: { height: 4, borderRadius: 99, overflow: "hidden", marginBottom: 6 },
  progFill: { height: 4, borderRadius: 99 },
  subRow: { flexDirection: "row", justifyContent: "space-between" },
  subTxt: { fontSize: 10, color: T.inkSub, fontWeight: "600" },
});

// ─── Action Box ────────────────────────────────────────────
function ActionBox({ icon, label, color, bgColor, onPress, loading: load }: {
  icon: string; label: string; color: string; bgColor: string;
  onPress: () => void; loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[axS.box, { backgroundColor: bgColor, borderColor: `${color}25` }]}
        onPress={onPress}
        disabled={load}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        {load
          ? <ActivityIndicator size="small" color={color} />
          : <>
              <Ionicons name={icon as any} size={20} color={color} />
              <Text style={[axS.label, { color, fontFamily: T.font.sans }]}>{label}</Text>
            </>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}
const axS = StyleSheet.create({
  box: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 16, borderRadius: T.radius.md,
    borderWidth: 1, gap: 6,
  },
  label: { fontSize: 11, fontWeight: "800" },
});

// ─── Section Header ────────────────────────────────────────
function SH({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  label: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.5, textTransform: "uppercase" },
});

function isDigitsOnly(s: string) { return /^[0-9]+$/.test(s); }

// ─── Main Screen ───────────────────────────────────────────
export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router  = useRouter();
  const { user } = useAuth();

  const idStr    = Array.isArray(id) ? id[0] : id;
  const clientId = idStr && isDigitsOnly(idStr) ? Number(idStr) : NaN;

  const [client,     setClient]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
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
    const current    = String(client.subscriptionStatus ?? "").toUpperCase();
    const nextStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const label      = nextStatus === "ACTIVE" ? "activer" : "suspendre";
    const confirm    = () => {
      setProcessing(true);
      api.updateClientStatus(client.id, nextStatus as any)
        .then((updated) => setClient(updated))
        .catch(() => Alert.alert("Erreur", "Impossible de changer le statut."))
        .finally(() => setProcessing(false));
    };
    if (Platform.OS === "web") { if (window.confirm(`Voulez-vous ${label} cette société ?`)) confirm(); }
    else Alert.alert("Confirmation", `Voulez-vous ${label} cette société ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "OUI", onPress: confirm },
    ]);
  };

  const handleDelete = () => {
    const confirm = () => {
      setProcessing(true);
      api.deleteClient(client.id)
        .then(() => Alert.alert("Supprimé", "Société supprimée.", [{ text: "OK", onPress: () => router.back() }]))
        .catch((e: any) => Alert.alert("Erreur", e?.response?.data?.message || "Impossible de supprimer."))
        .finally(() => setProcessing(false));
    };
    if (Platform.OS === "web") { if (window.confirm("Supprimer ? Action irréversible.")) confirm(); }
    else Alert.alert("Confirmation", "Supprimer cette société ? Action irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "SUPPRIMER", style: "destructive", onPress: confirm },
    ]);
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={T.blue} size="large" />
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (errorMsg || !client) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={T.red} />
        <Text style={[{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16, textAlign: "center", fontFamily: T.font.sans }]}>
          {errorMsg ?? "Erreur inconnue"}
        </Text>
        <TouchableOpacity
          style={[{ marginTop: 24, backgroundColor: T.blueLt, paddingHorizontal: 24, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.blueMd }]}
          onPress={() => router.back()}
        >
          <Text style={[{ color: T.blue, fontWeight: "800", fontFamily: T.font.sans }]}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isActive    = String(client.subscriptionStatus ?? "").toUpperCase() === "ACTIVE";
  const statusColor = STATUS_COLORS[client.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  const wallets     = Array.isArray(client.wallets) ? client.wallets : [];
  const rawAddress  = client.ownerAddress || client.address || "";
  const addrParts   = rawAddress.split(",").map((s: string) => s.trim()).filter(Boolean);
  const userCount   = client._count?.users   ?? client.users?.length   ?? 0;
  const agencyCount = client._count?.agencies ?? client.agencies?.length ?? 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.pageBg} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1}>
          {client.name}
        </Text>
        <TouchableOpacity
          style={s.editBtn}
          onPress={() => router.push({ pathname: "/(tabs)/admin/clients/edit", params: { id: client.id } })}
        >
          <Ionicons name="pencil" size={17} color={T.blue} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card société ── */}
        <View style={s.heroCard}>
          {/* Barre colorée top selon statut */}
          <View style={[s.heroTopBar, { backgroundColor: statusColor }]} />

          <View style={s.heroRow}>
            <View style={[s.heroAvatar, { backgroundColor: `${T.blue}12` }]}>
              <Text style={[s.heroAvatarLetter, { fontFamily: T.font.display }]}>
                {(client.name?.[0] ?? "C").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroName, { fontFamily: T.font.display }]} numberOfLines={1}>
                {client.name}
              </Text>
              <View style={s.pillRow}>
                <View style={[s.codePill, { backgroundColor: T.amberLt }]}>
                  <Text style={[s.codeTxt, { fontFamily: T.font.mono }]}>{client.code}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}30` }]}>
                  <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[s.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
                    {isActive ? "ACTIVE" : (client.subscriptionStatus ?? "—").toUpperCase()}
                  </Text>
                </View>
                <View style={[s.subPill, { backgroundColor: T.blueLt, borderColor: T.blueMd }]}>
                  <Text style={[s.subTxt, { color: T.blue, fontFamily: T.font.sans }]}>
                    {client.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stats compteurs */}
          <View style={s.countersRow}>
            <View style={[s.counterBox, { borderRightWidth: 1, borderRightColor: T.border }]}>
              <Text style={[s.counterVal, { color: T.blue, fontFamily: T.font.display }]}>
                {userCount}
              </Text>
              <Text style={[s.counterLbl, { fontFamily: T.font.sans }]}>Utilisateurs</Text>
            </View>
            <View style={s.counterBox}>
              <Text style={[s.counterVal, { color: T.amber, fontFamily: T.font.display }]}>
                {agencyCount}
              </Text>
              <Text style={[s.counterLbl, { fontFamily: T.font.sans }]}>Agences</Text>
            </View>
          </View>
        </View>

        {/* ── Wallets ── */}
        {wallets.length > 0 && (
          <View style={s.card}>
            <SH dot={T.amber} label="Wallets société" />
            {wallets.map((w: any) => <WalletRow key={w.id ?? w.currency} wallet={w} />)}
          </View>
        )}

        {/* ── Société & Contact ── */}
        <View style={s.card}>
          <SH dot={T.blue} label="Société & Contact" />
          <InfoRow label="Email administrateur" value={client.email || client.contactEmail || ""} icon="mail-outline" accent={T.blue} />
          <InfoRow label="Téléphone"           value={client.phone || client.contactPhone || ""}  icon="call-outline"      accent={T.blue} />
          <InfoRow label="Secteur d'activité"  value={client.activitySector || ""}                icon="briefcase-outline" accent={T.blue} />
          <InfoRow label="Devise principale"   value={client.defaultCurrency || ""}               icon="cash-outline"      accent={T.blue} />
        </View>

        {/* ── Gérant ── */}
        <View style={s.card}>
          <SH dot={T.amber} label="Gérant" />
          <InfoRow
            label="Nom complet"
            value={`${client.ownerFirstName || ""} ${client.ownerLastName || ""}`.trim() || ""}
            icon="person-outline"
            accent={T.amber}
          />
          <InfoRow
            label="Naissance"
            value={[client.ownerBirthDate, client.ownerBirthPlace].filter(Boolean).join(" · ") || ""}
            icon="calendar-outline"
            accent={T.amber}
          />
          <InfoRow label="Nationalité / Pays" value={client.ownerCountry || ""} icon="flag-outline" accent={T.amber} />
        </View>

        {/* ── Adresse ── */}
        {addrParts.length > 0 && (
          <View style={s.card}>
            <SH dot={T.green} label="Adresse" />
            <View style={s.addrBox}>
              <Ionicons name="location-outline" size={20} color={T.green} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                {addrParts.map((part: string, i: number) => (
                  <Text key={i} style={[s.addrLine, { fontFamily: T.font.sans }]}>{part}</Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={s.card}>
          <SH dot={T.red} label="Actions" />
          <View style={s.actionsRow}>
            <ActionBox
              icon="pencil-outline"
              label="Modifier"
              color={T.blue}
              bgColor={T.blueLt}
              onPress={() => router.push({ pathname: "/(tabs)/admin/clients/edit", params: { id: client.id } })}
            />
            <ActionBox
              icon={isActive ? "pause-circle-outline" : "play-circle-outline"}
              label={isActive ? "Suspendre" : "Activer"}
              color={T.amber}
              bgColor={T.amberLt}
              onPress={handleToggleStatus}
              loading={processing}
            />
            <ActionBox
              icon="trash-outline"
              label="Supprimer"
              color={T.red}
              bgColor={T.redLt}
              onPress={handleDelete}
            />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#F2F4F8" },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.pageBg,
    borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { flex: 1, color: T.ink, fontSize: 19, fontWeight: "700" },
  editBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.blueLt,
    borderWidth: 1, borderColor: T.blueMd,
    justifyContent: "center", alignItems: "center",
  },

  scroll: { padding: 16 },

  heroCard: {
    backgroundColor: T.surface,
    borderRadius: T.radius.xl,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1, borderColor: T.border,
    ...{ shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  },
  heroTopBar: { height: 4, width: "100%" },
  heroRow: {
    flexDirection: "row", alignItems: "center",
    padding: 16, gap: 14,
  },
  heroAvatar: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.blueMd,
  },
  heroAvatarLetter: { fontSize: 24, fontWeight: "700", color: T.blue },
  heroName: { color: T.ink, fontSize: 17, fontWeight: "700", marginBottom: 8 },
  pillRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  codePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  codeTxt: { color: T.amber, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 7, borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  subPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  subTxt: { fontSize: 9, fontWeight: "900" },

  countersRow: {
    flexDirection: "row",
    borderTopWidth: 1, borderTopColor: T.border,
  },
  counterBox: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 },
  counterVal: { fontSize: 26, fontWeight: "800" },
  counterLbl: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: T.border,
    ...{ shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  },

  addrBox: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  addrLine: { color: T.ink, fontSize: 14, fontWeight: "600", marginBottom: 3 },

  actionsRow: { flexDirection: "row", gap: 10 },
});