//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/details.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/details.tsx
// =========================================================
// AGENCY DETAILS — Direct Transf'air v4.0
// Design: Thème dynamique par rôle (Obsidian / Saphir / Forge / Émeraude)
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

// ─── Palettes par rôle ──────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", accentSoft: "rgba(212,168,83,0.15)", label: "SUPER ADMIN" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", accentSoft: "rgba(52,211,153,0.15)", label: "ADMIN SOCIÉTÉ" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", accentSoft: "rgba(245,158,11,0.15)", label: "AGENT" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981", accentSoft: "rgba(16,185,129,0.15)", label: "CLIENT" },
} as const;

const T = {
  inkBorder: "#2A2A3A",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  dimMuted: "#4A6070",
  red: "#EF4444",
  green: "#22C55E",
  amber: "#F59E0B",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
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
      <View style={[irS.iconBox, { backgroundColor: `${accent}12` }]}>
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
  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, gap: 14 },
  iconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: "700", color: T.white },
});

// ─── Wallet Card ─────────────────────────────────────────
function WalletCard({ wallet, accent }: { wallet: any; accent: string }) {
  const balance = toNum(wallet?.balance);
  const reserved = toNum(wallet?.reservedBalance ?? 0);
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;
  const currency = wallet?.currency ?? "XOF";

  return (
    <View style={wcS.card}>
      <View style={wcS.top}>
        <View style={[wcS.badge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
          <Text style={[wcS.badgeTxt, { color: accent, fontFamily: T.font.mono }]}>{currency}</Text>
        </View>
        {wallet?.isDefault && (
          <View style={wcS.defaultTag}>
            <Text style={[wcS.defaultTxt, { fontFamily: T.font.sans }]}>Principal</Text>
          </View>
        )}
      </View>
      <Text style={[wcS.amount, { color: T.white, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(balance, currency)}
      </Text>
      <Text style={[wcS.amtLabel, { color: accent, fontFamily: T.font.sans }]}>{currency}</Text>
      <View style={wcS.progBg}>
        <View style={[wcS.progFill, { width: `${pct}%` as any, backgroundColor: accent }]} />
      </View>
      <View style={wcS.footRow}>
        <View>
          <Text style={[wcS.footLabel, { fontFamily: T.font.sans }]}>Disponible</Text>
          <Text style={[wcS.footVal, { color: accent, fontFamily: T.font.mono }]}>{fmt(available, currency)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[wcS.footLabel, { fontFamily: T.font.sans }]}>Réservé</Text>
          <Text style={[wcS.footVal, { color: T.dim, fontFamily: T.font.mono }]}>{fmt(reserved, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
const wcS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, borderWidth: 1,
  },
  badgeTxt: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  defaultTag: {
    backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  defaultTxt: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.5 },
  amount: { fontSize: 28, letterSpacing: -0.5, marginBottom: 2 },
  amtLabel: { fontSize: 11, fontWeight: "800", marginBottom: 12 },
  progBg: { height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 12 },
  progFill: { height: 3, borderRadius: 99 },
  footRow: { flexDirection: "row", justifyContent: "space-between" },
  footLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, marginBottom: 2 },
  footVal: { fontSize: 12, fontWeight: "800" },
});

// ─── Action Box ───────────────────────────────────────────
function ActionBox({ icon, label, color, bg, onPress, loading }: any) {
  const scale = React.useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[axS.box, { backgroundColor: bg, borderColor: `${color}30` }]}
        onPress={onPress}
        disabled={loading}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
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
    paddingVertical: 18, borderRadius: T.radius.md, borderWidth: 1, gap: 8,
  },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgencyDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </LinearGradient>
    );
  }

  if (!agency) return null;

  const isActive = agency.isActive;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primaryWallet = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const currency = primaryWallet?.currency ?? agency.primaryCurrency ?? "XOF";

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1}>{agency.name}</Text>
          <TouchableOpacity
            style={[s.editBtn, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}30` }]}
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
          {/* Status badge */}
          <View style={s.statusRow}>
            <View style={[s.statusPill, { backgroundColor: isActive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", borderColor: isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)" }]}>
              <View style={[s.statusDot, { backgroundColor: isActive ? T.green : T.red }]} />
              <Text style={[s.statusTxt, { color: isActive ? T.green : T.red, fontFamily: T.font.sans }]}>
                {isActive ? "AGENCE ACTIVE" : "AGENCE SUSPENDUE"}
              </Text>
            </View>
            <View style={[s.typePill, { borderColor: `${theme.accent}30` }]}>
              <Text style={[s.typeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                {agency.type === "PARTNER" ? "PARTENAIRE" : "FILIALE"}
              </Text>
            </View>
          </View>

          {/* Wallets */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
              TRÉSORERIE · {currency}
            </Text>
          </View>

          {wallets.length > 0 ? (
            wallets.map((w: any) => (
              <WalletCard key={w.id} wallet={w} accent={theme.accent} />
            ))
          ) : (
            <View style={s.noWallet}>
              <Ionicons name="wallet-outline" size={24} color={T.dim} />
              <Text style={[s.noWalletTxt, { fontFamily: T.font.sans }]}>Aucun wallet créé</Text>
            </View>
          )}

          {/* Informations */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>INFORMATIONS</Text>
            </View>
            <InfoRow label="CODE AGENCE" value={agency.code ?? "N/A"} icon="qr-code-outline" accent={theme.accent} />
            <InfoRow label="DEVISE PRINCIPALE" value={currency} icon="cash-outline" accent={theme.accent} />
            <InfoRow label="EMAIL" value={agency.email ?? "N/A"} icon="mail-outline" accent={theme.accent} />
            <InfoRow label="TÉLÉPHONE" value={agency.phone ?? "N/A"} icon="call-outline" accent={theme.accent} />
            <InfoRow label="VILLE" value={agency.city ?? "N/A"} icon="location-outline" accent={theme.accent} />
            <InfoRow label="ADRESSE" value={agency.address ?? "N/A"} icon="map-outline" accent={theme.accent} />
            <InfoRow label="PAYS" value={agency.country ?? "N/A"} icon="flag-outline" accent={theme.accent} />
          </View>

          {/* Agents */}
          {Array.isArray(agency.agents) && agency.agents.length > 0 && (
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.dim }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>AGENTS ({agency.agents.length})</Text>
              </View>
              {agency.agents.map((agent: any) => (
                <View key={agent.id} style={s.agentRow}>
                  <View style={[s.agentAvatar, { backgroundColor: `${theme.accent}15` }]}>
                    <Text style={[s.agentAvatarTxt, { color: theme.accent, fontFamily: T.font.display }]}>
                      {(agent.firstName?.[0] ?? "A").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.agentName, { fontFamily: T.font.sans }]}>
                      {agent.firstName} {agent.lastName}
                    </Text>
                    <Text style={[s.agentEmail, { fontFamily: T.font.sans }]}>{agent.email}</Text>
                  </View>
                  <View style={[s.roleBadge, { borderColor: `${theme.accent}30` }]}>
                    <Text style={[s.roleBadgeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                      {agent.role}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ACTIONS</Text>
          </View>

          <View style={s.actionsRow}>
            <ActionBox
              icon="pencil-outline"
              label="Modifier"
              color={theme.accent}
              bg={`${theme.accent}10`}
              onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/edit", params: { id: agency.id } })}
              loading={false}
            />
            <ActionBox
              icon={isActive ? "pause-circle-outline" : "play-circle-outline"}
              label={isActive ? "Suspendre" : "Activer"}
              color={T.amber}
              bg="rgba(245,158,11,0.10)"
              onPress={handleToggleStatus}
              loading={processing}
            />
            <ActionBox
              icon="trash-outline"
              label="Supprimer"
              color={T.red}
              bg="rgba(239,68,68,0.10)"
              onPress={handleDelete}
              loading={false}
            />
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
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16,
    gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  headerTitle: { flex: 1, color: T.white, fontSize: 20, fontWeight: "700" },
  editBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  typePill: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
    backgroundColor: T.ghost,
  },
  typeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  noWallet: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 16, backgroundColor: T.ghost, borderRadius: T.radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14,
  },
  noWalletTxt: { color: T.dim, fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },

  agentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  agentAvatar: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },
  agentAvatarTxt: { fontSize: 16, fontWeight: "900" },
  agentName: { fontSize: 14, fontWeight: "700", color: T.white, marginBottom: 2 },
  agentEmail: { fontSize: 11, color: T.dim, fontWeight: "600" },
  roleBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
    backgroundColor: T.ghost,
  },
  roleBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
});