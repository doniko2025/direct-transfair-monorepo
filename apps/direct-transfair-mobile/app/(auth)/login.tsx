/////// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { api } from "../../services/api";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [currentTenant, setCurrentTenant] = useState("DONIKO");

  useFocusEffect(
    useCallback(() => {
      // ✅ Sécurité : On s'assure que l'API utilise le bon code
      let t = api.getTenant();
      if (t === "10" || !t) t = "DONIKO";
      setCurrentTenant(t);
      api.setTenant(t); 
    }, [])
  );

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) return;
    try {
      await login({ email: identifier.trim(), password });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Erreur de connexion au serveur.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>Direct Transf'air</Text>
          <Text style={styles.subtitle}>Espace Sécurisé</Text>
          
          <View style={styles.tenantBox}>
            <Text style={styles.tenantLabel}>SOCIÉTÉ</Text>
            <Text style={styles.tenantValue}>{currentTenant === "DONIKO" ? "Plateforme Globale" : currentTenant}</Text>
          </View>

          <TextInput style={styles.input} placeholder="Email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Se connecter</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E0F2FE" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#FFF", borderRadius: 24, padding: 30, elevation: 5 },
  title: { fontSize: 26, fontWeight: "900", color: colors.primary, textAlign: "center" },
  subtitle: { textAlign: "center", color: "#64748B", marginBottom: 20 },
  tenantBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  tenantLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8" },
  tenantValue: { fontSize: 16, fontWeight: "800", color: "#334155" },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 16, marginBottom: 15 },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#FFF", fontWeight: "800" }
});