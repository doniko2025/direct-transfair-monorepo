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

  // Champs obligatoires
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Champs optionnels (mais recommandés)
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState(""); // Idéalement YYYY-MM-DD
  const [birthPlace, setBirthPlace] = useState("");

  const onSubmit = async () => {
    // Validation de base
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Prénom, nom, email et mot de passe sont obligatoires.");
      return;
    }

    try {
      // ✅ Envoi de TOUS les champs au backend
      // Le type RegisterPayload dans types.ts doit avoir été mis à jour pour accepter ces champs
      // (Si une erreur persiste ici, c'est que types.ts n'est pas encore sauvegardé avec les nouveaux champs)
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        // On envoie 'undefined' si le champ est vide pour ne pas envoyer de chaîne vide
        phone: phone.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        nationality: nationality.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
      });

      // Redirection vers l'accueil une fois inscrit et connecté
      router.replace("/(tabs)/home");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Inscription impossible", "Vérifie les champs et réessaie.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Inscription</Text>

      {/* SECTION OBLIGATOIRE */}
      <Text style={styles.sectionTitle}>Identifiants</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Prénom *" 
        value={firstName} 
        onChangeText={setFirstName} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Nom *" 
        value={lastName} 
        onChangeText={setLastName} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Email *" 
        autoCapitalize="none" 
        keyboardType="email-address" 
        value={email} 
        onChangeText={setEmail} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Mot de passe *" 
        secureTextEntry 
        value={password} 
        onChangeText={setPassword} 
      />

      {/* SECTION COMPLÉMENTAIRE */}
      <Text style={styles.sectionTitle}>Informations (Optionnel)</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Téléphone" 
        keyboardType="phone-pad"
        value={phone} 
        onChangeText={setPhone} 
      />
      
      <View style={styles.row}>
        <TextInput 
            style={[styles.input, { flex: 1, marginRight: 8 }]} 
            placeholder="Pays" 
            value={country} 
            onChangeText={setCountry} 
        />
        <TextInput 
            style={[styles.input, { flex: 1 }]} 
            placeholder="Ville" 
            value={city} 
            onChangeText={setCity} 
        />
      </View>

      <TextInput 
        style={styles.input} 
        placeholder="Nationalité" 
        value={nationality} 
        onChangeText={setNationality} 
      />
      
      <View style={styles.row}>
        <TextInput 
            style={[styles.input, { flex: 1, marginRight: 8 }]} 
            placeholder="Date Naissance (JJ/MM/AAAA)" 
            value={birthDate} 
            onChangeText={setBirthDate} 
        />
        <TextInput 
            style={[styles.input, { flex: 1 }]} 
            placeholder="Lieu Naissance" 
            value={birthPlace} 
            onChangeText={setBirthPlace} 
        />
      </View>

      <Pressable style={styles.button} onPress={onSubmit} disabled={isLoading}>
        {isLoading ? (
            <ActivityIndicator color="#FFF" />
        ) : (
            <Text style={styles.buttonText}>Créer mon compte</Text>
        )}
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
  container: { 
    padding: 18, 
    paddingBottom: 40, 
    backgroundColor: colors.background 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "900", 
    color: colors.primary, 
    marginBottom: 20,
    textAlign: "center"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginTop: 10,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#FFF",
    fontSize: 16
  },
  button: { 
    backgroundColor: colors.primary, 
    borderRadius: 10, 
    paddingVertical: 14, 
    alignItems: "center", 
    marginTop: 16 
  },
  buttonText: { 
    color: "#FFF", 
    fontWeight: "800",
    fontSize: 16 
  },
  footer: { 
    flexDirection: "row", 
    justifyContent: "center", 
    marginTop: 20 
  },
  footerText: { 
    color: "#444",
    fontSize: 15
  },
  link: { 
    fontWeight: "800", 
    color: colors.primary,
    fontSize: 15
  },
});