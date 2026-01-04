// apps/direct-transfair-mobile/app/(tabs)/profile.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Picker } from "@react-native-picker/picker";

import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
// ✅ IMPORT DU FICHIER PAYS
import { COUNTRIES } from "../../utils/countries";
// ✅ IMPORT DE L'ALERTE COMPATIBLE WEB
import { showAlert } from "../../utils/alert";

// --- COMPOSANTS UI ---
function Avatar({ name }: { name: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <View style={styles.avatarContainer}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout, isLoading, refreshUser } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- STATE FORMULAIRE ---
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("M");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  // Par défaut, on met le premier pays de la liste si vide
  const [nationality, setNationality] = useState(COUNTRIES[0]);
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");

  // Adresse
  const [addressNumber, setAddressNumber] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("France");

  // Chargement des données
  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setGender(user.gender || "M");
      setBirthDate(user.birthDate || "");
      setBirthPlace(user.birthPlace || "");
      // Si l'user a déjà une nationalité, on la met, sinon par défaut France/Sénégal
      setNationality(user.nationality || "France");
      setJobTitle(user.jobTitle || "");
      setPhone(user.phone || "");
      
      setAddressNumber(user.addressNumber || "");
      setAddressStreet(user.addressStreet || "");
      setPostalCode(user.postalCode || "");
      setCity(user.city || "");
      setCountry(user.country || "France");
    }
  }, [user]);

  const displayName = user?.firstName 
    ? `${user.firstName} ${user.lastName}`.trim() 
    : user?.email;

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch {
      showAlert("Erreur", "Impossible de se déconnecter.");
    }
  };

  const handleSave = async () => {
    console.log("Tentative de sauvegarde..."); // Pour le debug dans la console Chrome

    // Petite validation locale
    if (!firstName || !lastName) {
      showAlert("Validation", "Le nom et le prénom sont obligatoires.");
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        email, 
        firstName, 
        lastName, 
        phone,
        gender: gender as "M" | "F",
        birthDate, 
        birthPlace, 
        nationality, 
        jobTitle,
        addressNumber,
        addressStreet, 
        postalCode, 
        city, 
        country
      };

      console.log("Envoi au backend :", payload);

      await api.updateProfile(payload);
      
      if (refreshUser) await refreshUser();
      
      setIsEditing(false);
      // ✅ Utilisation de showAlert qui marche sur le Web
      showAlert("Succès", "Profil mis à jour avec succès !");
      
    } catch (e: any) {
      console.error("Erreur save:", e);
      // Affiche l'erreur exacte si possible
      const msg = e.response?.data?.message || "Echec de la mise à jour.";
      showAlert("Erreur", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
     if (user) {
        // Reset des champs
        setFirstName(user.firstName || "");
        setLastName(user.lastName || "");
        // ... (Tu peux ajouter les autres resets si nécessaire)
     }
     setIsEditing(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar name={displayName ?? "User"} />
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userRole}>
           {user?.role === "ADMIN" ? "Administrateur" : "Client Vérifié"}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.editBar}>
            <Text style={styles.infoText}>Mes Informations</Text>
            <TouchableOpacity onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}>
                <Text style={styles.editLink}>{isEditing ? "Annuler" : "Modifier"}</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.card}>
          
          {/* COMPTE */}
          <SectionTitle title="Compte" />
          <InputGroup label="Email" value={email} onChange={setEmail} editable={isEditing} keyboardType="email-address" />
          <InputGroup label="Téléphone" value={phone} onChange={setPhone} editable={isEditing} keyboardType="phone-pad" />

          {/* ÉTAT CIVIL */}
          <SectionTitle title="État Civil" />
          <View style={styles.row}>
             <InputGroup label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} half />
             <InputGroup label="Nom" value={lastName} onChange={setLastName} editable={isEditing} half />
          </View>

          {/* SELECTEUR SEXE */}
          {isEditing ? (
             <View style={styles.inputContainer}>
                <Text style={styles.label}>Sexe</Text>
                <View style={styles.pickerWrapper}>
                    <Picker selectedValue={gender} onValueChange={setGender}>
                        <Picker.Item label="Masculin" value="M" />
                        <Picker.Item label="Féminin" value="F" />
                    </Picker>
                </View>
             </View>
          ) : (
             <InputGroup label="Sexe" value={gender === "M" ? "Masculin" : "Féminin"} editable={false} />
          )}

          <View style={styles.row}>
             <InputGroup label="Date Naissance" value={birthDate} onChange={setBirthDate} editable={isEditing} placeholder="JJ/MM/AAAA" half />
             <InputGroup label="Lieu Naissance" value={birthPlace} onChange={setBirthPlace} editable={isEditing} half />
          </View>

          {/* SELECTEUR NATIONALITÉ */}
          {isEditing ? (
             <View style={styles.inputContainer}>
                <Text style={styles.label}>Nationalité</Text>
                <View style={styles.pickerWrapper}>
                    <Picker selectedValue={nationality} onValueChange={setNationality}>
                        {COUNTRIES.map(c => (
                            <Picker.Item key={c} label={c} value={c} />
                        ))}
                    </Picker>
                </View>
             </View>
          ) : (
             <InputGroup label="Nationalité" value={nationality} editable={false} />
          )}

          <InputGroup label="Profession" value={jobTitle} onChange={setJobTitle} editable={isEditing} placeholder="Ex: Commerçant" />

          {/* ADRESSE */}
          <SectionTitle title="Adresse de résidence" />
          <View style={styles.row}>
             <View style={{flex: 0.3, marginRight: 8}}>
                <InputGroup label="N°" value={addressNumber} onChange={setAddressNumber} editable={isEditing} placeholder="12" />
             </View>
             <View style={{flex: 1}}>
                <InputGroup label="Rue / Voie" value={addressStreet} onChange={setAddressStreet} editable={isEditing} placeholder="Rue de la Paix" />
             </View>
          </View>
          <View style={styles.row}>
             <InputGroup label="Code Postal" value={postalCode} onChange={setPostalCode} editable={isEditing} half keyboardType="numeric" />
             <InputGroup label="Ville" value={city} onChange={setCity} editable={isEditing} half />
          </View>

          {/* SELECTEUR PAYS ADRESSE */}
          {isEditing ? (
             <View style={styles.inputContainer}>
                <Text style={styles.label}>Pays de résidence</Text>
                <View style={styles.pickerWrapper}>
                    <Picker selectedValue={country} onValueChange={setCountry}>
                         {COUNTRIES.map(c => (
                            <Picker.Item key={c} label={c} value={c} />
                        ))}
                    </Picker>
                </View>
             </View>
          ) : (
             <InputGroup label="Pays" value={country} editable={false} />
          )}

        </View>

        {/* ACTIONS */}
        {isEditing && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer les modifications</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoading}>
          <Text style={styles.logoutText}>{isLoading ? "..." : "Se déconnecter"}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Direct Transf'air v1.2.0</Text>
      </View>
    </ScrollView>
  );
}

