//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-wallet.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Animated, StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { COUNTRIES } from "../../../utils/countries";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

// ✅ CORRECTION : Ajout de primaryDark au THEME
const THEME = {
  primary: "#059669", // Vert Émeraude
  primaryDark: "#047857", 
  primaryLight: "#10B981",
  light: "#ECFDF5",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

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

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setEmail(user.email || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet || "");
    setPostalCode(user.postalCode || "");
    setCity(user.city || "");
    setCountry(user.country || "");
    
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [user, fadeAnim]);

  const handleDateChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 4) {
      cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    } else if (cleaned.length > 2) {
      cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    setBirthDate(cleaned);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "";
    if (isoString.includes("T") || isoString.includes("-")) {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return isoString; 
  };

  const parseDateForBackend = (displayDate: string) => {
      const parts = displayDate.split("/");
      if (parts.length === 3) {
          const day = parts[0];
          const month = parts[1];
          const year = parts[2];
          if(day.length === 2 && month.length === 2 && year.length === 4) {
             return `${year}-${month}-${day}T00:00:00.000Z`;
          }
      }
      return displayDate; 
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !address.trim() || !city.trim() || !country.trim() || !nationality.trim() || !birthPlace.trim()) {
        if(Platform.OS === 'web') return alert("Veuillez remplir tous les champs obligatoires (hors Code Postal).");
        return Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires.");
    }
    if (birthDate.length !== 10) {
         if(Platform.OS === 'web') return alert("La date de naissance doit être au format JJ/MM/AAAA.");
         return Alert.alert("Erreur", "La date de naissance doit être au format JJ/MM/AAAA.");
    }

    try {
      setLoading(true);
      await api.updateProfile({
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
        birthDate: parseDateForBackend(birthDate), birthPlace: birthPlace.trim(),
        nationality, addressStreet: address.trim(), postalCode: postalCode.trim(),
        city: city.trim(), country
      });

      await refreshUser();
      setIsEditing(false); 
      
      const msg = "Vos informations ont été mises à jour avec succès.";
      if(Platform.OS === 'web') alert(msg); else Alert.alert("Succès", msg);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible d’enregistrer les modifications.";
      if(Platform.OS === 'web') alert(msg); else Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleEdit = () => {
      if (isEditing) {
          setFirstName(user?.firstName || ""); setLastName(user?.lastName || "");
          setPhone(user?.phone || ""); setBirthDate(formatDate(user?.birthDate || ""));
          setBirthPlace(user?.birthPlace || ""); setNationality(user?.nationality || "");
          setAddress(user?.addressStreet || ""); setPostalCode(user?.postalCode || "");
          setCity(user?.city || ""); setCountry(user?.country || "");
      }
      setIsEditing(!isEditing);
  };

  return (
    <SafeAreaView style={s.safeArea}>
      {/* ✅ CORRECTION : Ajout de la StatusBar natamment utilisée dans les props */}
      <StatusBar barStyle="light-content" backgroundColor={THEME.primaryDark} />
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.title}>Mes informations</Text>
          <TouchableOpacity onPress={toggleEdit} style={s.editBtn}>
            <Ionicons name={isEditing ? "close" : "pencil"} size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {!isEditing && (
              <View style={s.infoBanner}>
                <Ionicons name="information-circle" size={20} color={THEME.primary} />
                <Text style={s.infoBannerText}>Cliquez sur le crayon en haut à droite pour modifier vos informations.</Text>
              </View>
            )}

            <View style={s.card}>
                <Text style={s.sectionTitle}>IDENTITÉ</Text>
                <View style={s.row}>
                    <Input label="Prénom *" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1, marginRight: 10 }} />
                    <Input label="Nom *" value={lastName} onChange={setLastName} editable={isEditing} style={{ flex: 1 }} />
                </View>
                <Input label="Téléphone *" value={phone} onChange={setPhone} editable={isEditing} keyboardType="phone-pad" />
                <Input label="Email (Lecture seule)" value={email} editable={false} />
            </View>

            <View style={s.card}>
                <Text style={s.sectionTitle}>ÉTAT CIVIL</Text>
                <View style={[s.inputBox, !isEditing && s.inputDisabled]}>
                  <Text style={s.inputLabel}>Date de naissance (JJ/MM/AAAA) *</Text>
                  <TextInput value={birthDate} onChangeText={handleDateChange} editable={isEditing} style={s.input} placeholder="Ex: 10/06/1986" keyboardType="numeric" maxLength={10} />
                </View>
                <Input label="Lieu de naissance *" value={birthPlace} onChange={setBirthPlace} editable={isEditing} />
                <PickerBox label="Nationalité *" value={nationality} onChange={setNationality} editable={isEditing} />
            </View>

            <View style={s.card}>
                <Text style={s.sectionTitle}>ADRESSE DE RÉSIDENCE</Text>
                <Input label="Adresse complète *" value={address} onChange={setAddress} editable={isEditing} placeholder="1 rue du marché..." />
                <View style={s.row}>
                    <Input label="Code postal" value={postalCode} onChange={setPostalCode} editable={isEditing} style={{ flex: 0.4, marginRight: 10 }} keyboardType="numeric" />
                    <Input label="Ville *" value={city} onChange={setCity} editable={isEditing} style={{ flex: 1 }} />
                </View>
                <PickerBox label="Pays de résidence *" value={country} onChange={setCountry} editable={isEditing} />
            </View>

            {isEditing && (
              <TouchableOpacity style={[s.saveBtn, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <><Text style={s.saveText}>Enregistrer les modifications</Text><Ionicons name="checkmark-circle" size={20} color="#FFF" /></>}
              </TouchableOpacity>
            )}

            <View style={{ height: 60 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ label, value, onChange, editable = true, style, keyboardType, placeholder }: any) {
  return (
    <View style={[s.inputBox, !editable && s.inputDisabled, style]}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} editable={editable} keyboardType={keyboardType || "default"} placeholder={placeholder} placeholderTextColor={THEME.muted} style={s.input} />
    </View>
  );
}

