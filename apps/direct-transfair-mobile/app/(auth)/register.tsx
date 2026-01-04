//apps/direct-transfair-mobile/app/(auth)/register.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { router, Link } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");

  const onSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Prénom, nom, email et mot de passe sont obligatoires.");
      return;
    }

    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        nationality: nationality.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
      });

      // ✅ REDIRECTION CORRECTE
      router.replace("/(tabs)/home");
    } catch {
      Alert.alert("Inscription impossible", "Vérifie les champs et réessaie.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Inscription</Text>

      <TextInput style={styles.input} placeholder="Prénom *" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Nom *" value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder="Email *" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Mot de passe *" secureTextEntry value={password} onChangeText={setPassword} />

      <Text style={styles.section}>Informations optionnelles</Text>
      <TextInput style={styles.input} placeholder="Téléphone" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Pays" value={country} onChangeText={setCountry} />
      <TextInput style={styles.input} placeholder="Ville" value={city} onChangeText={setCity} />
      <TextInput style={styles.input} placeholder="Nationalité" value={nationality} onChangeText={setNationality} />
      <TextInput style={styles.input} placeholder="Date de naissance (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
      <TextInput style={styles.input} placeholder="Lieu de naissance" value={birthPlace} onChangeText={setBirthPlace} />

      <Pressable style={styles.button} onPress={onSubmit} disabled={isLoading}>
        {isLoading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Déjà un compte ? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Se connecter
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "900", color: colors.primary, marginBottom: 14 },
  section: { marginTop: 10, marginBottom: 10, fontWeight: "800", color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#FFF",
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#FFF", fontWeight: "800" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 14 },
  footerText: { color: "#444" },
  link: { fontWeight: "800", color: colors.primary },
});
