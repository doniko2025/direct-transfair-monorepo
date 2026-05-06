// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
// =========================================================
// PERSONAL INFO — COMPANY ADMIN v5.0
// Design: Ciel & Menthe — thème 100% clair
// accent #0D9488 (teal) — fond #F0FDFA → #FFFFFF
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
  bg: "#F0FDFA",
  surface: "#FFFFFF",
  surfaceAlt: "#F0FDFA",
  border: "#CCFBF1",
  borderFocus: "#0D9488",
  accent: "#0D9488",
  accentSoft: "#CCFBF1",
  accentText: "#0F766E",
  text: "#0F172A",
  textSub: "#374151",
  textDim: "#9CA3AF",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
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
        {!editable && <Ionicons name="lock-closed" size={12} color={T.textDim} style={{ paddingRight: 12 }} />}
      </View>
    </View>
  );
}

const fS = StyleSheet.create({
  label: { fontSize: 10, fontWeight: "800", color: T.textSub, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  box: { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused: { borderColor: T.borderFocus, shadowColor: T.accent, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  boxDisabled: { backgroundColor: T.surfaceAlt },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600" },
  inputDisabled: { color: T.textSub },
});

// ─── Section Card ─────────────────────────────────────────
function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={sC.card}>
      <View style={sC.header}>
        <View style={sC.iconBox}>
          <Ionicons name={icon as any} size={14} color={T.accentText} />
        </View>
        <Text style={[sC.title, { fontFamily: T.font.sans }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sC = StyleSheet.create({
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoAdmin() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || "");
    setAgencyName(user.agency?.name || user.agencyName || "");
    setCity(user.city || "");
    setCountry(user.country || "");
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
    setCity(user.city || "");
    setCountry(user.country || "");
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Champs requis", "Prénom et nom sont obligatoires."); return;
    }
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), jobTitle, city, country });
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
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Administrateur</Text>
          <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>Informations de votre compte</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnCancel]}
          onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
        >
          <Ionicons name={isEditing ? "close" : "pencil"} size={16} color={isEditing ? T.red : T.accentText} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={s.avatarCard}>
            <View style={s.avatarCircle}>
              <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "CA"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { fontFamily: T.font.display }]}>
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
              </Text>
              {agencyName ? (
                <Text style={[s.agency, { fontFamily: T.font.sans }]}>{agencyName}</Text>
              ) : null}
              <View style={s.badge}>
                <Ionicons name="business-outline" size={10} color={T.accentText} />
                <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Administrateur</Text>
              </View>
            </View>
          </View>

          <SectionCard icon="person-outline" title="Identité & Fonction">
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
              <Field label="Nom" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} placeholder="Nom" />
            </View>
            <Field label="Fonction" value={jobTitle} onChange={setJobTitle} editable={isEditing} placeholder="Directeur Général…" />
            <Field label="Société" value={agencyName} editable={false} />
          </SectionCard>

          <SectionCard icon="location-outline" title="Localisation">
            <Field label="Ville" value={city} onChange={setCity} editable={isEditing} placeholder="Paris" />
            <Field label="Pays" value={country} onChange={setCountry} editable={isEditing} placeholder="France" />
          </SectionCard>

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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 12, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub: { color: T.textDim, fontSize: 12, marginTop: 1 },
  editBtn: { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  editBtnCancel: { backgroundColor: T.redSoft, borderColor: T.redBorder },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: T.borderFocus },
  avatarText: { fontSize: 20, fontWeight: "700", color: T.accentText },
  name: { fontSize: 17, fontWeight: "700", color: T.text },
  agency: { fontSize: 13, color: T.textSub, marginTop: 2, fontWeight: "500" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  badgeText: { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },
  saveBtn: { backgroundColor: T.accent, borderRadius: T.radius.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});