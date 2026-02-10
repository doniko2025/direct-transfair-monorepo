//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

export default function PersonalInfoAdmin() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    if (!user) return;

    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setJobTitle(user.jobTitle || "");
    setAgencyName(user.agencyName || "");
    setCity(user.city || "");
    setCountry(user.country || "");
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);

      await api.updateProfile({
        firstName,
        lastName,
        jobTitle,
        city,
        country,
      });

      await refreshUser();
      Alert.alert("Succès", "Profil mis à jour");
      router.back();
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sauvegarder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profil Admin</Text>

      <Input label="Prénom" value={firstName} setValue={setFirstName} />
      <Input label="Nom" value={lastName} setValue={setLastName} />
      <Input label="Fonction" value={jobTitle} setValue={setJobTitle} />
      <Input label="Agence" value={agencyName} setValue={setAgencyName} />
      <Input label="Ville" value={city} setValue={setCity} />
      <Input label="Pays" value={country} setValue={setCountry} />

      <TouchableOpacity style={styles.btn} onPress={save}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Input({ label, value, setValue }: any) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  inputBox: { marginBottom: 16 },
  label: { fontSize: 12, color: "#666" },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  btnText: { color: "#fff", fontWeight: "bold" },
});
