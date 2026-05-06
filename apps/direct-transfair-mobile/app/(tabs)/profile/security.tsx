// apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
// =========================================================
// SECURITY v5.0 — Direct Transf'air
// Design: Thème CLAIR par rôle, clean & aéré
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
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

const ROLE_THEMES = {
  SUPER_ADMIN:   { bg: "#FFFBF2", accent: "#B8860B", accentLight: "#FEF3C7", accentMid: "#D4A853" },
  COMPANY_ADMIN: { bg: "#F0FDF8", accent: "#059669", accentLight: "#D1FAE5", accentMid: "#34D399" },
  AGENT:         { bg: "#FFFBF0", accent: "#D97706", accentLight: "#FEF3C7", accentMid: "#FBBF24" },
  USER:          { bg: "#F0FDF4", accent: "#16A34A", accentLight: "#DCFCE7", accentMid: "#4ADE80" },
} as const;

const T = {
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#E5E8EF",
  borderLight: "#EFF1F5",
  pageBackground: "#F4F6F9",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  red: "#DC2626",
  redBg: "#FEF2F2",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  radius: { md: 12, lg: 16, xl: 20 },
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
      <View style={[piS.box, focused && { borderColor: accent, borderWidth: 1.5 }]}>
        <View style={piS.iconBox}>
          <Ionicons name="lock-closed-outline" size={17} color={focused ? accent : T.textMuted} />
        </View>
        <TextInput
          style={[piS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder ?? "••••••"}
          placeholderTextColor={T.textMuted}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity style={piS.eyeBtn} onPress={() => setShow(!show)}>
          <Ionicons name={show ? "eye-outline" : "eye-off-outline"} size={17} color={T.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const piS = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "700", color: T.textSub, letterSpacing: 0.5, marginBottom: 6 },
  box: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.pageBackground, borderWidth: 1, borderColor: T.border,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  iconBox: { paddingHorizontal: 14, paddingVertical: 14 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: T.text, fontWeight: "600" },
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
      showToast("Champs manquants", "Veuillez remplir tous les champs.", "error"); return;
    }
    if (newPass.length < 6) {
      showToast("Sécurité", "Le nouveau code doit contenir au moins 6 caractères.", "error"); return;
    }
    if (newPass !== confirmPass) {
      showToast("Erreur", "Les deux nouveaux codes ne correspondent pas.", "error"); return;
    }
    if (newPass === oldPass) {
      showToast("Erreur", "Le nouveau code doit être différent de l'ancien.", "error"); return;
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

  // Strength
  const strengthLevel = newPass.length === 0 ? null : newPass.length < 6 ? "weak" : newPass.length < 10 ? "medium" : "strong";
  const strengthColor = strengthLevel === "weak" ? T.red : strengthLevel === "medium" ? T.amber : T.green;
  const strengthLabel = strengthLevel === "weak" ? "Trop court" : strengthLevel === "medium" ? "Acceptable" : "Fort ✓";

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* Toast */}
        <Animated.View style={[s.toastWrap, { transform: [{ translateY: toastAnim }] }]} pointerEvents="none">
          <View style={[
            s.toastBox,
            { backgroundColor: toast.type === "success" ? T.green : T.red },
          ]}>
            <Ionicons
              name={toast.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={24} color={T.white}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.toastTitle, { fontFamily: T.font.sans }]}>{toast.title}</Text>
              <Text style={[s.toastMsg, { fontFamily: T.font.sans }]}>{toast.message}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Sécurité</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Hero */}
            <View style={[s.heroBox, { backgroundColor: theme.accentLight }]}>
              <Ionicons name="shield-checkmark" size={40} color={theme.accent} />
            </View>

            <Text style={[s.title, { fontFamily: T.font.display }]}>Changer de code secret</Text>
            <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
              Renforcez la sécurité de votre compte en modifiant régulièrement votre mot de passe.
            </Text>

            {/* Formulaire */}
            <View style={s.card}>
              <PasswordInput label="ANCIEN CODE SECRET" value={oldPass} onChange={setOldPass} accent={theme.accent} />
              <PasswordInput label="NOUVEAU CODE SECRET" value={newPass} onChange={setNewPass} placeholder="Minimum 6 caractères" accent={theme.accent} />

              {/* Strength bar */}
              {newPass.length > 0 && (
                <View style={s.strengthRow}>
                  <View style={s.strengthTrack}>
                    <View style={[s.strengthFill, {
                      width: strengthLevel === "weak" ? "30%" : strengthLevel === "medium" ? "65%" : "100%",
                      backgroundColor: strengthColor,
                    }]} />
                  </View>
                  <Text style={[s.strengthTxt, { color: strengthColor, fontFamily: T.font.sans }]}>{strengthLabel}</Text>
                </View>
              )}

              <PasswordInput label="CONFIRMER LE NOUVEAU CODE" value={confirmPass} onChange={setConfirmPass} placeholder="Répétez le nouveau code" accent={theme.accent} />

              {/* Match indicator */}
              {confirmPass.length > 0 && newPass.length > 0 && (
                <View style={[s.matchRow, {
                  backgroundColor: newPass === confirmPass ? T.greenBg : T.redBg,
                  borderColor: newPass === confirmPass ? "#BBF7D0" : "#FECACA",
                }]}>
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

              {/* Submit */}
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.accent }, loading && { opacity: 0.65 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={T.white} />
                  : <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>METTRE À JOUR LE CODE</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={{ height: 110 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  toastWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 9999, paddingHorizontal: 20 },
  toastBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  toastTitle: { color: T.white, fontSize: 14, fontWeight: "800" },
  toastMsg: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "500", marginTop: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.cardBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  headerTitle: { color: T.text, fontSize: 20, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, alignItems: "center" },

  heroBox: { width: 80, height: 80, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title: { color: T.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { color: T.textSub, fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19, marginBottom: 28, paddingHorizontal: 20 },

  card: {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 20, borderWidth: 1, borderColor: T.border,
    width: "100%", maxWidth: 480,
    ...T.shadow,
  },

  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: T.borderLight, borderRadius: 99, overflow: "hidden" },
  strengthFill: { height: 4, borderRadius: 99 },
  strengthTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, minWidth: 60 },

  matchRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, marginBottom: 14,
  },
  matchTxt: { fontSize: 11, fontWeight: "700" },

  saveBtn: { borderRadius: T.radius.md, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  saveTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
});