function PickerBox({ label, value, onChange, editable }: any) {
  return (
    <View style={[s.inputBox, !editable && s.inputDisabled]}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={[s.pickerWrap, !editable && { opacity: 0.8 }]}>
        <Picker selectedValue={value} onValueChange={onChange} enabled={editable} style={s.picker}>
          {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
        </Picker>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.primary },
  header: { height: 70, backgroundColor: THEME.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  backBtn: { padding: 5 },
  title: { color: "#FFF", fontFamily: FONTS.heading, fontWeight: "800", fontSize: 20 },
  editBtn: { padding: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10 },
  content: { padding: 20, backgroundColor: THEME.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: '100%', paddingTop: 24 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.light, padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: "#D1FAE5" },
  infoBannerText: { flex: 1, marginLeft: 10, fontSize: 13, fontFamily: FONTS.body, color: THEME.primaryDark, fontWeight: '600' },
  card: { backgroundColor: THEME.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: THEME.border, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  sectionTitle: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "900", color: THEME.muted, letterSpacing: 1.5, marginBottom: 16 },
  row: { flexDirection: "row" },
  inputBox: { borderWidth: 1, borderColor: THEME.border, borderRadius: 14, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: THEME.surface },
  inputDisabled: { backgroundColor: "#F1F5F9", borderColor: "transparent" },
  inputLabel: { fontSize: 11, fontFamily: FONTS.body, color: THEME.muted, fontWeight: "800", marginBottom: 4, letterSpacing: 0.5 },
  input: { fontSize: 16, fontFamily: FONTS.body, color: THEME.text, fontWeight: "600", padding: 0 },
  pickerWrap: { marginHorizontal: -10, marginVertical: -10 },
  picker: { width: '100%', color: THEME.text },
  saveBtn: { flexDirection: 'row', gap: 10, backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 15 },
});