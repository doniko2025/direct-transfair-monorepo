// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-wallet.tsx
// =========================================================
// PERSONAL INFO — CLIENT (WALLET) v4.0
// Design: Émeraude Profond — accent #10B981
// ✅ Formulaire complet KYC : identité + état civil + adresse
// =========================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Modal, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { COUNTRIES } from "../../../utils/countries";

const T = {
  g1: "#0B1F14", g2: "#0F2A1C",
  accent: "#10B981", accentSoft: "#34D399", accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#1C2820",
  white: "#FFFFFF", dim: "#7B9E8A", red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType, maxLength }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={{ fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6, fontFamily: T.font.sans }}>{label}</Text>
      <View style={{ backgroundColor: editable ? T.inkLight : T.ghost, borderWidth: 1, borderColor: focused ? `${T.accent}45` : T.inkBorder, borderRadius: T.radius.md }}>
        <TextInput
          value={value} onChangeText={onChange} editable={editable}
          placeholder={placeholder} placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType} maxLength={maxLength}
          style={{ paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600", fontFamily: T.font.sans }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Country Picker ───────────────────────────────────────
function CountryPicker({ label, value, onChange, editable }: any) {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q.trim() ? COUNTRIES.filter((c: string) => c.toLowerCase().includes(q.toLowerCase())) : COUNTRIES;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6, fontFamily: T.font.sans }}>{label}</Text>
      <TouchableOpacity
        style={{ backgroundColor: editable ? T.inkLight : T.ghost, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center" }}
        onPress={() => editable && setVisible(true)}
        activeOpacity={editable ? 0.8 : 1}
      >
        <Text style={{ flex: 1, fontSize: 14, color: value ? T.white : T.dim + "55", fontWeight: "600", fontFamily: T.font.sans }}>{value || "Sélectionner…"}</Text>
        {editable && <Ionicons name="chevron-down" size={14} color={T.accent} />}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: T.g1, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "70%", borderWidth: 1, borderColor: T.inkBorder }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.inkBorder }}>
              <Text style={{ color: T.white, fontSize: 17, fontWeight: "700", fontFamily: T.font.display }}>Pays</Text>
              <TouchableOpacity style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" }} onPress={() => setVisible(false)}>
                <Ionicons name="close" size={17} color={T.dim} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", margin: 16, gap: 8, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md, paddingHorizontal: 12, height: 40 }}>
              <Ionicons name="search" size={14} color={T.dim} />
              <TextInput style={{ flex: 1, color: T.white, fontSize: 13, fontWeight: "600", fontFamily: T.font.sans }} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={T.dim + "55"} autoFocus />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder }}
                  onPress={() => { onChange(item); setVisible(false); setQ(""); }}
                >
                  <Text style={{ color: T.white, fontSize: 14, fontWeight: "600", fontFamily: T.font.sans }}>{item}</Text>
                  {value === item && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoWallet() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const formatDate = (iso: string) => {
    if (!iso) return "";
    if (iso.includes("T") || iso.includes("-")) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
    return iso;
  };

  const handleDateChange = (text: string) => {
    let c = text.replace(/\D/g, "");
    if (c.length > 4) c = `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
    else if (c.length > 2) c = `${c.slice(0, 2)}/${c.slice(2, 4)}`;
    setBirthDate(c);
  };

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setPhone(user.phone || ""); setEmail(user.email || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace || ""); setNationality(user.nationality || "");
    setAddress(user.addressStreet || ""); setPostalCode(user.postalCode || "");
    setCity(user.city || ""); setCountry(user.country || "");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setPhone(user.phone || ""); setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace || ""); setNationality(user.nationality || "");
    setAddress(user.addressStreet || ""); setPostalCode(user.postalCode || "");
    setCity(user.city || ""); setCountry(user.country || "");
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !city.trim() || !country.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires."); return;
    }
    if (birthDate.length > 0 && birthDate.length !== 10) {
      Alert.alert("Erreur", "La date doit être au format JJ/MM/AAAA."); return;
    }
    try {
      setLoading(true);
      const parsedDate = birthDate.length === 10
        ? (() => { const p = birthDate.split("/"); return `${p[2]}-${p[1]}-${p[0]}T00:00:00.000Z`; })()
        : undefined;
      await api.updateProfile({
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
        birthDate: parsedDate, birthPlace: birthPlace.trim(),
        nationality, addressStreet: address.trim(), postalCode: postalCode.trim(),
        city: city.trim(), country,
      });
      await refreshUser();
      setIsEditing(false);
      Alert.alert("✅ Succès", "Informations mises à jour.");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible d'enregistrer.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14 }}>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder }} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: T.white, fontSize: 20, fontWeight: "700", fontFamily: T.font.display }}>Mes Informations</Text>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isEditing ? "rgba(239,68,68,0.12)" : T.accentGlow, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: isEditing ? "rgba(239,68,68,0.3)" : `${T.accent}30` }} onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}>
            <Ionicons name={isEditing ? "close" : "pencil"} size={17} color={isEditing ? T.red : T.accent} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {!isEditing && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.accentGlow, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: `${T.accent}20`, marginBottom: 16 }}>
                <Ionicons name="information-circle-outline" size={16} color={T.accent} />
                <Text style={{ flex: 1, color: T.accent, fontSize: 12, fontWeight: "600", fontFamily: T.font.sans, lineHeight: 17 }}>
                  Appuyez sur le crayon en haut pour modifier vos informations.
                </Text>
              </View>
            )}

            {/* Identité */}
            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>IDENTITÉ</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="PRÉNOM *" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} />
                <Field label="NOM *" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} />
              </View>
              <Field label="TÉLÉPHONE *" value={phone} onChange={setPhone} editable={isEditing} keyboardType="phone-pad" />
              <Field label="EMAIL (LECTURE SEULE)" value={email} editable={false} />
            </View>

            {/* État civil */}
            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>ÉTAT CIVIL</Text>
              <Field label="DATE DE NAISSANCE (JJ/MM/AAAA)" value={birthDate} onChange={handleDateChange} editable={isEditing} keyboardType="numeric" maxLength={10} placeholder="15/06/1990" />
              <Field label="LIEU DE NAISSANCE" value={birthPlace} onChange={setBirthPlace} editable={isEditing} placeholder="Conakry, Guinée" />
              <CountryPicker label="NATIONALITÉ" value={nationality} onChange={setNationality} editable={isEditing} />
            </View>

            {/* Adresse */}
            <View style={{ backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 16, fontFamily: T.font.sans }}>ADRESSE DE RÉSIDENCE</Text>
              <Field label="ADRESSE COMPLÈTE *" value={address} onChange={setAddress} editable={isEditing} placeholder="12 Rue des Lilas…" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="CODE POSTAL" value={postalCode} onChange={setPostalCode} editable={isEditing} keyboardType="numeric" style={{ flex: 0.45 }} />
                <Field label="VILLE *" value={city} onChange={setCity} editable={isEditing} style={{ flex: 1 }} />
              </View>
              <CountryPicker label="PAYS DE RÉSIDENCE *" value={country} onChange={setCountry} editable={isEditing} />
            </View>

            {isEditing && (
              <TouchableOpacity style={{ borderRadius: T.radius.md, overflow: "hidden", marginBottom: 16 }} onPress={save} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={[T.accent, T.accentSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <>
                        <Ionicons name="save-outline" size={17} color="#000" />
                        <Text style={{ color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1, fontFamily: T.font.sans }}>ENREGISTRER LES MODIFICATIONS</Text>
                      </>
                  }
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