//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-wallet.tsx
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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";

import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";
import { colors } from "../../../theme/colors";
import { COUNTRIES } from "../../../utils/countries";

export default function PersonalInfoWallet() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!user) return;

    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    setEmail(user.email || "");
    setBirthDate(user.birthDate || "");
    setBirthPlace(user.birthPlace || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet || "");
    setPostalCode(user.postalCode || "");
    setCity(user.city || "");
    setCountry(user.country || "");
  }, [user]);

  const save = async () => {
    try {
      setLoading(true);

      await api.updateProfile({
        firstName,
        lastName,
        birthDate,
        birthPlace,
        nationality,
        addressStreet: address,
        postalCode,
        city,
        country
      });

      await refreshUser();

      Alert.alert("Succès", "Profil mis à jour", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch {
      Alert.alert("Erreur", "Impossible d’enregistrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Mes informations</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>

          <Input label="Prénom" value={firstName} onChange={setFirstName} />
          <Input label="Nom" value={lastName} onChange={setLastName} />

          <Input label="Téléphone" value={phone} editable={false} />
          <Input label="Email" value={email} editable={false} />

          <Input label="Date naissance" value={birthDate} onChange={setBirthDate} />
          <Input label="Lieu naissance" value={birthPlace} onChange={setBirthPlace} />

          <PickerBox label="Nationalité" value={nationality} onChange={setNationality} />
          <Input label="Rue / Voie" value={address} onChange={setAddress} />

          <View style={styles.row}>
            <Input
              label="Code postal"
              value={postalCode}
              onChange={setPostalCode}
              style={{ flex: 0.4, marginRight: 10 }}
            />
            <Input
              label="Ville"
              value={city}
              onChange={setCity}
              style={{ flex: 1 }}
            />
          </View>

          <PickerBox label="Pays résidence" value={country} onChange={setCountry} />

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Enregistrer</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ label, value, onChange, editable = true, style }: any) {
  return (
    <View style={[styles.inputBox, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        style={[styles.input, !editable && { backgroundColor: "#F3F4F6" }]}
      />
    </View>
  );
}

function PickerBox({ label, value, onChange }: any) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Picker selectedValue={value} onValueChange={onChange}>
        {COUNTRIES.map(c => (
          <Picker.Item key={c} label={c} value={c} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16
  },
  title: { color: "#fff", fontWeight: "700", fontSize: 16 },

  content: { padding: 20, paddingBottom: 80 },

  row: { flexDirection: "row" },

  inputBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    marginBottom: 16,
    padding: 10
  },
  inputLabel: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 4
  },
  input: {
    fontSize: 16,
    color: "#111"
  },

  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  }
});
