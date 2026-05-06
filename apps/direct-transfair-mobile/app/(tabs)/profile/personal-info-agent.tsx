// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-agent.tsx
// =========================================================
// PERSONAL INFO — AGENT v5.0
// Design: Soleil & Sable — thème 100% clair
// accent #D97706 (ambre chaud) — fond #FFFBEB → #FFFFFF
// =========================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg: "#FFFBEB",
  surface: "#FFFFFF",
  surfaceAlt: "#FEF3C7",
  border: "#FDE68A",
  borderFocus: "#D97706",
  accent: "#D97706",
  accentSoft: "#FEF3C7",
  accentText: "#B45309",
  text: "#1C1917",
  textSub: "#57534E",
  textDim: "#A8A29E",
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

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoAgent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setCity(user.city || "");
    setCountry(user.country || "");
    setAgencyName(user.agency?.name || user.agencyName || "");
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
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
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), city, country });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("Succès", "Profil agent mis à jour.");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
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
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Agent</Text>
          <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>Vos informations personnelles</Text>
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
          {/* Avatar card */}
          <View style={s.avatarCard}>
            <View style={s.avatarCircle}>
              <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "AG"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { fontFamily: T.font.display }]}>
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
              </Text>
              {agencyName ? (
                <Text style={[s.agency, { fontFamily: T.font.sans }]}>{agencyName}</Text>
              ) : null}
              <View style={s.badge}>
                <Ionicons name="briefcase-outline" size={10} color={T.accentText} />
                <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Agent</Text>
              </View>
            </View>
          </View>

          {/* Identité card */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.iconBox}><Ionicons name="person-outline" size={14} color={T.accentText} /></View>
              <Text style={[s.sectionTitle, { fontFamily: T.font.sans }]}>IDENTITÉ</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
              <Field label="Nom" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} placeholder="Nom" />
            </View>
            <Field label="Téléphone" value={phone} editable={false} keyboardType="phone-pad" placeholder="—" />
            <Field label="Agence affectée" value={agencyName} editable={false} placeholder="—" />
          </View>

          {/* Localisation card */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.iconBox}><Ionicons name="location-outline" size={14} color={T.accentText} /></View>
              <Text style={[s.sectionTitle, { fontFamily: T.font.sans }]}>LOCALISATION</Text>
            </View>
            <Field label="Ville" value={city} onChange={setCity} editable={isEditing} placeholder="Paris" />
            <Field label="Pays" value={country} onChange={setCountry} editable={isEditing} placeholder="France" />
          </View>

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
  card: { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5 },
  saveBtn: { backgroundColor: T.accent, borderRadius: T.radius.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});