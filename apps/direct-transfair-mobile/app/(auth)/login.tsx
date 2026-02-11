// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState, useCallback } from "react";
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
import { Link, useFocusEffect } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { api } from "../../services/api";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  
  // State pour stocker le tenant actuel et l'afficher dynamiquement
  const [currentTenant, setCurrentTenant] = useState(api.getTenant());

  // ✅ Met à jour l'affichage quand on revient sur l'écran (après un lien profond par exemple)
  useFocusEffect(
    useCallback(() => {
      setCurrentTenant(api.getTenant());
    }, [])
  );

  const tenantLabel = currentTenant && currentTenant !== "DONIKO" ? currentTenant : "Plateforme globale";

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
      console.log("Tentative de connexion vers:", api.http.defaults.baseURL);
      await login({ email: identifier.trim(), password });
    } catch (e: any) {
      console.error("Erreur Login compléte:", e);
      
      let msg = "Une erreur est survenue.";

      if (e.response) {
        // Le serveur a répondu (donc on l'a atteint), mais avec une erreur (ex: 401, 400)
        msg = e.response?.data?.message || "Identifiants incorrects.";
      } else if (e.request) {
        // La requête est partie mais pas de réponse (Serveur éteint ou mauvaise IP)
        msg = "Impossible de joindre le serveur. Vérifiez votre connexion internet ou l'adresse IP.";
      } else {
        // Erreur de configuration
        msg = e.message;
      }

      showAlert("Erreur de connexion", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#E0F2FE" }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Direct Transf'air</Text>
          <Text style={styles.subtitle}>Espace Sécurisé</Text>

          <View style={styles.tenantBox}>
            <Text style={styles.tenantLabel}>Société</Text>
            <Text style={styles.tenantValue}>{tenantLabel}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email ou N° de téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: +224 620... ou client@mail.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
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

          <View style={{ alignItems: "flex-end", marginBottom: 20 }}>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
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
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.primary,
    textAlign: "center",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 18,
  },

  tenantBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  tenantLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  tenantValue: { marginTop: 4, fontSize: 14, fontWeight: "800", color: "#1E293B" },

  inputContainer: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginLeft: 2,
  },
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
    marginTop: 0,
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