//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";
import { COUNTRIES } from "../../../utils/countries";

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(false);

  // Champs
  const [gender, setGender] = useState("M");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [nationality, setNationality] = useState("Guinée");
  const [address, setAddress] = useState(""); // Rue
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");
  const [jobTitle, setJobTitle] = useState("");

  // Init data
  useEffect(() => {
    if (user) {
        setGender(user.gender || "M");
        setFirstName(user.firstName || "");
        setLastName(user.lastName || "");
        setBirthDate(user.birthDate || "");
        setBirthPlace(user.birthPlace || "");
        setNationality(user.nationality || "Guinée");
        setAddress(user.addressStreet || "");
        setPostalCode(user.postalCode || "");
        setCity(user.city || "");
        setCountry(user.country || "France");
        setJobTitle(user.jobTitle || "");
    }
  }, [user]);

  const handleSave = async () => {
    try {
        setLoading(true);
        const payload = {
            gender: gender as "M" | "F",
            firstName, lastName,
            birthDate, birthPlace,
            nationality,
            addressStreet: address,
            postalCode, city, country,
            jobTitle
        };
        
        await api.updateProfile(payload);
        if (refreshUser) await refreshUser();
        
        Alert.alert("Succès", "Informations mises à jour", [
            { text: "OK", onPress: () => router.back() }
        ]);

    } catch(e) {
        console.error(e);
        Alert.alert("Erreur", "Mise à jour impossible");
    } finally {
        setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER BLEU */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes informations personnelles</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>Mes informations</Text>

        {/* GENRE (RADIO) */}
        <View style={styles.radioRow}>
            <Text style={styles.label}>Je suis</Text>
            <TouchableOpacity style={styles.radioBtn} onPress={() => setGender("F")}>
                <Ionicons name={gender === "F" ? "radio-button-on" : "radio-button-off"} size={20} color={gender === "F" ? colors.primary : "#999"} />
                <Text style={styles.radioText}>Une femme</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radioBtn} onPress={() => setGender("M")}>
                <Ionicons name={gender === "M" ? "radio-button-on" : "radio-button-off"} size={20} color={gender === "M" ? colors.primary : "#999"} />
                <Text style={styles.radioText}>Un homme</Text>
            </TouchableOpacity>
        </View>

        {/* CHAMPS TEXTE */}
        <FloatingInput label="Prénom" value={firstName} onChange={setFirstName} />
        <FloatingInput label="Nom" value={lastName} onChange={setLastName} />
        
        <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
                <FloatingInput label="Date de naissance" value={birthDate} onChange={setBirthDate} placeholder="JJ/MM/AAAA" />
            </View>
            <View style={{flex: 1}}>
                <FloatingInput label="Lieu de naissance" value={birthPlace} onChange={setBirthPlace} />
            </View>
        </View>

        {/* PAYS (PICKER) */}
        <View style={styles.pickerBox}>
            <Text style={styles.pickerLabel}>Pays de naissance</Text>
            <Picker selectedValue={nationality} onValueChange={setNationality} style={styles.picker}>
                {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
        </View>

        <View style={styles.pickerBox}>
            <Text style={styles.pickerLabel}>Nationalité</Text>
            <Picker selectedValue={nationality} onValueChange={setNationality} style={styles.picker}>
                {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
        </View>

        <FloatingInput label="Adresse e-mail" value={user?.email || ""} onChange={() => {}} editable={false} />

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Mon adresse</Text>
        <FloatingInput label="Rue / Voie" value={address} onChange={setAddress} />
        <View style={styles.row}>
            <View style={{flex: 0.4, marginRight: 10}}>
                <FloatingInput label="Code Postal" value={postalCode} onChange={setPostalCode} keyboardType="numeric" />
            </View>
            <View style={{flex: 1}}>
                <FloatingInput label="Ville" value={city} onChange={setCity} />
            </View>
        </View>
        <View style={styles.pickerBox}>
            <Text style={styles.pickerLabel}>Pays de résidence</Text>
            <Picker selectedValue={country} onValueChange={setCountry} style={styles.picker}>
                {COUNTRIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ma situation professionnelle</Text>
        <FloatingInput label="Profession" value={jobTitle} onChange={setJobTitle} />

        <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
        >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer les modifications</Text>}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// Composant Input style "Material"
function FloatingInput({ label, value, onChange, placeholder, editable = true, keyboardType }: any) {
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput 
                style={[styles.input, !editable && { backgroundColor: '#F3F4F6', color: '#999' }]}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                editable={editable}
                keyboardType={keyboardType}
            />
        </View>
    )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: colors.secondary || '#2563EB', height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 14, color: '#374151', marginRight: 16 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  radioText: { marginLeft: 6, fontSize: 14, color: '#374151' },

  inputContainer: { marginBottom: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  inputLabel: { position: 'absolute', top: -10, left: 10, backgroundColor: '#FFF', paddingHorizontal: 4, fontSize: 12, color: colors.primary },
  input: { fontSize: 16, color: '#1F2937', paddingVertical: 4 },

  row: { flexDirection: 'row' },

  pickerBox: { marginBottom: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
  pickerLabel: { position: 'absolute', top: -10, left: 10, backgroundColor: '#FFF', paddingHorizontal: 4, fontSize: 12, color: colors.primary, zIndex: 1 },
  picker: { height: 50 },

  saveBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});