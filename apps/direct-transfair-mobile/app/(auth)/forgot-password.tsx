//apps/direct-transfair-mobile/app/(auth)/forgot-password.tsx
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api"; // Assurez-vous que api.ts a les méthodes sendOtp, verifyOtp, resetPassword
import { colors } from "../../theme/colors";

// Étapes du processus
type Step = "IDENTIFIER" | "CHANNEL_SELECT" | "OTP_VERIFY" | "NEW_PASSWORD";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("IDENTIFIER");
  const [loading, setLoading] = useState(false);

  // Données utilisateur
  const [identifier, setIdentifier] = useState(""); // Email ou Phone
  const [userId, setUserId] = useState<string | null>(null);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]); // ['EMAIL', 'PHONE']
  const [selectedChannel, setSelectedChannel] = useState<"EMAIL" | "PHONE">("EMAIL");
  
  // Données OTP & Password
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  // --- ÉTAPE 1 : IDENTIFICATION ---
  const handleFindUser = async () => {
    if (!identifier.trim()) return showAlert("Erreur", "Veuillez entrer votre email ou téléphone.");
    
    setLoading(true);
    try {
      // Backend: Doit vérifier l'existence et renvoyer les canaux dispos (email/sms)
      // Ex: POST /auth/find-account { identifier: ... } -> { userId: '...', channels: ['EMAIL', 'PHONE'] }
      const res = await api.http.post('/auth/find-account', { identifier: identifier.trim() });
      
      setUserId(res.data.userId);
      setAvailableChannels(res.data.channels || ['EMAIL']); // Fallback Email
      
      if (res.data.channels.length > 1) {
        setStep("CHANNEL_SELECT");
      } else {
        // Si un seul canal, on envoie direct
        setSelectedChannel(res.data.channels[0]);
        await sendOtp(res.data.userId, res.data.channels[0]);
      }
    } catch (e: any) {
      showAlert("Introuvable", "Aucun compte associé à cet identifiant.");
    } finally {
      setLoading(false);
    }
  };

  // --- ENVOI DU CODE OTP ---
  const sendOtp = async (uid: string, channel: string) => {
    setLoading(true);
    try {
      await api.http.post('/auth/send-otp', { userId: uid, channel });
      setStep("OTP_VERIFY");
      // Petit message de succès discret
      if (Platform.OS === 'android') Alert.alert("Code envoyé", `Vérifiez votre ${channel === 'EMAIL' ? 'boîte mail' : 'téléphone'}.`);
    } catch (e: any) {
      showAlert("Erreur", "Impossible d'envoyer le code. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  // --- ÉTAPE 2 : SÉLECTION CANAL (Si plusieurs) ---
  const handleChannelSelect = () => {
    if (userId) sendOtp(userId, selectedChannel);
  };

  // --- ÉTAPE 3 : VÉRIFICATION OTP ---
  const handleVerifyOtp = async () => {
    if (otpCode.length < 4) return showAlert("Erreur", "Code invalide.");
    
    setLoading(true);
    try {
      await api.http.post('/auth/verify-otp', { userId, code: otpCode, type: 'PASSWORD_RESET' });
      setStep("NEW_PASSWORD");
    } catch (e: any) {
      showAlert("Erreur", "Code incorrect ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  // --- ÉTAPE 4 : NOUVEAU MOT DE PASSE ---
  const handleResetPassword = async () => {
    if (newPassword.length < 6) return showAlert("Erreur", "Le mot de passe doit faire au moins 6 caractères.");
    if (newPassword !== confirmPassword) return showAlert("Erreur", "Les mots de passe ne correspondent pas.");

    setLoading(true);
    try {
      await api.http.post('/auth/reset-password', { userId, code: otpCode, newPassword }); // On renvoie le code OTP pour sécuriser l'appel
      
      if (Platform.OS === 'web') {
        window.alert("Succès ! Mot de passe modifié.");
        router.replace("/(auth)/login");
      } else {
        Alert.alert("Succès", "Mot de passe modifié avec succès.", [
          { text: "Se connecter", onPress: () => router.replace("/(auth)/login") }
        ]);
      }
    } catch (e: any) {
      showAlert("Erreur", "Impossible de modifier le mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDU DYNAMIQUE SELON L'ÉTAPE ---
  const renderStep = () => {
    switch (step) {
      case "IDENTIFIER":
        return (
          <>
            <Text style={styles.subtitle}>Entrez votre Email ou N° de Téléphone pour retrouver votre compte.</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Identifiant</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: moi@gmail.com ou 622..."
                autoCapitalize="none"
                value={identifier}
                onChangeText={setIdentifier}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleFindUser} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Rechercher</Text>}
            </TouchableOpacity>
          </>
        );

      case "CHANNEL_SELECT":
        return (
          <>
            <Text style={styles.subtitle}>Comment voulez-vous recevoir le code ?</Text>
            {availableChannels.map((channel) => (
              <TouchableOpacity
                key={channel}
                style={[styles.optionCard, selectedChannel === channel && styles.optionSelected]}
                onPress={() => setSelectedChannel(channel as any)}
              >
                <Ionicons name={channel === 'EMAIL' ? "mail" : "chatbubble"} size={24} color={selectedChannel === channel ? colors.primary : "#64748B"} />
                <Text style={[styles.optionText, selectedChannel === channel && {color: colors.primary, fontWeight:'bold'}]}>
                  Par {channel === 'EMAIL' ? 'Email' : 'SMS'}
                </Text>
                {selectedChannel === channel && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.button} onPress={handleChannelSelect} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Envoyer le code</Text>}
            </TouchableOpacity>
          </>
        );

      case "OTP_VERIFY":
        return (
          <>
            <Text style={styles.subtitle}>Un code a été envoyé par {selectedChannel === 'EMAIL' ? 'Email' : 'SMS'}.</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Code de vérification</Text>
              <TextInput
                style={[styles.input, {textAlign: 'center', letterSpacing: 5, fontSize: 24, fontWeight:'bold'}]}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Vérifier</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => sendOtp(userId!, selectedChannel)} disabled={loading} style={{marginTop: 15}}>
                <Text style={{textAlign:'center', color: '#64748B'}}>Renvoyer le code</Text>
            </TouchableOpacity>
          </>
        );

      case "NEW_PASSWORD":
        return (
          <>
            <Text style={styles.subtitle}>Définissez votre nouveau mot de passe.</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="••••••"
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmer</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Valider</Text>}
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "#E0F2FE" }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Header avec bouton retour */}
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
             <TouchableOpacity onPress={() => router.back()} style={{padding: 5}}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
             </TouchableOpacity>
             <Text style={styles.title}>Récupération</Text>
          </View>

          {renderStep()}

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
  title: { fontSize: 22, fontWeight: "900", color: colors.primary, marginLeft: 10 },
  subtitle: { fontSize: 15, color: "#64748B", marginBottom: 20, lineHeight: 22 },

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
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16 },

  optionCard: {
      flexDirection: 'row', alignItems: 'center',
      padding: 15, borderRadius: 12,
      borderWidth: 1, borderColor: '#E2E8F0',
      marginBottom: 10, backgroundColor: '#F8FAFC'
  },
  optionSelected: {
      borderColor: colors.primary,
      backgroundColor: '#FEF3C7' // Léger fond orange
  },
  optionText: {
      flex: 1, marginLeft: 15, fontSize: 16, color: '#334155'
  }
});