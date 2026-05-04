// apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
// =========================================================
// SECURITY (Change Password) v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle
// ✅ Toast animé success/error, show/hide password
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", accentSoft: "#F0C97A" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", accentSoft: "#6EE7B7" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", accentSoft: "#FCD34D" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981", accentSoft: "#34D399" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "rgba(255,255,255,0.05)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  green: "#22C55E",
  red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Password Input ───────────────────────────────────────
function PasswordInput({ label, value, onChange, placeholder, accent }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; accent: string;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={piS.wrap}>
      <Text style={[piS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[piS.box, focused && { borderColor: `${accent}45` }]}>
        <View style={piS.iconBox}>
          <Ionicons name="lock-closed-outline" size={17} color={T.dim} />
        </View>
        <TextInput
          style={[piS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder ?? "••••••"}
          placeholderTextColor={T.dim + "55"}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity style={piS.eyeBtn} onPress={() => setShow(!show)}>
          <Ionicons name={show ? "eye-outline" : "eye-off-outline"} size={17} color={T.dim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const piS = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  box: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  iconBox: { paddingHorizontal: 14, paddingVertical: 14 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: T.white, fontWeight: "700" },
  eyeBtn: { padding: 14 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ title: "", message: "", type: "success" as "success" | "error" });
  const toastAnim = useRef(new Animated.Value(-120)).current;

  const showToast = (title: string, message: string, type: "success" | "error", onDone?: () => void) => {
    setToast({ title, message, type });
    Animated.spring(toastAnim, { toValue: Platform.OS === "android" ? 54 : 60, useNativeDriver: true, speed: 12 }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => {
        if (onDone) onDone();
      });
    }, 3000);
  };

  const handleSave = async () => {
    if (!oldPass.trim() || !newPass.trim() || !confirmPass.trim()) {
      showToast("Champs manquants", "Veuillez remplir tous les champs.", "error");
      return;
    }
    if (newPass.length < 6) {
      showToast("Sécurité", "Le nouveau code doit contenir au moins 6 caractères.", "error");
      return;
    }
    if (newPass !== confirmPass) {
      showToast("Erreur", "Les deux nouveaux codes ne correspondent pas.", "error");
      return;
    }
    if (newPass === oldPass) {
      showToast("Erreur", "Le nouveau code doit être différent de l'ancien.", "error");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword({ oldPassword: oldPass, newPassword: newPass });
      showToast("✅ Succès", "Votre code secret a été mis à jour.", "success", () => router.back());
    } catch (e: any) {
      const err = e?.response?.data?.message || e?.message || "Impossible de modifier le code.";
      showToast("Erreur", Array.isArray(err) ? err[0] : String(err), "error");
    } finally {
      setLoading(false);
      setOldPass(""); setNewPass(""); setConfirmPass("");
    }
  };

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Toast ── */}
        <Animated.View
          style={[
            s.toastWrap,
            { transform: [{ translateY: toastAnim }] },
          ]}
          pointerEvents="none"
        >
          <View style={[
            s.toastBox,
            { backgroundColor: toast.type === "success" ? T.green : T.red },
          ]}>
            <Ionicons
              name={toast.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={26} color={T.white}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.toastTitle, { fontFamily: T.font.sans }]}>{toast.title}</Text>
              <Text style={[s.toastMsg, { fontFamily: T.font.sans }]}>{toast.message}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12} disabled={loading}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Sécurité</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Icon hero */}
            <View style={[s.heroBox, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}25` }]}>
              <Ionicons name="shield-checkmark" size={44} color={theme.accent} />
            </View>

            <Text style={[s.title, { fontFamily: T.font.display }]}>Changer de code secret</Text>
            <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
              Renforcez la sécurité de votre compte en modifiant régulièrement votre mot de passe.
            </Text>

            {/* Formulaire */}
            <View style={s.card}>
              <PasswordInput
                label="ANCIEN CODE SECRET"
                value={oldPass}
                onChange={setOldPass}
                accent={theme.accent}
              />
              <PasswordInput
                label="NOUVEAU CODE SECRET"
                value={newPass}
                onChange={setNewPass}
                placeholder="Minimum 6 caractères"
                accent={theme.accent}
              />

              {/* Force indicateur */}
              {newPass.length > 0 && (
                <View style={s.strengthRow}>
                  <View style={[s.strengthBar, { backgroundColor: newPass.length < 6 ? T.red : newPass.length < 10 ? theme.accent : T.green }]} />
                  <Text style={[s.strengthTxt, { fontFamily: T.font.sans, color: newPass.length < 6 ? T.red : newPass.length < 10 ? theme.accent : T.green }]}>
                    {newPass.length < 6 ? "Trop court" : newPass.length < 10 ? "Acceptable" : "Fort ✓"}
                  </Text>
                </View>
              )}

              <PasswordInput
                label="CONFIRMER LE NOUVEAU CODE"
                value={confirmPass}
                onChange={setConfirmPass}
                placeholder="Répétez le nouveau code"
                accent={theme.accent}
              />

              {/* Indicateur correspondance */}
              {confirmPass.length > 0 && newPass.length > 0 && (
                <View style={[s.matchRow, { backgroundColor: newPass === confirmPass ? `${T.green}12` : `${T.red}12`, borderColor: newPass === confirmPass ? `${T.green}25` : `${T.red}25` }]}>
                  <Ionicons
                    name={newPass === confirmPass ? "checkmark-circle-outline" : "close-circle-outline"}
                    size={14}
                    color={newPass === confirmPass ? T.green : T.red}
                  />
                  <Text style={[s.matchTxt, { color: newPass === confirmPass ? T.green : T.red, fontFamily: T.font.sans }]}>
                    {newPass === confirmPass ? "Les codes correspondent" : "Les codes ne correspondent pas"}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.saveBtn, loading && { opacity: 0.65 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[theme.accent, theme.accentSoft]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.saveGrad}
                >
                  {loading
                    ? <ActivityIndicator color={theme.g1} />
                    : <Text style={[s.saveTxt, { color: theme.g1, fontFamily: T.font.sans }]}>
                        METTRE À JOUR LE CODE
                      </Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={{ height: 110 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  toastWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999, paddingHorizontal: 20 },
  toastBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  toastTitle: { color: T.white, fontSize: 14, fontWeight: "800" },
  toastMsg: { color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "600", marginTop: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, alignItems: "center" },

  heroBox: { width: 80, height: 80, borderRadius: 24, justifyContent: "center", alignItems: "center", borderWidth: 1, marginBottom: 18 },
  title: { color: T.white, fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { color: T.dim, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19, marginBottom: 28, paddingHorizontal: 20 },

  card: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 20, borderWidth: 1, borderColor: T.inkBorder, width: "100%", maxWidth: 480 },

  strengthRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  strengthBar: { flex: 1, height: 3, borderRadius: 99 },
  strengthTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  matchRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, marginBottom: 14,
  },
  matchTxt: { fontSize: 11, fontWeight: "700" },

  saveBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 4 },
  saveGrad: { paddingVertical: 17, alignItems: "center" },
  saveTxt: { fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});