//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
// =========================================================
// PERSONAL INFO — COMPANY ADMIN v4.0
// Design: Saphir Nuit — accent #34D399
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
  g1: "#030B1A", g2: "#071224",
  accent: "#34D399", accentSoft: "#6EE7B7", accentGlow: "rgba(52,211,153,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#0C1E30",
  white: "#FFFFFF", dim: "#8A9BB5", red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={{ fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6, fontFamily: T.font.sans }}>
        {label}
      </Text>
      <View style={{ backgroundColor: editable ? T.inkLight : T.ghost, borderWidth: 1, borderColor: focused ? `${T.accent}45` : T.inkBorder, borderRadius: T.radius.md }}>
        <TextInput
          value={value} onChangeText={onChange} editable={editable}
          placeholder={placeholder} placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          style={{ paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600", fontFamily: T.font.sans }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

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

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || ""); setAgencyName(user.agency?.name || user.agencyName || "");
    setCity(user.city || ""); setCountry(user.country || "");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), jobTitle, city, country });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("✅ Succès", "Profil mis à jour.");
    } catch { Alert.alert("Erreur", "Impossible de sauvegarder"); }
    finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14 }}>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder }} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: T.white, fontSize: 20, fontWeight: "700", fontFamily: T.font.display }}>Profil Administrateur</Text>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isEditing ? "rgba(239,68,68,0.12)" : T.accentGlow, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: isEditing ? "rgba(239,68,68,0.3)" : `${T.accent}30` }} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "pencil"} size={17} color={isEditing ? T.red : T.accent} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>IDENTITÉ & FONCTION</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="PRÉNOM" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} />
                <Field label="NOM" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} />
              </View>
              <Field label="FONCTION" value={jobTitle} onChange={setJobTitle} editable={isEditing} placeholder="Directeur Général…" />
              <Field label="SOCIÉTÉ (LECTURE SEULE)" value={agencyName} editable={false} />
            </View>

            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>LOCALISATION</Text>
              <Field label="VILLE" value={city} onChange={setCity} editable={isEditing} />
              <Field label="PAYS" value={country} onChange={setCountry} editable={isEditing} />
            </View>

            {isEditing && (
              <TouchableOpacity style={{ borderRadius: T.radius.md, overflow: "hidden", marginBottom: 16 }} onPress={save} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={[T.accent, T.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={{ color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1, fontFamily: T.font.sans }}>ENREGISTRER</Text>}
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