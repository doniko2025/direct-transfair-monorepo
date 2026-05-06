// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-super-admin.tsx
// =========================================================
// PERSONAL INFO — SUPER ADMIN v5.0
// Design: Ivory & Sapphire — thème 100% clair
// accent #1D4ED8 (bleu royal) — fond #F8FAFF → #EEF2FF
// =========================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, StatusBar, Animated, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg: "#F8FAFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5FE",
  border: "#DBEAFE",
  borderFocus: "#2563EB",
  accent: "#1D4ED8",
  accentSoft: "#EFF6FF",
  accentText: "#2563EB",
  text: "#0F172A",
  textSub: "#475569",
  textDim: "#94A3B8",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  success: "#059669",
  successSoft: "#ECFDF5",
  radius: { sm: 10, md: 14, lg: 20, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && fS.boxFocused, !editable && fS.boxDisabled]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={T.textDim}
          keyboardType={keyboardType}
          style={[fS.input, { fontFamily: T.font.sans }, !editable && fS.inputDisabled]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {!editable && (
          <View style={fS.lockBadge}>
            <Ionicons name="lock-closed" size={11} color={T.textDim} />
          </View>
        )}
      </View>
    </View>
  );
}

const fS = StyleSheet.create({
  label: { fontSize: 10, fontWeight: "800", color: T.textSub, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  box: { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused: { borderColor: T.borderFocus, shadowColor: T.accent, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
  boxDisabled: { backgroundColor: T.surfaceAlt, borderColor: T.border },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600" },
  inputDisabled: { color: T.textSub },
  lockBadge: { paddingRight: 12 },
});

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <View style={{ width: 30, height: 30, borderRadius: T.radius.sm, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon as any} size={15} color={T.accentText} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, fontFamily: T.font.sans }}>{title}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoSuperAdmin() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || "");
    setEmail(user.email || "");
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || "");
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Champs requis", "Prénom et nom sont obligatoires."); return;
    }
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), jobTitle: jobTitle.trim() });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("Succès", "Profil mis à jour avec succès.");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder les modifications.");
    } finally { setLoading(false); }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Super Admin</Text>
          <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>Gérez vos informations personnelles</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnActive]}
          onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
        >
          <Ionicons name={isEditing ? "close" : "pencil"} size={16} color={isEditing ? T.red : T.accentText} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar card */}
          <View style={s.avatarCard}>
            <View style={s.avatarCircle}>
              <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "SA"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.avatarName, { fontFamily: T.font.display }]}>
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
              </Text>
              <View style={s.roleBadge}>
                <Ionicons name="shield-checkmark" size={11} color={T.accentText} />
                <Text style={[s.roleText, { fontFamily: T.font.sans }]}>Super Administrateur</Text>
              </View>
            </View>
          </View>

          {/* Informations card */}
          <View style={s.card}>
            <SectionHeader icon="person-outline" title="INFORMATIONS PERSONNELLES" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
              <Field label="Nom" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} placeholder="Nom" />
            </View>
            <Field label="Fonction" value={jobTitle} onChange={setJobTitle} editable={isEditing} placeholder="PDG, Directeur Général…" />
            <Field label="Adresse email" value={email} editable={false} placeholder="—" />
          </View>

          {/* Save button */}
          {isEditing && (
            <TouchableOpacity
              style={[s.saveBtn, loading && { opacity: 0.6 }]}
              onPress={save}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.surface },
  backBtn: { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub: { color: T.textDim, fontSize: 12, marginTop: 1 },
  editBtn: { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  editBtnActive: { backgroundColor: T.redSoft, borderColor: T.redBorder },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 20, marginTop: 16, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: T.borderFocus },
  avatarText: { fontSize: 22, fontWeight: "700", color: T.accentText },
  avatarName: { fontSize: 18, fontWeight: "700", color: T.text },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  roleText: { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  saveBtn: { backgroundColor: T.accent, borderRadius: T.radius.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: T.accent, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4, marginTop: 4 },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});