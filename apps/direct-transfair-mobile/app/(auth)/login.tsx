//apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState } from "react";
import { 
    View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, 
    KeyboardAvoidingView, Platform, ScrollView, Image 
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState(""); 

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Champs requis", "Veuillez entrer votre email et mot de passe.");
      return;
    }

    try {
      const code = tenantCode.trim().toUpperCase() || "DONIKO"; // Majuscules auto
      await login({ email: email.trim(), password }, code);
      // Pas besoin de router.replace, l'AuthProvider le fait
    } catch (e: any) {
      const msg = e.response?.data?.message || "Identifiants ou Code Société incorrects.";
      showAlert("Erreur de connexion", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1, backgroundColor: "#E0F2FE"}}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.card}>
            <Text style={styles.title}>Direct Transf'air</Text>
            <Text style={styles.subtitle}>Connexion SaaS</Text>

            {/* CHAMPS */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Code Société (Optionnel)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ex: FLASH2026"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={tenantCode}
                    onChangeText={setTenantCode}
                />
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    placeholder="client@flash.com"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
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

            {/* BOUTON D'ACTION */}
            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.buttonText}>Se connecter</Text>
                )}
            </TouchableOpacity>

            {/* PIED DE PAGE */}
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
  card: { backgroundColor: "#FFF", borderRadius: 24, padding: 30, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 5, maxWidth: 450, width: '100%', alignSelf:'center' },
  
  title: { fontSize: 28, fontWeight: "900", color: colors.primary, textAlign: "center", marginBottom: 5 },
  subtitle: { fontSize: 16, color: "#64748B", textAlign: "center", marginBottom: 30 },
  
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 16, fontSize: 16, color: "#1E293B" },
  
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 10, shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "#64748B", fontSize: 14 },
  link: { color: colors.primary, fontWeight: "800", fontSize: 14 },
});