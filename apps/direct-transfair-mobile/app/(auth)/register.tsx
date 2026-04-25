// apps/direct-transfair-mobile/app/(auth)/register.tsx
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, Modal, FlatList, Platform, KeyboardAvoidingView, SafeAreaView, useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";

import { countriesList, CountryData } from "../../data/countries";
import { citiesByCountry } from "../../data/cities";
import { api } from "../../services/api";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#059669",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  inputBg: "#F1F5F9",
  text: "#0F172A",
  muted: "#64748B",
};

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // --- ÉTATS ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [residenceCountry, setResidenceCountry] = useState<CountryData | null>(null);
  const [residenceCity, setResidenceCity] = useState("");

  const [nationality, setNationality] = useState<CountryData | null>(null);
  const [birthCountry, setBirthCountry] = useState<CountryData | null>(null);
  const [birthCity, setBirthCity] = useState("");

  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [modalType, setModalType] = useState<string | null>(null);

  useEffect(() => { setResidenceCity(""); }, [residenceCountry]);
  useEffect(() => { setBirthCity(""); }, [birthCountry]);

  const showWebAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const tenant = api.getTenant();
  const tenantLabel = tenant && tenant !== "DONIKO" ? tenant : "Plateforme globale";

  const onSubmit = async () => {
    if (!firstName || !lastName || !email || !password) {
      showWebAlert("Champs requis", "Veuillez remplir les champs obligatoires (*).");
      return;
    }

    let formattedBirthDate: string | undefined = undefined;
    if (birthDay && birthMonth && birthYear) {
      formattedBirthDate = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}T00:00:00.000Z`;
    }

    const payload = {
      firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password,
      phone: phone ? `+${residenceCountry?.dialCode || ""}${phone}` : undefined,
      country: residenceCountry?.name, city: residenceCity,
      nationality: nationality?.name, birthCountry: birthCountry?.name, birthCity: birthCity,
      birthDate: formattedBirthDate,
      birthPlace: birthCity + (birthCountry ? ", " + birthCountry.name : ""),
    };

    try {
      await register(payload);
      showWebAlert("Succès", "Compte créé ! Veuillez vous connecter.");
      router.replace("/(auth)/login");
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "Erreur inconnue.";
      showWebAlert("Echec", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  // --- MODAL ---
  const getModalData = () => {
    if (["RESIDENCE_COUNTRY", "NATIONALITY", "BIRTH_COUNTRY"].includes(modalType || "")) return countriesList;
    if (modalType === "RESIDENCE_CITY") return residenceCountry ? citiesByCountry[residenceCountry.name] || [] : [];
    if (modalType === "BIRTH_CITY") return birthCountry ? citiesByCountry[birthCountry.name] || [] : [];
    return [];
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scrollContent, isDesktop && s.scrollContentDesktop]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* ✅ CORRECTION : Redirection explicite vers le login au lieu de router.back() */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.replace("/(auth)/login")}>
            <Ionicons name="arrow-back" size={24} color={THEME.text} />
          </TouchableOpacity>

          <Text style={s.headerTitle}>Créer un compte</Text>
          <Text style={s.headerSub}>Rejoignez Direct Transf'air en quelques étapes.</Text>

          <View style={s.sectionBox}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionLabel}>SOCIÉTÉ LIÉE</Text>
              <Text style={s.tenantText}>{tenantLabel}</Text>
            </View>
            <Ionicons name="business" size={32} color={THEME.primary} style={{ opacity: 0.2 }} />
          </View>

          {/* 1. IDENTIFIANTS */}
          <Text style={s.groupTitle}>1. IDENTIFIANTS</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.label}>Prénom *</Text>
                <TextInput style={s.input} placeholder="Ex: Jean" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Nom *</Text>
                <TextInput style={s.input} placeholder="Ex: Dupont" value={lastName} onChangeText={setLastName} />
              </View>
            </View>
            <Text style={s.label}>Email *</Text>
            <TextInput style={s.input} placeholder="jean@email.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Text style={s.label}>Mot de passe *</Text>
            <TextInput style={s.input} placeholder="Min. 6 caractères" secureTextEntry value={password} onChangeText={setPassword} />
          </View>

          {/* 2. RÉSIDENCE */}
          <Text style={s.groupTitle}>2. RÉSIDENCE & CONTACT</Text>
          <View style={s.card}>
            <Text style={s.label}>Pays de résidence</Text>
            <TouchableOpacity style={s.selectInput} onPress={() => setModalType("RESIDENCE_COUNTRY")}>
              {residenceCountry ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}><Text style={{ fontSize: 20, marginRight: 8 }}>{residenceCountry.flag}</Text><Text style={s.inputText}>{residenceCountry.name}</Text></View>
              ) : <Text style={s.placeholder}>Sélectionner un pays</Text>}
              <Ionicons name="chevron-down" size={20} color={THEME.muted} />
            </TouchableOpacity>

            <Text style={s.label}>Ville de résidence</Text>
            <TouchableOpacity style={s.selectInput} onPress={() => !residenceCountry ? showWebAlert("Info", "Sélectionnez d'abord un pays.") : setModalType("RESIDENCE_CITY")}>
              <Text style={residenceCity ? s.inputText : s.placeholder}>{residenceCity || "Sélectionner une ville"}</Text>
              <Ionicons name="chevron-down" size={20} color={THEME.muted} />
            </TouchableOpacity>

            <Text style={s.label}>Téléphone</Text>
            <View style={s.row}>
              <View style={s.phoneCodeBox}><Text style={s.phoneCodeText}>{residenceCountry ? `+${residenceCountry.dialCode}` : "+ ??"}</Text></View>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="612345678" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            </View>
          </View>

          {/* 3. KYC */}
          <Text style={s.groupTitle}>3. ÉTAT CIVIL (KYC)</Text>
          <View style={s.card}>
            <Text style={s.label}>Nationalité</Text>
            <TouchableOpacity style={s.selectInput} onPress={() => setModalType("NATIONALITY")}>
              <Text style={nationality ? s.inputText : s.placeholder}>{nationality?.name || "Sélectionner"}</Text>
              <Ionicons name="chevron-down" size={20} color={THEME.muted} />
            </TouchableOpacity>

            <Text style={s.label}>Date de Naissance (JJ / MM / AAAA)</Text>
            <View style={s.dateRow}>
              <TextInput style={[s.input, s.dateInput]} placeholder="JJ" keyboardType="numeric" maxLength={2} value={birthDay} onChangeText={setBirthDay} />
              <TextInput style={[s.input, s.dateInput]} placeholder="MM" keyboardType="numeric" maxLength={2} value={birthMonth} onChangeText={setBirthMonth} />
              <TextInput style={[s.input, s.dateInput, { flex: 1.2 }]} placeholder="AAAA" keyboardType="numeric" maxLength={4} value={birthYear} onChangeText={setBirthYear} />
            </View>

            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={s.label}>Pays Naissance</Text>
                <TouchableOpacity style={s.selectInput} onPress={() => setModalType("BIRTH_COUNTRY")}>
                  <Text style={birthCountry ? s.inputText : s.placeholder} numberOfLines={1}>{birthCountry?.name || "Choisir"}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Ville Naissance</Text>
                <TouchableOpacity style={s.selectInput} onPress={() => !birthCountry ? showWebAlert("Info", "Pays requis.") : setModalType("BIRTH_CITY")}>
                  <Text style={birthCity ? s.inputText : s.placeholder} numberOfLines={1}>{birthCity || "Choisir"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity style={[s.button, isLoading && { opacity: 0.7 }]} onPress={onSubmit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <><Text style={s.buttonText}>CRÉER MON COMPTE</Text><Ionicons name="checkmark-circle" size={20} color="#FFF" /></>}
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Déjà inscrit ? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")}><Text style={s.link}>Se connecter</Text></TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- MODALE DE SÉLECTION --- */}
      <Modal visible={!!modalType} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Faites votre choix</Text>
              <TouchableOpacity onPress={() => setModalType(null)} style={s.closeBtn}><Ionicons name="close" size={24} color={THEME.text} /></TouchableOpacity>
            </View>
            <FlatList<any> 
              data={getModalData()} 
              keyExtractor={(item: any, i) => (item.code || item) + i}
              renderItem={({ item }: { item: any }) => {
                if (typeof item === "string") {
                  return (
                    <TouchableOpacity style={s.modalItem} onPress={() => { if (modalType === "RESIDENCE_CITY") setResidenceCity(item); if (modalType === "BIRTH_CITY") setBirthCity(item); setModalType(null); }}>
                      <Text style={s.modalText}>{item}</Text><Ionicons name="chevron-forward" size={18} color={THEME.muted} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity style={s.modalItem} onPress={() => { if (modalType === "RESIDENCE_COUNTRY") setResidenceCountry(item); if (modalType === "NATIONALITY") setNationality(item); if (modalType === "BIRTH_COUNTRY") setBirthCountry(item); setModalType(null); }}>
                    <Text style={s.flag}>{item.flag}</Text><Text style={s.modalText}>{item.name}</Text><Text style={s.code}>+{item.dialCode}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={s.emptyModal}>Aucune donnée disponible.</Text>}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 60 },
  scrollContentDesktop: { maxWidth: 600, alignSelf: 'center', width: '100%', paddingVertical: 40 },
  
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.surface, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 20 },
  headerTitle: { fontSize: 32, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text, marginBottom: 4 },
  headerSub: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600", marginBottom: 24 },

  sectionBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#E0F2FE", padding: 18, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: "#BAE6FD" },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "900", color: "#0284C7", letterSpacing: 1, marginBottom: 4 },
  tenantText: { fontSize: 18, fontFamily: FONTS.heading, fontWeight: "800", color: "#0369A1" },

  groupTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4, marginTop: 10 },
  card: { backgroundColor: THEME.surface, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: THEME.border, marginBottom: 20 },

  row: { flexDirection: "row" },
  
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dateInput: { flex: 1, marginBottom: 0, paddingHorizontal: 10, textAlign: "center", minWidth: 0 },
  
  label: { fontSize: 11, fontFamily: FONTS.body, fontWeight: "800", color: THEME.muted, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: THEME.inputBg, borderWidth: 1, borderColor: "transparent", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: FONTS.body, color: THEME.text, fontWeight: "600", marginBottom: 16 },
  selectInput: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  inputText: { fontSize: 15, fontFamily: FONTS.body, color: THEME.text, fontWeight: "600" },
  placeholder: { fontSize: 15, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "500" },
  
  phoneCodeBox: { backgroundColor: THEME.border, borderRadius: 14, width: 70, justifyContent: "center", alignItems: "center", marginRight: 10 },
  phoneCodeText: { fontSize: 15, fontFamily: FONTS.body, fontWeight: "800", color: THEME.text },

  button: { backgroundColor: THEME.primary, borderRadius: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  buttonText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "600" },
  link: { fontSize: 14, fontFamily: FONTS.body, color: THEME.primary, fontWeight: "800" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: THEME.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: "80%", padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  modalTitle: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center' },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.bg, flexDirection: "row", alignItems: "center" },
  flag: { fontSize: 24, marginRight: 16 },
  modalText: { fontSize: 16, fontFamily: FONTS.body, fontWeight: "600", color: THEME.text, flex: 1 },
  code: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "800" },
  emptyModal: { textAlign: "center", color: THEME.muted, marginTop: 40, fontFamily: FONTS.body, fontSize: 15 },
});