// --- SOUS-COMPOSANT INPUT ---
function InputGroup({ 
    label, value, onChange, editable = true, placeholder, keyboardType, half 
}: any) {
    return (
        <View style={[styles.inputContainer, half && { flex: 1, marginHorizontal: 4 }]}>
            <Text style={styles.label}>{label}</Text>
            {editable ? (
                <TextInput 
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    keyboardType={keyboardType}
                    autoCapitalize="none"
                />
            ) : (
                <Text style={styles.valueText}>{value || "—"}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background },
  header: { alignItems: "center", paddingVertical: 24, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#eee" },
  avatarContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  userName: { fontSize: 18, fontWeight: "800", color: colors.text },
  userRole: { fontSize: 13, color: colors.muted, marginTop: 2, backgroundColor: "#f0f0f0", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  
  body: { padding: 16 },
  editBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 16, fontWeight: '700', color: colors.text },
  editLink: { color: colors.primary, fontWeight: "600" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  
  sectionTitleContainer: { marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
  sectionLine: { height: 1, backgroundColor: "#f0f0f0", marginTop: 4 },

  row: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: -4 },
  
  inputContainer: { marginBottom: 12 },
  label: { fontSize: 11, color: colors.muted, marginBottom: 4, fontWeight: "600", textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: "#fdfdfd" },
  valueText: { fontSize: 15, color: colors.text, paddingVertical: 4, fontWeight: '500' },
  
  pickerWrapper: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, overflow: 'hidden', backgroundColor: '#fdfdfd' },

  saveButton: { marginTop: 20, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  
  logoutButton: { marginTop: 30, backgroundColor: "#fee2e2", borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#fecaca" },
  logoutText: { color: "#dc2626", fontSize: 16, fontWeight: "700" },
  version: { textAlign: "center", color: "#ccc", fontSize: 11, marginTop: 20 },
});