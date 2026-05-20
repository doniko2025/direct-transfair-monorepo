// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/details.tsx
// =========================================================
// AGENCY DETAILS — Direct Transf'air v4.1
// Design: Thème CLAIR dynamique par rôle
// ✅ Wallet agence v4 (plus balance/cash directs)
// ✅ Actions suspendre/activer/supprimer
// =========================================================

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Alert, Platform, StatusBar, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

// ─── Palettes CLAIRES par rôle ───────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#FFF8F0", g2: "#FFF3E0", accent: "#B45309", accentSoft: "rgba(180,83,9,0.10)",   label: "SUPER ADMIN" },
  COMPANY_ADMIN: { g1: "#F0F7FF", g2: "#E8F3FF", accent: "#1D4ED8", accentSoft: "rgba(29,78,216,0.10)",  label: "ADMIN SOCIÉTÉ" },
  AGENT:         { g1: "#FFFBF0", g2: "#FFF8E1", accent: "#D97706", accentSoft: "rgba(217,119,6,0.10)",   label: "AGENT" },
  USER:          { g1: "#F0FDF8", g2: "#E8FDF3", accent: "#059669", accentSoft: "rgba(5,150,105,0.10)",   label: "CLIENT" },
} as const;

const T = {
  surface:    "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border:     "#E2E8F0",
  borderLt:   "#F1F5F9",
  ink:        "#0F172A",
  inkMid:     "#334155",
  inkSub:     "#64748B",
  inkMuted:   "#94A3B8",
  white:      "#FFFFFF",
  red:        "#DC2626",
  redLt:      "#FEF2F2",
  redBorder:  "#FECACA",
  green:      "#16A34A",
  greenLt:    "#F0FDF4",
  greenBorder:"#BBF7D0",
  amber:      "#D97706",
  amberLt:    "#FFFBEB",
  amberBorder:"#FDE68A",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
  shadow: {
    card: {
      shadowColor: "#64748B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    soft: {
      shadowColor: "#94A3B8",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
  },
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

// ─── Info Row ─────────────────────────────────────────────
function InfoRow({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <View style={irS.row}>
      <View style={[irS.iconBox, { backgroundColor: `${accent}12`, borderWidth: 1, borderColor: `${accent}20` }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[irS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[irS.value, { fontFamily: T.font.sans }]} numberOfLines={2}>{value || "—"}</Text>
      </View>
    </View>
  );
}
const irS = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, gap: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" },
  value:   { fontSize: 14, fontWeight: "700", color: T.ink },
});

// ─── Wallet Card ─────────────────────────────────────────
function WalletCard({ wallet, accent }: { wallet: any; accent: string }) {
  const balance   = toNum(wallet?.balance);
  const reserved  = toNum(wallet?.reservedBalance ?? 0);
  const available = balance - reserved;
  const pct       = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;
  const currency  = wallet?.currency ?? "XOF";

  return (
    <View style={[wcS.card, { borderColor: `${accent}25`, ...T.shadow.card }]}>
      {/* Top badges */}
      <View style={wcS.top}>
        <View style={[wcS.badge, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}>
          <Text style={[wcS.badgeTxt, { color: accent, fontFamily: T.font.mono }]}>{currency}</Text>
        </View>
        {wallet?.isDefault && (
          <View style={wcS.defaultTag}>
            <Ionicons name="star" size={8} color={T.amber} />
            <Text style={[wcS.defaultTxt, { fontFamily: T.font.sans }]}>Principal</Text>
          </View>
        )}
      </View>

      {/* Amount */}
      <Text style={[wcS.amount, { color: T.ink, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(balance, currency)}
      </Text>
      <Text style={[wcS.amtLabel, { color: accent, fontFamily: T.font.sans }]}>{currency}</Text>

      {/* Progress bar */}
      <View style={wcS.progBg}>
        <View style={[wcS.progFill, { width: `${pct}%` as any, backgroundColor: accent }]} />
      </View>

      {/* Footer */}
      <View style={wcS.footRow}>
        <View>
          <Text style={[wcS.footLabel, { fontFamily: T.font.sans }]}>Disponible</Text>
          <Text style={[wcS.footVal, { color: accent, fontFamily: T.font.mono }]}>{fmt(available, currency)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[wcS.footLabel, { fontFamily: T.font.sans }]}>Réservé</Text>
          <Text style={[wcS.footVal, { color: T.inkSub, fontFamily: T.font.mono }]}>{fmt(reserved, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
const wcS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  top:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  badgeTxt:   { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  defaultTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.amberLt, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: T.amberBorder,
  },
  defaultTxt: { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.5 },
  amount:     { fontSize: 32, letterSpacing: -0.5, marginBottom: 2, fontWeight: "700" },
  amtLabel:   { fontSize: 11, fontWeight: "800", marginBottom: 14 },
  progBg:     { height: 4, backgroundColor: T.borderLt, borderRadius: 99, overflow: "hidden", marginBottom: 14 },
  progFill:   { height: 4, borderRadius: 99 },
  footRow:    { flexDirection: "row", justifyContent: "space-between" },
  footLabel:  { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" },
  footVal:    { fontSize: 13, fontWeight: "800" },
});

// ─── Action Box ───────────────────────────────────────────
function ActionBox({ icon, label, color, bg, borderColor, onPress, loading }: any) {
  const scale = React.useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[axS.box, { backgroundColor: bg, borderColor: borderColor ?? `${color}25` }]}
        onPress={onPress}
        disabled={loading}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        {loading
          ? <ActivityIndicator size="small" color={color} />
          : <>
              <Ionicons name={icon} size={22} color={color} />
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
    paddingVertical: 18, borderRadius: T.radius.md, borderWidth: 1.5, gap: 8,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgencyDetailsScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [agency,     setAgency]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const fetchDetails = useCallback(async () => {
    try {
      const data = await api.getAgency(id as string);
      setAgency(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e: any) {
      if (e.response?.status === 404) router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { if (id) fetchDetails(); }, [fetchDetails]));

  const confirm = (title: string, msg: string, onOk: () => void) => {
    if (Platform.OS === "web") { if (window.confirm(`${title}\n${msg}`)) onOk(); }
    else Alert.alert(title, msg, [{ text: "Annuler", style: "cancel" }, { text: "OUI", onPress: onOk }]);
  };

  const handleDelete = () => {
    confirm(
      "Supprimer l'agence",
      `Supprimer "${agency.name}" ? Cette action est irréversible.`,
      async () => {
        setProcessing(true);
        try {
          await api.deleteAgency(agency.id);
          if (Platform.OS === "web") { alert("Agence supprimée !"); router.back(); }
          else Alert.alert("Succès", "Agence supprimée !", [{ text: "OK", onPress: () => router.back() }]);
        } catch {
          if (Platform.OS === "web") alert("Erreur lors de la suppression");
          else Alert.alert("Erreur", "Impossible de supprimer.");
        } finally { setProcessing(false); }
      }
    );
  };

  const handleToggleStatus = () => {
    confirm(
      agency.isActive ? "Suspendre l'agence" : "Activer l'agence",
      `Voulez-vous ${agency.isActive ? "suspendre" : "activer"} "${agency.name}" ?`,
      async () => {
        setProcessing(true);
        try {
          await api.updateAgency(agency.id, { isActive: !agency.isActive } as any);
          setAgency({ ...agency, isActive: !agency.isActive });
        } catch {
          Alert.alert("Erreur", "Impossible de changer le statut.");
        } finally { setProcessing(false); }
      }
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.g1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (!agency) return null;

  const isActive      = agency.isActive;
  const wallets       = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primaryWallet = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const currency      = primaryWallet?.currency ?? agency.primaryCurrency ?? "XOF";

  return (
    <View style={[s.root, { backgroundColor: theme.g1 }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.g1} />

        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: theme.g1, borderBottomColor: T.border }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.ink} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display, color: T.ink }]} numberOfLines={1}>
            {agency.name}
          </Text>
          <TouchableOpacity
            style={[s.editBtn, { backgroundColor: theme.accentSoft, borderColor: `${theme.accent}30` }]}
            onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: agency.id } })}
          >
            <Ionicons name="pencil" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Status badges ── */}
          <View style={s.statusRow}>
            <View style={[
              s.statusPill,
              isActive
                ? { backgroundColor: T.greenLt,  borderColor: T.greenBorder }
                : { backgroundColor: T.redLt,    borderColor: T.redBorder },
            ]}>
              <View style={[s.statusDot, { backgroundColor: isActive ? T.green : T.red }]} />
              <Text style={[s.statusTxt, { color: isActive ? T.green : T.red, fontFamily: T.font.sans }]}>
                {isActive ? "AGENCE ACTIVE" : "AGENCE SUSPENDUE"}
              </Text>
            </View>
            <View style={[s.typePill, { borderColor: `${theme.accent}30`, backgroundColor: theme.accentSoft }]}>
              <Text style={[s.typeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                {agency.type === "PARTNER" ? "PARTENAIRE" : "FILIALE"}
              </Text>
            </View>
          </View>

          {/* ── Section label: Trésorerie ── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans, color: T.inkSub }]}>
              TRÉSORERIE · {currency}
            </Text>
          </View>

          {wallets.length > 0 ? (
            wallets.map((w: any) => (
              <WalletCard key={w.id} wallet={w} accent={theme.accent} />
            ))
          ) : (
            <View style={s.noWallet}>
              <Ionicons name="wallet-outline" size={22} color={T.inkMuted} />
              <Text style={[s.noWalletTxt, { fontFamily: T.font.sans }]}>Aucun wallet créé</Text>
            </View>
          )}

          {/* ── Informations ── */}
          <View style={[s.card, T.shadow.card]}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans, color: T.inkSub }]}>INFORMATIONS</Text>
            </View>
            <InfoRow label="CODE AGENCE"       value={agency.code    ?? "N/A"} icon="qr-code-outline"  accent={theme.accent} />
            <InfoRow label="DEVISE PRINCIPALE" value={currency}               icon="cash-outline"      accent={theme.accent} />
            <InfoRow label="EMAIL"             value={agency.email   ?? "N/A"} icon="mail-outline"      accent={theme.accent} />
            <InfoRow label="TÉLÉPHONE"         value={agency.phone   ?? "N/A"} icon="call-outline"      accent={theme.accent} />
            <InfoRow label="VILLE"             value={agency.city    ?? "N/A"} icon="location-outline"  accent={theme.accent} />
            <InfoRow label="ADRESSE"           value={agency.address ?? "N/A"} icon="map-outline"       accent={theme.accent} />
            <InfoRow label="PAYS"              value={agency.country ?? "N/A"} icon="flag-outline"      accent={theme.accent} />
          </View>

          {/* ── Agents ── */}
          {Array.isArray(agency.agents) && agency.agents.length > 0 && (
            <View style={[s.card, T.shadow.card]}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.inkMuted }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans, color: T.inkSub }]}>
                  AGENTS ({agency.agents.length})
                </Text>
              </View>
              {agency.agents.map((agent: any) => (
                <View key={agent.id} style={s.agentRow}>
                  <View style={[s.agentAvatar, { backgroundColor: theme.accentSoft, borderColor: `${theme.accent}20`, borderWidth: 1 }]}>
                    <Text style={[s.agentAvatarTxt, { color: theme.accent, fontFamily: T.font.display }]}>
                      {(agent.firstName?.[0] ?? "A").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.agentName, { fontFamily: T.font.sans, color: T.ink }]}>
                      {agent.firstName} {agent.lastName}
                    </Text>
                    <Text style={[s.agentEmail, { fontFamily: T.font.sans, color: T.inkSub }]}>{agent.email}</Text>
                  </View>
                  <View style={[s.roleBadge, { borderColor: `${theme.accent}25`, backgroundColor: theme.accentSoft }]}>
                    <Text style={[s.roleBadgeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                      {agent.role}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Actions ── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans, color: T.inkSub }]}>ACTIONS</Text>
          </View>

          <View style={s.actionsRow}>
            <ActionBox
              icon="pencil-outline"
              label="Modifier"
              color={theme.accent}
              bg={theme.accentSoft}
              borderColor={`${theme.accent}25`}
              onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: agency.id } })}
              loading={false}
            />
            <ActionBox
              icon={isActive ? "pause-circle-outline" : "play-circle-outline"}
              label={isActive ? "Suspendre" : "Activer"}
              color={T.amber}
              bg={T.amberLt}
              borderColor={T.amberBorder}
              onPress={handleToggleStatus}
              loading={processing}
            />
            <ActionBox
              icon="trash-outline"
              label="Supprimer"
              color={T.red}
              bg={T.redLt}
              borderColor={T.redBorder}
              onPress={handleDelete}
              loading={false}
            />
          </View>

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  editBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  typePill: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  typeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  sectionRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot:   { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },

  noWallet: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 16, backgroundColor: T.surfaceAlt, borderRadius: T.radius.md,
    borderWidth: 1, borderColor: T.border, marginBottom: 14,
  },
  noWalletTxt: { color: T.inkSub, fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
  },

  agentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: T.borderLt,
  },
  agentAvatar: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },
  agentAvatarTxt: { fontSize: 16, fontWeight: "900" },
  agentName:      { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  agentEmail:     { fontSize: 11, fontWeight: "600" },
  roleBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  roleBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
});