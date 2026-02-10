// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();

  // On utilise "identifier" au lieu de "email" car ça peut être un téléphone
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showAlert("Champs requis", "Veuillez entrer vos identifiants.");
      return;
    }

    try {
      // On envoie "email" dans le payload car l'API attend ce champ par convention,
      // mais le backend traitera la valeur comme un identifiant (email ou phone)
      await login({ email: identifier.trim(), password });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Identifiants incorrects.";
      showAlert("Erreur de connexion", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#E0F2FE" }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Direct Transf'air</Text>
          <Text style={styles.subtitle}>Espace Sécurisé</Text>

          <View style={styles.inputContainer}>
            {/* Label mis à jour */}
            <Text style={styles.label}>Email ou N° de téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: +224 620... ou client@mail.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              // On retire le type email-address strict pour permettre le téléphone
              keyboardType="default" 
              value={identifier}
              onChangeText={setIdentifier}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Lien Mot de passe oublié ajouté */}
          <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
            <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                        Mot de passe oublié ?
                    </Text>
                </TouchableOpacity>
            </Link>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Se connecter</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas de compte ? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>S'inscrire</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 30,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    maxWidth: 450,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 28, fontWeight: "900", color: colors.primary, textAlign: "center", marginBottom: 5 },
  subtitle: { fontSize: 16, color: "#64748B", textAlign: "center", marginBottom: 30 },

  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6, marginLeft: 2 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 0, // Ajusté car on a ajouté le lien "forgot password" au dessus
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16 },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "#64748B", fontSize: 14 },
  link: { color: colors.primary, fontWeight: "800", fontSize: 14 },
});