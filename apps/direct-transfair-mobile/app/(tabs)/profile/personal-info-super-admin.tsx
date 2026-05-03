//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-super-admin.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-super-admin.tsx
// =========================================================
// PERSONAL INFO — SUPER ADMIN v4.0
// Design: Obsidian Luxury — #0A0A0F → #12121A · accent Or
// =========================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

const T = {
  g1: "#0A0A0F", g2: "#12121A",
  accent: "#D4A853", accentSoft: "#F0C97A", accentGlow: "rgba(212,168,83,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#1C1C28",
  white: "#FFFFFF", dim: "#C4B89A", red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[fS.wrap, style]}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && fS.focused, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  box: { backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md },
  focused: { borderColor: `${T.accent}45` },
  disabled: { backgroundColor: T.ghost, opacity: 0.7 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
});

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

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || ""); setEmail(user.email || "");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), jobTitle: jobTitle.trim() });
      await refreshUser?.();
      setIsEditing(false);
      if (Platform.OS === "web") alert("Profil mis à jour"); else Alert.alert("✅ Succès", "Profil mis à jour.");
    } catch { Alert.alert("Erreur", "Impossible de sauvegarder"); }
    finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={T.white} /></TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Super Admin</Text>
          <TouchableOpacity style={[s.editBtn, { backgroundColor: isEditing ? "rgba(239,68,68,0.12)" : T.accentGlow, borderColor: isEditing ? "rgba(239,68,68,0.30)" : `${T.accent}30` }]} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "pencil"} size={17} color={isEditing ? T.red : T.accent} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              <View style={s.sectionRow}><View style={[s.dot, { backgroundColor: T.accent }]} /><Text style={[s.section, { fontFamily: T.font.sans }]}>INFORMATIONS</Text></View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="PRÉNOM" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} />
                <Field label="NOM" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} />
              </View>
              <Field label="FONCTION" value={jobTitle} onChange={setJobTitle} editable={isEditing} placeholder="PDG, Directeur…" />
              <Field label="EMAIL (LECTURE SEULE)" value={email} editable={false} />
            </View>
            {isEditing && (
              <TouchableOpacity style={[s.saveBtn, loading && { opacity: 0.65 }]} onPress={save} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={[T.accent, T.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveGrad}>
                  {loading ? <ActivityIndicator color={T.g1} /> : <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>}
                </LinearGradient>
              </TouchableOpacity>
            )}
            <View style={{ height: 80 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  headerTitle: { flex: 1, color: T.white, fontSize: 20, fontWeight: "700" },
  editBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  card: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: T.radius.lg, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  dot: { width: 5, height: 5, borderRadius: 99 },
  section: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },
  saveBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  saveGrad: { paddingVertical: 17, alignItems: "center" },
  saveTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});