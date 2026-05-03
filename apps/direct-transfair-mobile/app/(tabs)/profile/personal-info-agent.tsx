//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-agent.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-agent.tsx
// =========================================================
// PERSONAL INFO — AGENT v4.0
// Design: Forge & Ambre — accent #F59E0B
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
  g1: "#1A0E00", g2: "#211200",
  accent: "#F59E0B", accentSoft: "#FCD34D", accentGlow: "rgba(245,158,11,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#261800",
  white: "#FFFFFF", dim: "#A89070", red: "#EF4444",
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
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={{ fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6, fontFamily: T.font.sans }}>{label}</Text>
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

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setPhone(user.phone || ""); setCity(user.city || "");
    setCountry(user.country || ""); setAgencyName(user.agency?.name || user.agencyName || "");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), city, country });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("✅ Succès", "Profil agent mis à jour.");
    } catch { Alert.alert("Erreur", "Impossible de sauvegarder."); }
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
          <Text style={{ flex: 1, color: T.white, fontSize: 20, fontWeight: "700", fontFamily: T.font.display }}>Profil Agent</Text>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isEditing ? "rgba(239,68,68,0.12)" : T.accentGlow, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: isEditing ? "rgba(239,68,68,0.3)" : `${T.accent}30` }} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "pencil"} size={17} color={isEditing ? T.red : T.accent} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>IDENTITÉ</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="PRÉNOM" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} />
                <Field label="NOM" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} />
              </View>
              <Field label="TÉLÉPHONE (LECTURE SEULE)" value={phone} editable={false} keyboardType="phone-pad" />
              <Field label="AGENCE AFFECTÉE (LECTURE SEULE)" value={agencyName} editable={false} />
            </View>

            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>LOCALISATION</Text>
              <Field label="VILLE" value={city} onChange={setCity} editable={isEditing} />
              <Field label="PAYS" value={country} onChange={setCountry} editable={isEditing} />
            </View>

            {isEditing && (
              <TouchableOpacity style={{ borderRadius: T.radius.md, overflow: "hidden", marginBottom: 16 }} onPress={save} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={[T.accent, T.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 17, alignItems: "center" }}>
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