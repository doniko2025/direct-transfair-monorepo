//apps/direct-transfair-mobile/app/(auth)/login.tsx
// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState } from "react";
import { 
    View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, Alert, 
    KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { router, Link } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState(""); 

  const onSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Email et mot de passe requis.");
      return;
    }

    try {
      // ✅ On envoie le tenantCode (ou "DONIKO" par défaut)
      const code = tenantCode.trim() || "DONIKO";
      
      // ✅ Plus d'erreur ici car AuthProvider a été mis à jour
      await login({ email: email.trim(), password }, code);

      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Échec", "Identifiants incorrects ou Code Société invalide.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Direct Transf'air</Text>
          <Text style={styles.subtitle}>Connexion SaaS</Text>

          {/* ✅ CHAMP CODE SOCIÉTÉ */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code Société (Optionnel)</Text>
            <TextInput
                style={styles.input}
                placeholder="Ex: DONIKO, FLASH2026..."
                placeholderTextColor="#999"
                autoCapitalize="characters"
                value={tenantCode}
                onChangeText={setTenantCode}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
                style={styles.input}
                placeholder="email@societe.com"
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
                style={styles.input}
                placeholder="******"
                placeholderTextColor="#999"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />
          </View>

          <Pressable style={styles.button} onPress={onSubmit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Se connecter</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas de compte ? </Text>
            <Link href="/(auth)/register" style={styles.link}>S’inscrire</Link>
          </View>
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "900", color: colors.primary, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 18, color: "#666", textAlign: "center", marginBottom: 32 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 14, backgroundColor: "#FFF", fontSize: 16 },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 10, shadowColor: colors.primary, shadowOpacity: 0.3, elevation: 4 },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "#6B7280" },
  link: { fontWeight: "800", color: colors.primary },
});