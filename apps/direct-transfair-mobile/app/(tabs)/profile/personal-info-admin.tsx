//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

const FONTS = { heading: Platform.OS === 'ios' ? 'Cochin' : 'serif', body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif' };
const THEME = { primary: "#1E3A8A", light: "#EFF6FF", bg: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", border: "#E2E8F0" };

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

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || ""); setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || ""); setAgencyName(user.agency?.name || user.agencyName || "");
    setCity(user.city || ""); setCountry(user.country || "");
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);
      await api.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), jobTitle, city, country });
      await refreshUser?.();
      setIsEditing(false);
      Platform.OS === 'web' ? alert("Profil mis à jour") : Alert.alert("Succès", "Profil mis à jour");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={s.title}>Profil Administrateur</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={s.editBtn}><Ionicons name={isEditing ? "close" : "pencil"} size={22} color="#FFF" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.card}>
            <Text style={s.sectionTitle}>IDENTITÉ & FONCTION</Text>
            <View style={s.row}>
              <Input label="Prénom *" value={firstName} onChange={setFirstName} editable={isEditing} style={{flex:1, marginRight:10}} />
              <Input label="Nom *" value={lastName} onChange={setLastName} editable={isEditing} style={{flex:1}} />
            </View>
            <Input label="Fonction" value={jobTitle} onChange={setJobTitle} editable={isEditing} />
            <Input label="Société / Agence principale" value={agencyName} editable={false} />
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>LOCALISATION</Text>
            <Input label="Ville" value={city} onChange={setCity} editable={isEditing} />
            <Input label="Pays" value={country} onChange={setCountry} editable={isEditing} />
          </View>

          {isEditing && (
            <TouchableOpacity style={[s.saveBtn, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveText}>Enregistrer les modifications</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ label, value, onChange, editable = true, style }: any) {
  return (
    <View style={[s.inputBox, !editable && s.inputDisabled, style]}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} editable={editable} style={s.input} />
    </View>
  );
}

// Les styles sont identiques à super-admin, seul THEME change
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.primary },
  header: { height: 70, backgroundColor: THEME.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  backBtn: { padding: 5 }, editBtn: { padding: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10 },
  title: { color: "#FFF", fontFamily: FONTS.heading, fontWeight: "800", fontSize: 20 },
  content: { padding: 20, backgroundColor: THEME.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: '100%', paddingTop: 24 },
  card: { backgroundColor: THEME.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: THEME.border, shadowColor: "#000", shadowOpacity: 0.02, elevation: 1 },
  sectionTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.5, marginBottom: 16 },
  row: { flexDirection: "row" },
  inputBox: { borderWidth: 1, borderColor: THEME.border, borderRadius: 14, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: THEME.surface },
  inputDisabled: { backgroundColor: "#F1F5F9", borderColor: "transparent" },
  inputLabel: { fontSize: 11, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "800", marginBottom: 4 },
  input: { fontSize: 16, fontFamily: FONTS.body, color: THEME.text, fontWeight: "600", padding: 0 },
  saveBtn: { backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 10 },
  saveText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 15 },
});