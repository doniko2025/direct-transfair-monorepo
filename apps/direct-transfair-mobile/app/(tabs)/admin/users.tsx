// apps/direct-transfair-mobile/app/(tabs)/admin/users.tsx
// =========================================================
// ADMIN USERS v5.0 — Direct Transf'air
// Design: Thème CLAIR par rôle, clean & aéré
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
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Thèmes clairs par rôle ────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { bg: "#FFFBF2", card: "#FFF8E7", accent: "#B8860B", accentLight: "#FFF3CD" },
  COMPANY_ADMIN: { bg: "#F0FDF8", card: "#E8FDF4", accent: "#059669", accentLight: "#D1FAE5" },
  AGENT:         { bg: "#FFFBF0", card: "#FFF8E6", accent: "#D97706", accentLight: "#FEF3C7" },
  USER:          { bg: "#F0FDF4", card: "#E8FDF0", accent: "#16A34A", accentLight: "#DCFCE7" },
} as const;

const ROLE_CONFIG = {
  SUPER_ADMIN:   { color: "#B8860B", bg: "#FEF3C7", label: "Super Admin" },
  COMPANY_ADMIN: { color: "#2563EB", bg: "#DBEAFE", label: "Admin Société" },
  AGENT:         { color: "#D97706", bg: "#FEF3C7", label: "Agent" },
  USER:          { color: "#16A34A", bg: "#DCFCE7", label: "Client" },
} as const;

const T = {
  white: "#FFFFFF",
  pageBackground: "#F4F6F9",
  cardBg: "#FFFFFF",
  border: "#E5E8EF",
  borderLight: "#EFF1F5",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  red: "#DC2626",
  redBg: "#FEE2E2",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── User Card ─────────────────────────────────────────────
function UserCard({ item, accent }: { item: any; accent: string }) {
  const roleCfg = ROLE_CONFIG[item.role as keyof typeof ROLE_CONFIG] ?? { color: T.textMuted, bg: T.borderLight, label: item.role };
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ucS.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[ucS.avatar, { backgroundColor: `${roleCfg.color}18` }]}>
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
            <View style={[ucS.rolePill, { backgroundColor: roleCfg.bg }]}>
              <Text style={[ucS.roleText, { color: roleCfg.color, fontFamily: T.font.sans }]}>{roleCfg.label}</Text>
            </View>
            {item.client?.name && (
              <View style={ucS.clientPill}>
                <Text style={[ucS.clientText, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.client.name}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[ucS.chevronBox, { backgroundColor: `${accent}15` }]}>
          <Ionicons name="chevron-forward" size={14} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ucS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.border, gap: 14,
    ...T.shadow,
  },
  avatar: { width: 46, height: 46, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 20, fontWeight: "700" },
  name: { color: T.text, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  email: { color: T.textSub, fontSize: 11, fontWeight: "500", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  clientPill: { backgroundColor: T.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  clientText: { color: T.textSub, fontSize: 10, fontWeight: "600" },
  chevronBox: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Form Field ────────────────────────────────────────────
function FormField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, autoCapitalize }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[ffS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TextInput
        style={[ffS.input, { fontFamily: T.font.sans }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={T.textMuted}
        keyboardType={keyboardType} secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}
const ffS = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", color: T.textSub, letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: T.pageBackground, borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: T.text, fontWeight: "500",
  },
});

// ─── Main Screen ───────────────────────────────────────────
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
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Utilisateurs</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {filtered.length} compte{filtered.length > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: theme.accentLight }]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={17} color={T.textMuted} />
          <TextInput
            style={[s.searchInput, { fontFamily: T.font.sans }]}
            value={q} onChangeText={setQ}
            placeholder="Nom, email..."
            placeholderTextColor={T.textMuted}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
              <Ionicons name="close" size={14} color={T.textSub} />
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
                <View style={[s.emptyIcon, { backgroundColor: T.borderLight }]}>
                  <Ionicons name="people-outline" size={30} color={T.textMuted} />
                </View>
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

                {/* Sheet Header */}
                <View style={s.sheetHeaderRow}>
                  <View style={[s.sheetIconBox, { backgroundColor: theme.accentLight }]}>
                    <Ionicons name="person-add-outline" size={21} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sheetTitle, { fontFamily: T.font.display }]}>Nouvel Utilisateur</Text>
                    <Text style={[s.sheetSub, { fontFamily: T.font.sans }]}>Accès immédiat à la plateforme</Text>
                  </View>
                  <TouchableOpacity style={s.closeBtn} onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={18} color={T.textSub} />
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
                  <FormField label="EMAIL" value={form.email} onChangeText={(v: string) => setForm({ ...form, email: v })} placeholder="user@societe.com" keyboardType="email-address" autoCapitalize="none" />
                  <FormField label="MOT DE PASSE" value={form.password} onChangeText={(v: string) => setForm({ ...form, password: v })} placeholder="Secret123!" secureTextEntry />
                  <FormField label="PAYS (ISO alpha-2)" value={form.country} onChangeText={(v: string) => setForm({ ...form, country: v })} placeholder="FR, GN, GB, SN..." autoCapitalize="characters" />

                  <Text style={[s.roleLabel, { fontFamily: T.font.sans }]}>RÔLE</Text>
                  <View style={s.roleRow}>
                    {AVAILABLE_ROLES.map((r) => {
                      const cfg = ROLE_CONFIG[r as keyof typeof ROLE_CONFIG] ?? { color: T.textSub, bg: T.borderLight, label: r };
                      const isActive = form.role === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            s.rolePill,
                            isActive
                              ? { backgroundColor: cfg.bg, borderColor: cfg.color }
                              : { backgroundColor: T.pageBackground, borderColor: T.border },
                          ]}
                          onPress={() => setForm({ ...form, role: r })}
                        >
                          {isActive && <View style={[s.roleDot, { backgroundColor: cfg.color }]} />}
                          <Text style={[s.rolePillTxt, { color: isActive ? cfg.color : T.textSub, fontFamily: T.font.sans }]}>
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
                      ? <ActivityIndicator color={T.white} />
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.cardBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  headerTitle: { color: T.text, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    justifyContent: "center", alignItems: "center",
  },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: T.cardBg, borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10,
    ...T.shadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.text, fontWeight: "500" },
  clearBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: T.borderLight, justifyContent: "center", alignItems: "center" },

  list: { paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  emptyTxt: { color: T.textSub, fontSize: 14, fontWeight: "600" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden", maxHeight: "92%",
    borderWidth: 1, borderColor: T.border,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", padding: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: T.borderLight },
  sheetIconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  sheetSub: { color: T.textSub, fontSize: 11, fontWeight: "500", marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.pageBackground, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  sheetBody: { padding: 20 },
  formRow: { flexDirection: "row", gap: 12 },
  roleLabel: { fontSize: 11, fontWeight: "700", color: T.textSub, letterSpacing: 0.5, marginBottom: 10 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: T.radius.md,
    borderWidth: 1.5,
  },
  roleDot: { width: 6, height: 6, borderRadius: 99 },
  rolePillTxt: { fontSize: 12, fontWeight: "700" },
  confirmBtn: { borderRadius: T.radius.md, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  confirmTxt: { color: T.white, fontWeight: "800", fontSize: 14, letterSpacing: 0.8 },
});