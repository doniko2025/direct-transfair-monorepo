//apps/direct-transfair-mobile/app/(tabs)/profile/security.tsx
import React, { useState, useRef } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, 
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Animated
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

const THEME = {
  primary: "#1E3A8A", // Bleu sécurité
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  success: "#059669", // Vert Émeraude
  error: "#DC2626",   // Rouge
};

export default function SecurityScreen() {
  const router = useRouter();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // ─── ÉTATS DU TOAST ANIMÉ ───
  const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' }>({
    visible: false, title: "", message: "", type: "success"
  });
  const toastAnim = useRef(new Animated.Value(-150)).current; // Commence hors de l'écran (en haut)

  const showToast = (title: string, message: string, type: 'success' | 'error' = 'success', onOk?: () => void) => {
    setToast({ visible: true, title, message, type });
    
    // Animation d'entrée (Glisse vers le bas)
    Animated.spring(toastAnim, { 
      toValue: Platform.OS === 'android' ? 50 : 60, 
      useNativeDriver: true, 
      speed: 12 
    }).start();

    // Disparition automatique après 3 secondes
    setTimeout(() => {
      Animated.timing(toastAnim, { 
        toValue: -150, 
        duration: 350, 
        useNativeDriver: true 
      }).start(() => {
        setToast(prev => ({ ...prev, visible: false }));
        if (onOk) onOk(); // Exécute l'action de retour après disparition
      });
    }, 3000);
  };

  const handleSave = async () => {
    if (!oldPass || !newPass) return showToast("Erreur", "Veuillez remplir tous les champs.", "error");
    if (newPass.length < 6) return showToast("Sécurité", "Le nouveau code doit contenir au moins 6 caractères.", "error");

    setLoading(true);
    try {
      await api.changePassword(oldPass, newPass);
      
      // ✅ APPEL DU TOAST DE SUCCÈS
      showToast("Succès", "Votre code secret a été mis à jour avec succès.", "success", () => {
        router.back();
      });
      
    } catch (e: any) {
      const err = e?.response?.data?.message || e?.message || "Impossible de modifier le code.";
      const errMsg = Array.isArray(err) ? err[0] : String(err);
      showToast("Erreur", errMsg, "error");
    } finally {
      setLoading(false);
      setOldPass("");
      setNewPass("");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      
      {/* ─── TOAST NOTIFICATION ─── */}
      <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
        <View style={[styles.toastContent, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
          <Ionicons 
            name={toast.type === 'success' ? "checkmark-circle" : "alert-circle"} 
            size={28} 
            color="#FFF" 
          />
          <View style={styles.toastTextWrap}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastMessage}>{toast.message}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ─── HEADER FIXE ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={loading}>
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sécurité</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={48} color={THEME.primary} />
          </View>
          
          <Text style={styles.heading}>Changer de code secret</Text>
          <Text style={styles.instruction}>Renforcez la sécurité de votre compte en modifiant régulièrement votre mot de passe.</Text>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ancien code secret</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={20} color={THEME.muted} style={styles.icon} />
                <TextInput 
                  style={styles.input} 
                  secureTextEntry={!showOld} 
                  value={oldPass} 
                  onChangeText={setOldPass} 
                  placeholder="••••••"
                  placeholderTextColor={THEME.muted}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowOld(!showOld)} style={styles.eyeBtn}>
                  <Ionicons name={showOld ? "eye-outline" : "eye-off-outline"} size={20} color={THEME.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nouveau code secret</Text>
              <View style={styles.inputBox}>
                <Ionicons name="key-outline" size={20} color={THEME.muted} style={styles.icon} />
                <TextInput 
                  style={styles.input} 
                  secureTextEntry={!showNew} 
                  value={newPass} 
                  onChangeText={setNewPass} 
                  placeholder="••••••"
                  placeholderTextColor={THEME.muted}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                  <Ionicons name={showNew ? "eye-outline" : "eye-off-outline"} size={20} color={THEME.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.btn, loading && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>METTRE À JOUR LE CODE</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  
  // ─── STYLES DU TOAST ───
  toastContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, alignItems: 'center', paddingHorizontal: 20 },
  toastContent: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 10, width: '100%', maxWidth: 450 },
  toastSuccess: { backgroundColor: THEME.success },
  toastError: { backgroundColor: THEME.error },
  toastTextWrap: { marginLeft: 14, flex: 1 },
  toastTitle: { color: '#FFF', fontSize: 15, fontFamily: FONTS.body, fontWeight: '800', letterSpacing: 0.5 },
  toastMessage: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: FONTS.body, fontWeight: '500', marginTop: 2, lineHeight: 18 },

  // ─── RESTE DE LA PAGE ───
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 16, paddingBottom: 16, backgroundColor: THEME.bg, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.surface, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  title: { fontSize: 20, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text },
  
  content: { padding: 24, alignItems: 'center' },
  
  iconWrap: { width: 90, height: 90, borderRadius: 30, backgroundColor: "#E0F2FE", justifyContent: "center", alignItems: "center", marginBottom: 20, shadowColor: THEME.primary, shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  heading: { fontSize: 24, fontFamily: FONTS.heading, fontWeight: "800", color: THEME.text, marginBottom: 8, textAlign: 'center' },
  instruction: { textAlign: "center", fontFamily: FONTS.body, fontSize: 14, color: THEME.muted, lineHeight: 22, marginBottom: 30, paddingHorizontal: 20 },
  
  card: { width: '100%', maxWidth: 500, backgroundColor: THEME.surface, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: THEME.border },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontFamily: FONTS.body, fontWeight: "800", color: THEME.muted, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F1F5F9", borderRadius: 16, borderWidth: 1, borderColor: "transparent" },
  icon: { paddingLeft: 16 },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 16, fontFamily: FONTS.body, color: THEME.text, fontWeight: "700", minWidth: 0 },
  eyeBtn: { padding: 16 },
  
  btn: { backgroundColor: THEME.primary, paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 10, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  btnText: { color: "#FFF", fontFamily: FONTS.body, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});