//apps/direct-transfair-mobile/app/(tabs)/admin/agencies/agents.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/agents.tsx
// =========================================================
// AGENCY AGENTS v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle — dark premium
// ✅ Liste agents d'une agence avec stats & actions
// ✅ Wallets v4 — primaryCurrency
// =========================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Platform, StatusBar,
  Alert, Animated, Modal, TextInput, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

// ─── Tokens ─────────────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", accentGlow: "rgba(212,168,83,0.15)" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", accentGlow: "rgba(52,211,153,0.15)" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", accentGlow: "rgba(245,158,11,0.15)" },
} as const;

const T = {
  ghost:     "rgba(255,255,255,0.06)",
  ghostMid:  "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight:  "#1C1C28",
  white:     "#FFFFFF",
  dim:       "#8A9BB5",
  green:     "#22C55E",
  red:       "#EF4444",
  amber:     "#F59E0B",
  blue:      "#60A5FA",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  SUPER_ADMIN:   { color: "#D4A853", bg: "rgba(212,168,83,0.12)" },
  COMPANY_ADMIN: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  AGENT:         { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  USER:          { color: "#34D399", bg: "rgba(52,211,153,0.12)" },
};

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

// ─── Agent Card ───────────────────────────────────────────
function AgentCard({
  agent, accent, accentGlow, currency, onSuspend,
}: {
  agent: any; accent: string; accentGlow: string; currency: string; onSuspend?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const roleCfg = ROLE_COLORS[agent.role] ?? { color: T.dim, bg: T.ghost };
  const isActive = agent.isActive !== false;
  const initials = `${(agent.firstName?.[0] ?? "A").toUpperCase()}${(agent.lastName?.[0] ?? "G").toUpperCase()}`;

  const wallets = Array.isArray(agent.wallets) ? agent.wallets : [];
  const primaryWallet = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance = toNum(primaryWallet?.balance ?? agent.balance ?? 0);
  const agentCurrency = primaryWallet?.currency ?? agent.primaryCurrency ?? currency;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={acS.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Avatar */}
        <View style={[acS.avatarWrap, { backgroundColor: accentGlow }]}>
          <Text style={[acS.initials, { color: accent, fontFamily: T.font.display }]}>{initials}</Text>
          <View style={[acS.statusDot, { backgroundColor: isActive ? T.green : T.red }]} />
        </View>

        {/* Infos */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[acS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {agent.firstName} {agent.lastName}
          </Text>
          <Text style={[acS.email, { fontFamily: T.font.sans }]} numberOfLines={1}>{agent.email}</Text>

          <View style={acS.metaRow}>
            <View style={[acS.rolePill, { backgroundColor: roleCfg.bg, borderColor: `${roleCfg.color}25` }]}>
              <Text style={[acS.roleText, { color: roleCfg.color, fontFamily: T.font.sans }]}>
                {(agent.role ?? "AGENT").replace("_", " ")}
              </Text>
            </View>

            {balance > 0 && (
              <View style={acS.balancePill}>
                <Ionicons name="wallet-outline" size={9} color={accent} />
                <Text style={[acS.balanceTxt, { color: accent, fontFamily: T.font.mono }]}>
                  {fmt(balance, agentCurrency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions rapides */}
        {onSuspend && (
          <TouchableOpacity
            style={[acS.quickBtn, { backgroundColor: isActive ? "rgba(245,158,11,0.10)" : "rgba(34,197,94,0.10)" }]}
            onPress={onSuspend}
          >
            <Ionicons
              name={isActive ? "pause-circle-outline" : "play-circle-outline"}
              size={20}
              color={isActive ? T.amber : T.green}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const acS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.inkBorder, gap: 14,
  },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  initials: { fontSize: 17, fontWeight: "900" },
  statusDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 99,
    borderWidth: 2, borderColor: "#0C0C16",
  },
  name: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  email: { color: T.dim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rolePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.ghost, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
  },
  balanceTxt: { fontSize: 10, fontWeight: "800" },
  quickBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});

// ─── Add Agent Modal ──────────────────────────────────────
function AddAgentModal({
  visible, onClose, onSuccess, agencyId, accent,
}: {
  visible: boolean; onClose: () => void; onSuccess: () => void; agencyId: string; accent: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => { setFirstName(""); setLastName(""); setEmail(""); setPassword(""); };

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires."); return;
    }
    setCreating(true);
    try {
      await api.createUser({ firstName, lastName, email, password, role: "AGENT", agencyId });
      Alert.alert("✅ Agent ajouté", `${firstName} ${lastName} peut maintenant se connecter.`);
      reset(); onSuccess(); onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Création impossible.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={amS.overlay}>
        <View style={amS.sheet}>
          <View style={amS.handle} />
          <View style={amS.headerRow}>
            <View style={[amS.iconBox, { backgroundColor: `${accent}15`, borderColor: `${accent}25` }]}>
              <Ionicons name="person-add-outline" size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[amS.title, { fontFamily: T.font.display }]}>Ajouter un Agent</Text>
              <Text style={[amS.sub, { fontFamily: T.font.sans }]}>Accès immédiat à cette agence</Text>
            </View>
            <TouchableOpacity style={amS.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={amS.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[amS.fieldLabel, { fontFamily: T.font.sans }]}>PRÉNOM</Text>
                <TextInput style={[amS.input, { fontFamily: T.font.sans }]} value={firstName} onChangeText={setFirstName} placeholder="Alpha" placeholderTextColor={T.dim + "60"} editable={!creating} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[amS.fieldLabel, { fontFamily: T.font.sans }]}>NOM</Text>
                <TextInput style={[amS.input, { fontFamily: T.font.sans }]} value={lastName} onChangeText={setLastName} placeholder="DIALLO" placeholderTextColor={T.dim + "60"} editable={!creating} />
              </View>
            </View>
            <Text style={[amS.fieldLabel, { fontFamily: T.font.sans }]}>EMAIL DE CONNEXION</Text>
            <TextInput style={[amS.input, { fontFamily: T.font.sans }]} value={email} onChangeText={setEmail} placeholder="agent@agence.com" placeholderTextColor={T.dim + "60"} keyboardType="email-address" autoCapitalize="none" editable={!creating} />
            <Text style={[amS.fieldLabel, { fontFamily: T.font.sans }]}>MOT DE PASSE</Text>
            <TextInput style={[amS.input, { fontFamily: T.font.sans }]} value={password} onChangeText={setPassword} placeholder="Secret123!" placeholderTextColor={T.dim + "60"} secureTextEntry editable={!creating} />

            <TouchableOpacity
              style={[amS.confirmBtn, { backgroundColor: accent }, creating && { opacity: 0.65 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#000" />
                : <Text style={[amS.confirmTxt, { fontFamily: T.font.sans }]}>CRÉER L'AGENT</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const amS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C0C16", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "80%", borderWidth: 1, borderColor: T.inkBorder,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", padding: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  title: { color: T.white, fontSize: 17, fontWeight: "700" },
  sub: { color: T.dim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" },
  body: { padding: 20 },
  fieldLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: T.white, fontWeight: "600",
  },
  confirmBtn: { borderRadius: T.radius.md, paddingVertical: 17, alignItems: "center", marginTop: 20 },
  confirmTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgencyAgentsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [agents, setAgents] = useState<any[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [q, setQ] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchAgents = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getAgency(id as string);
      setAgencyName(data.name ?? "");
      const agentCurrency =
        (Array.isArray(data.wallets) && data.wallets.find((w: any) => w.isDefault)?.currency) ??
        data.primaryCurrency ??
        data.currency ??
        "XOF";
      setCurrency(agentCurrency);
      setAgents(Array.isArray(data.agents) ? data.agents : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const handleSuspend = (agent: any) => {
    const next = !agent.isActive;
    const label = next ? "activer" : "suspendre";
    Alert.alert(
      `${next ? "Activer" : "Suspendre"} l'agent`,
      `Voulez-vous ${label} ${agent.firstName} ${agent.lastName} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "OUI",
          onPress: async () => {
            setProcessing(true);
            try {
              await api.updateUser?.(agent.id, { isActive: next });
              setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, isActive: next } : a));
            } catch {
              Alert.alert("Erreur", "Impossible de modifier le statut.");
            } finally { setProcessing(false); }
          },
        },
      ],
    );
  };

  const filtered = agents.filter((a) => {
    if (!q.trim()) return true;
    const search = q.toLowerCase();
    return `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(search);
  });

  const activeCount = agents.filter((a) => a.isActive !== false).length;

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]} numberOfLines={1}>
              {agencyName || "Agents"}
            </Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {activeCount} actif{activeCount > 1 ? "s" : ""} · {agents.length} total
            </Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}30` }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Stats row ── */}
        {!loading && agents.length > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statBox, { borderColor: `${theme.accent}20` }]}>
              <Text style={[s.statVal, { color: theme.accent, fontFamily: T.font.display }]}>{agents.length}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>Total</Text>
            </View>
            <View style={[s.statBox, { borderColor: "rgba(34,197,94,0.2)" }]}>
              <Text style={[s.statVal, { color: T.green, fontFamily: T.font.display }]}>{activeCount}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>Actifs</Text>
            </View>
            <View style={[s.statBox, { borderColor: "rgba(239,68,68,0.2)" }]}>
              <Text style={[s.statVal, { color: T.red, fontFamily: T.font.display }]}>{agents.length - activeCount}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>Suspendus</Text>
            </View>
          </View>
        )}

        {/* ── Search ── */}
        {agents.length > 0 && (
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color={T.dim} />
            <TextInput
              style={[s.searchInput, { fontFamily: T.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Nom, email…"
              placeholderTextColor={T.dim + "60"}
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                <Ionicons name="close" size={14} color={T.dim} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <Animated.FlatList
            style={{ opacity: fadeAnim }}
            data={filtered}
            keyExtractor={(item) => item.id?.toString()}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <AgentCard
                agent={item}
                accent={theme.accent}
                accentGlow={theme.accentGlow}
                currency={currency}
                onSuspend={() => handleSuspend(item)}
              />
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIconBox, { borderColor: `${theme.accent}20` }]}>
                  <Ionicons name="people-outline" size={36} color={T.dim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                  {q ? "Aucun résultat" : "Aucun agent"}
                </Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                  {q ? "Modifiez la recherche" : "Ajoutez le premier agent de cette agence"}
                </Text>
                {!q && (
                  <TouchableOpacity
                    style={[s.addEmptyBtn, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30` }]}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Ionicons name="person-add-outline" size={16} color={theme.accent} />
                    <Text style={[s.addEmptyTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                      Ajouter un Agent
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        )}

        {/* Add Agent Modal */}
        <AddAgentModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchAgents}
          agencyId={id as string}
          accent={theme.accent}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },

  statsRow: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: T.ghost, borderRadius: T.radius.md, padding: 12,
    alignItems: "center", borderWidth: 1,
  },
  statVal: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8 },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 44, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  clearBtn: { width: 24, height: 24, borderRadius: 7, backgroundColor: T.ghostMid, justifyContent: "center", alignItems: "center" },

  list: { paddingHorizontal: 20 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center", borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  emptySub: { color: T.dim, fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 20 },
  addEmptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: T.radius.md, borderWidth: 1, marginTop: 8,
  },
  addEmptyTxt: { fontSize: 13, fontWeight: "800" },
});