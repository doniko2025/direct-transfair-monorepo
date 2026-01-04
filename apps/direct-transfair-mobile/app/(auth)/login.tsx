//apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, Link } from "expo-router";

import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Email et mot de passe sont obligatoires.");
      return;
    }

    try {
      await login({
        email: email.trim(),
        password,
      });

      // ✅ REDIRECTION VERS UN ÉCRAN RÉEL
      router.replace("/(tabs)/home");
    } catch {
      Alert.alert(
        "Connexion impossible",
        "Vérifie tes identifiants et réessaie."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Direct Transf'air</Text>
      <Text style={styles.subtitle}>Connexion</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={styles.button}
        onPress={onSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pas de compte ? </Text>
        <Link href="/(auth)/register" style={styles.link}>
          S’inscrire
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.primary,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 18,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#FFF",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  footerText: {
    color: "#444",
  },
  link: {
    fontWeight: "800",
    color: colors.primary,
  },
});
