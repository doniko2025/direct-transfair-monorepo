//apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
// =========================================================
// ADMIN USERS v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle, dark premium
// ✅ Liste, recherche, création inline
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981" },
} as const;

const ROLE_CONFIG = {
  SUPER_ADMIN:   { color: "#D4A853", bg: "rgba(212,168,83,0.12)", label: "Super Admin" },
  COMPANY_ADMIN: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)", label: "Admin Société" },
  AGENT:         { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Agent" },
  USER:          { color: "#34D399", bg: "rgba(52,211,153,0.12)", label: "Client" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  inkBorder: "rgba(255,255,255,0.08)",
  red: "#EF4444",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function UserCard({ item, accent }: { item: any; accent: string }) {
  const roleCfg = ROLE_CONFIG[item.role as keyof typeof ROLE_CONFIG] ?? { color: T.dim, bg: T.ghost, label: item.role };
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ucS.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[ucS.avatar, { backgroundColor: `${roleCfg.color}15` }]}>
          <Text style={[ucS.avatarTxt, { color: roleCfg.color, fontFamily: T.font.display }]}>
            {(item.firstName?.[0] ?? "U").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[ucS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={[ucS.email, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.email}</Text>
          <View style={ucS.metaRow}>
            <View style={[ucS.rolePill, { backgroundColor: roleCfg.bg, borderColor: `${roleCfg.color}25` }]}>
              <Text style={[ucS.roleText, { color: roleCfg.color, fontFamily: T.font.sans }]}>{roleCfg.label}</Text>
            </View>
            {item.client?.name && (
              <View style={ucS.clientPill}>
                <Text style={[ucS.clientText, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.client.name}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[ucS.chevronBox, { backgroundColor: `${accent}10` }]}>
          <Ionicons name="chevron-forward" size={14} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ucS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.inkBorder, gap: 14,
  },
  avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 20, fontWeight: "900" },
  name: { color: T.white, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  email: { color: T.dim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
  },
  roleText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  clientPill: { backgroundColor: T.ghost, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  clientText: { color: T.dim, fontSize: 9, fontWeight: "700" },
  chevronBox: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Create Form Field ────────────────────────────────────
function FormField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, autoCapitalize }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[ffS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TextInput
        style={[ffS.input, { fontFamily: T.font.sans }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={T.dim + "60"}
        keyboardType={keyboardType} secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}
const ffS = StyleSheet.create({
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: T.white, fontWeight: "600",
  },
});

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "AGENT", country: "" });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsersList(Array.isArray(data) ? data : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { console.log("Erreur users"); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadUsers(); }, [loadUsers]));

  const filtered = usersList.filter((u) => {
    if (!q.trim()) return true;
    const search = q.toLowerCase();
    return `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search);
  });

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires."); return;
    }
    setCreating(true);
    try {
      await api.createUser(form);
      setModalVisible(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", role: "AGENT", country: "" });
      void loadUsers();
    } catch (e: any) {
      const msg = e.response?.data?.message || "La création a échoué.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setCreating(false); }
  };

  const AVAILABLE_ROLES = role === "SUPER_ADMIN"
    ? ["SUPER_ADMIN", "COMPANY_ADMIN", "AGENT"]
    : ["COMPANY_ADMIN", "AGENT"];

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Utilisateurs</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {filtered.length} compte{filtered.length > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}30` }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={T.dim} />
          <TextInput
            style={[s.searchInput, { fontFamily: T.font.sans }]}
            value={q} onChangeText={setQ}
            placeholder="Nom, email..."
            placeholderTextColor={T.dim + "60"}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
              <Ionicons name="close" size={14} color={T.dim} />
            </TouchableOpacity>
          )}
        </View>

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
            renderItem={({ item }) => <UserCard item={item} accent={theme.accent} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="people-outline" size={36} color={T.dim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucun utilisateur</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        )}

        {/* Modal création */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <View style={s.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%", maxHeight: "92%" }}>
              <View style={s.sheet}>
                <View style={s.sheetHandle} />
                <View style={s.sheetHeaderRow}>
                  <View style={[s.sheetIconBox, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}25` }]}>
                    <Ionicons name="person-add-outline" size={22} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sheetTitle, { fontFamily: T.font.display }]}>Nouvel Utilisateur</Text>
                    <Text style={[s.sheetSub, { fontFamily: T.font.sans }]}>Accès immédiat à la plateforme</Text>
                  </View>
                  <TouchableOpacity style={s.closeBtn} onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={18} color={T.dim} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
                  <View style={s.formRow}>
                    <View style={{ flex: 1 }}>
                      <FormField label="PRÉNOM" value={form.firstName} onChangeText={(v: string) => setForm({ ...form, firstName: v })} placeholder="Alpha" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="NOM" value={form.lastName} onChangeText={(v: string) => setForm({ ...form, lastName: v })} placeholder="DIALLO" />
                    </View>
                  </View>
                  <FormField label="EMAIL DE CONNEXION" value={form.email} onChangeText={(v: string) => setForm({ ...form, email: v })} placeholder="user@societe.com" keyboardType="email-address" autoCapitalize="none" />
                  <FormField label="MOT DE PASSE" value={form.password} onChangeText={(v: string) => setForm({ ...form, password: v })} placeholder="Secret123!" secureTextEntry />
                  <FormField label="PAYS (ISO alpha-2)" value={form.country} onChangeText={(v: string) => setForm({ ...form, country: v })} placeholder="FR, GN, GB, SN..." autoCapitalize="characters" />

                  <Text style={[s.roleLabel, { fontFamily: T.font.sans }]}>RÔLE</Text>
                  <View style={s.roleRow}>
                    {AVAILABLE_ROLES.map((r) => {
                      const cfg = ROLE_CONFIG[r as keyof typeof ROLE_CONFIG] ?? { color: T.dim, bg: T.ghost, label: r };
                      const isActive = form.role === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[s.rolePill, isActive && { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}30` }]}
                          onPress={() => setForm({ ...form, role: r })}
                        >
                          {isActive && <View style={[s.roleDot, { backgroundColor: cfg.color }]} />}
                          <Text style={[s.rolePillTxt, { color: isActive ? cfg.color : T.dim, fontFamily: T.font.sans }]}>
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[s.confirmBtn, { backgroundColor: theme.accent }, creating && { opacity: 0.7 }]}
                    onPress={handleCreate}
                    disabled={creating}
                  >
                    {creating
                      ? <ActivityIndicator color="#000" />
                      : <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>CRÉER L'UTILISATEUR</Text>
                    }
                  </TouchableOpacity>
                  <View style={{ height: 20 }} />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
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
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  clearBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: T.ghostMid, justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTxt: { color: T.dim, fontSize: 14, fontWeight: "700" },

  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C0C16", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden", maxHeight: "92%",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", padding: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  sheetIconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  sheetTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  sheetSub: { color: T.dim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder, justifyContent: "center", alignItems: "center" },
  sheetBody: { padding: 20 },
  formRow: { flexDirection: "row", gap: 12 },
  roleLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 10 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  roleDot: { width: 5, height: 5, borderRadius: 99 },
  rolePillTxt: { fontSize: 12, fontWeight: "800" },
  confirmBtn: { borderRadius: T.radius.md, paddingVertical: 17, alignItems: "center", marginTop: 4 },
  confirmTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});