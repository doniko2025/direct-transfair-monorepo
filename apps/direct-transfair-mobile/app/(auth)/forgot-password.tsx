//apps/direct-transfair-mobile/app/(auth)/forgot-password.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#059669",
  light: "#ECFDF5",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
};

type Step = "IDENTIFIER" | "CHANNEL_SELECT" | "OTP_VERIFY" | "NEW_PASSWORD";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [step, setStep] = useState<Step>("IDENTIFIER");
  const [loading, setLoading] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<"EMAIL" | "PHONE">("EMAIL");

  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
    }
  };

  const handleFindUser = async () => {
    if (!identifier.trim()) return showAlert("Erreur", "Veuillez entrer votre email ou téléphone.");
    setLoading(true);
    try {
      const res = await api.http.post('/auth/find-account', { identifier: identifier.trim() });
      setUserId(res.data.userId);
      setAvailableChannels(res.data.channels || ['EMAIL']);
      if (res.data.channels.length > 1) {
        setStep("CHANNEL_SELECT");
      } else {
        setSelectedChannel(res.data.channels[0]);
        await sendOtp(res.data.userId, res.data.channels[0]);
      }
    } catch (e: any) {
      showAlert("Introuvable", "Aucun compte associé à cet identifiant.");
    } finally { setLoading(false); }
  };

  const sendOtp = async (uid: string, channel: string) => {
    setLoading(true);
    try {
      await api.http.post('/auth/send-otp', { userId: uid, channel });
      setStep("OTP_VERIFY");
    } catch (e: any) {
      showAlert("Erreur", "Impossible d'envoyer le code.");
    } finally { setLoading(false); }
  };

  const handleChannelSelect = () => { if (userId) sendOtp(userId, selectedChannel); };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 4) return showAlert("Erreur", "Code invalide.");
    setLoading(true);
    try {
      await api.http.post('/auth/verify-otp', { userId, code: otpCode, type: 'PASSWORD_RESET' });
      setStep("NEW_PASSWORD");
    } catch (e: any) {
      showAlert("Erreur", "Code incorrect ou expiré.");
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return showAlert("Erreur", "Minimum 6 caractères.");
    if (newPassword !== confirmPassword) return showAlert("Erreur", "Les mots de passe ne correspondent pas.");
    setLoading(true);
    try {
      await api.http.post('/auth/reset-password', { userId, code: otpCode, newPassword });
      showAlert("Succès", "Mot de passe modifié avec succès.", () => router.replace("/(auth)/login"));
    } catch (e: any) {
      showAlert("Erreur", "Impossible de modifier le mot de passe.");
    } finally { setLoading(false); }
  };

  const renderStep = () => {
    switch (step) {
      case "IDENTIFIER":
        return (
          <>
            <Text style={s.subtitle}>Entrez votre email ou numéro pour retrouver votre compte.</Text>
            <View style={s.inputContainer}>
              <Text style={s.label}>Identifiant</Text>
              <TextInput style={s.input} placeholder="ex: moi@email.com" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
            </View>
            <TouchableOpacity style={s.button} onPress={handleFindUser} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>Rechercher mon compte</Text>}
            </TouchableOpacity>
          </>
        );
      case "CHANNEL_SELECT":
        return (
          <>
            <Text style={s.subtitle}>Comment voulez-vous recevoir le code ?</Text>
            {availableChannels.map((channel) => (
              <TouchableOpacity key={channel} style={[s.optionCard, selectedChannel === channel && s.optionSelected]} onPress={() => setSelectedChannel(channel as any)}>
                <Ionicons name={channel === 'EMAIL' ? "mail" : "chatbubble"} size={24} color={selectedChannel === channel ? THEME.primary : THEME.muted} />
                <Text style={[s.optionText, selectedChannel === channel && {color: THEME.primary, fontWeight:'800'}]}>Par {channel === 'EMAIL' ? 'Email' : 'SMS'}</Text>
                {selectedChannel === channel && <Ionicons name="checkmark-circle" size={24} color={THEME.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.button} onPress={handleChannelSelect} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>Envoyer le code</Text>}
            </TouchableOpacity>
          </>
        );
      case "OTP_VERIFY":
        return (
          <>
            <Text style={s.subtitle}>Un code a été envoyé par {selectedChannel === 'EMAIL' ? 'Email' : 'SMS'}.</Text>
            <View style={s.inputContainer}>
              <Text style={s.label}>Code de vérification</Text>
              <TextInput style={[s.input, {textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight:'900'}]} placeholder="123456" keyboardType="number-pad" maxLength={6} value={otpCode} onChangeText={setOtpCode} />
            </View>
            <TouchableOpacity style={s.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>Vérifier le code</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => sendOtp(userId!, selectedChannel)} disabled={loading} style={{marginTop: 20}}>
              <Text style={{textAlign:'center', color: THEME.muted, fontFamily: FONTS.body, fontWeight: "700"}}>Renvoyer le code</Text>
            </TouchableOpacity>
          </>
        );
      case "NEW_PASSWORD":
        return (
          <>
            <Text style={s.subtitle}>Définissez votre nouveau mot de passe sécurisé.</Text>
            <View style={s.inputContainer}>
              <Text style={s.label}>Nouveau mot de passe</Text>
              <TextInput style={s.input} secureTextEntry placeholder="••••••" value={newPassword} onChangeText={setNewPassword} />
            </View>
            <View style={s.inputContainer}>
              <Text style={s.label}>Confirmer</Text>
              <TextInput style={s.input} secureTextEntry placeholder="••••••" value={confirmPassword} onChangeText={setConfirmPassword} />
            </View>
            <TouchableOpacity style={s.button} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>Valider le mot de passe</Text>}
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scrollContent, isDesktop && s.scrollContentDesktop]} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={THEME.text} />
          </TouchableOpacity>

          <View style={s.header}>
            <View style={s.iconWrap}><Ionicons name="lock-closed" size={32} color={THEME.primary} /></View>
            <Text style={s.title}>Récupération</Text>
          </View>

          <View style={s.card}>{renderStep()}</View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  scrollContentDesktop: { maxWidth: 500, alignSelf: 'center', width: '100%', paddingVertical: 40 },
  
  backBtn: { position: 'absolute', top: 20, left: 20, width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.surface, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, zIndex: 10 },
  
  header: { alignItems: 'center', marginBottom: 30, marginTop: 40 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: THEME.light, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text },
  subtitle: { fontSize: 14, fontFamily: FONTS.body, color: THEME.muted, lineHeight: 22, marginBottom: 24, textAlign: 'center' },

  card: { backgroundColor: THEME.surface, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: THEME.border },

  inputContainer: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "800", color: THEME.muted, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "transparent", borderRadius: 14, padding: 16, fontSize: 16, fontFamily: FONTS.body, color: THEME.text, fontWeight: "600" },

  button: { backgroundColor: THEME.primary, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  buttonText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },

  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, marginBottom: 12, backgroundColor: "#F8FAFC" },
  optionSelected: { borderColor: THEME.primary, backgroundColor: THEME.light },
  optionText: { flex: 1, marginLeft: 16, fontSize: 15, fontFamily: FONTS.body, color: THEME.text, fontWeight: '600' }
});