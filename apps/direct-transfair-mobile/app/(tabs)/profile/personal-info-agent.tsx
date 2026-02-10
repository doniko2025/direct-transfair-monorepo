import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";

export default function PersonalInfoAgent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    if (!user) return;

    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setCity(user.city || "");
    setCountry(user.country || "");
    setAgencyName(user.agency?.name || user.agencyName || "");
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);

      await api.updateProfile({
        firstName,
        lastName,
        city,
        country,
      });

      await refreshUser?.();

      Alert.alert("Succès", "Profil agent mis à jour", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sauvegarder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header router={router} title="Profil Agent" />

      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Prénom" value={firstName} onChange={setFirstName} />
        <Field label="Nom" value={lastName} onChange={setLastName} />
        <Field label="Téléphone" value={phone} editable={false} />
        <Field label="Agence" value={agencyName} editable={false} />
        <Field label="Ville" value={city} onChange={setCity} />
        <Field label="Pays" value={country} onChange={setCountry} />

        <TouchableOpacity style={styles.btn} onPress={save}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Header({ router, title }: any) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Field({ label, value, onChange, editable = true }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.disabled]}
        value={value}
        onChangeText={onChange}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 60,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  content: { padding: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: "#666", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  disabled: { backgroundColor: "#F3F4F6", color: "#999" },
  btn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  btnText: { color: "#FFF", fontWeight: "bold" },
});
