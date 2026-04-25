/////// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Dimensions, Animated, StatusBar,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: W, height: H } = Dimensions.get("window");

const FONTS = {
  heading: Platform.OS === 'ios' ? 'Cochin' : 'serif',
  body: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
};

// ─── THEME ÉMERAUDE ──────────────────────────────────────────────────────────
const C = {
  primaryDark: "#047857",
  primary: "#059669",
  primaryLight: "#10B981",
  white: "#FFFFFF",
  bg: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
};

// ─── INPUT ANIMÉ ─────────────────────────────────────────────────────────────
function FloatingInput({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, icon }: any) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.spring(borderAnim, { toValue: 1, useNativeDriver: false, speed: 30 }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.spring(borderAnim, { toValue: 0, useNativeDriver: false, speed: 30 }).start();
  };

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.primary] });

  return (
    <Animated.View style={[inputStyles.wrap, { borderColor }]}>
      <View style={inputStyles.iconBox}>
        <Ionicons name={icon} size={20} color={focused ? C.primary : C.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        {(focused || value.length > 0) && <Text style={inputStyles.floatingLabel}>{label}</Text>}
        <TextInput
          style={[inputStyles.input, !(focused || value.length > 0) && inputStyles.inputCentered]}
          value={value} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur}
          placeholder={focused || value.length > 0 ? "" : label}
          placeholderTextColor={C.textMuted}
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? "none"} autoCorrect={false}
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={inputStyles.eyeBtn}>
          <Ionicons name={showPass ? "eye-outline" : "eye-off-outline"} size={20} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  iconBox: { width: 30, alignItems: "center", marginRight: 10 },
  floatingLabel: { fontSize: 10, fontFamily: FONTS.body, fontWeight: "800", color: C.primary, letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' },
  input: { fontSize: 16, fontFamily: FONTS.body, color: C.text, fontWeight: "700", paddingVertical: 0 },
  inputCentered: { paddingVertical: 6 },
  eyeBtn: { padding: 4 },
});

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [currentTenant, setCurrentTenant] = useState("DONIKO");
  const btnScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      let t = api.getTenant();
      if (t === "10" || !t) t = "DONIKO";
      setCurrentTenant(t);
      api.setTenant(t);
    }, [])
  );

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) return Alert.alert("Champs requis", "Veuillez renseigner vos identifiants.");
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    try {
      await login({ email: identifier.trim(), password });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Erreur de connexion au serveur.";
      Platform.OS === 'web' ? alert(msg) : Alert.alert("Connexion échouée", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  const canSubmit = identifier.trim().length > 0 && password.trim().length > 0;
  const tenantLabel = currentTenant === "DONIKO" ? "Plateforme Globale" : currentTenant;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
      
      <View style={s.bg}>
        <View style={[s.circle, { width: 300, height: 300, top: -80, right: -80, opacity: 0.1 }]} />
        <View style={[s.circle, { width: 200, height: 200, top: 100, left: -60, opacity: 0.05 }]} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.heroSection}>
          <View style={s.logoWrap}>
            <Ionicons name="swap-horizontal" size={36} color={C.primary} />
          </View>
          <Text style={s.appName}>Direct Transf'air</Text>
          <Text style={s.appTagline}>Transferts internationaux sécurisés</Text>
          <View style={s.tenantPill}>
            <View style={s.tenantDot} />
            <Text style={s.tenantText}>{tenantLabel}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Connectez-vous</Text>
          <Text style={s.cardSub}>Saisissez votre email ou identifiant.</Text>

          <View style={{ marginTop: 24 }}>
            <FloatingInput label="Email ou identifiant" value={identifier} onChangeText={setIdentifier} icon="person" keyboardType="email-address" />
            <FloatingInput label="Mot de passe" value={password} onChangeText={setPassword} icon="lock-closed" secureTextEntry />
          </View>

          <TouchableOpacity style={s.rememberRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.8}>
            <Text style={s.rememberText}>Se souvenir de moi</Text>
            <View style={[s.toggle, rememberMe && s.toggleOn]}>
              <View style={[s.toggleThumb, rememberMe && s.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]} onPress={handleLogin} disabled={isLoading || !canSubmit} activeOpacity={0.9}>
              {isLoading ? <ActivityIndicator color={C.white} /> : (
                <><Text style={s.submitText}>Se connecter</Text><View style={s.submitArrow}><Ionicons name="arrow-forward" size={18} color={C.primary} /></View></>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={s.forgotText}>Identifiant ou mot de passe perdu ?</Text>
          </TouchableOpacity>
        </View>

        <View style={s.bottomSection}>
          <TouchableOpacity style={s.registerBtn} onPress={() => router.push("/(auth)/register")}>
            <Text style={s.registerText}>Devenir client</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryDark },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: C.primary },
  circle: { position: "absolute", borderRadius: 999, backgroundColor: C.white },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  
  heroSection: { alignItems: "center", paddingTop: Platform.OS === "android" ? 60 : 70, paddingBottom: 32 },
  logoWrap: { width: 70, height: 70, borderRadius: 22, backgroundColor: C.white, justifyContent: "center", alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  appName: { fontSize: 28, fontFamily: FONTS.heading, fontWeight: "800", color: C.white, marginBottom: 4 },
  appTagline: { fontSize: 14, fontFamily: FONTS.body, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginBottom: 16 },
  
  tenantPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tenantDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryLight },
  tenantText: { color: C.white, fontSize: 12, fontFamily: FONTS.body, fontWeight: "800", letterSpacing: 0.5 },

  card: { backgroundColor: C.white, borderRadius: 30, padding: 26, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8, maxWidth: 500, alignSelf: 'center', width: '100%' },
  cardTitle: { fontSize: 26, fontFamily: FONTS.heading, fontWeight: "800", color: C.text, marginBottom: 6 },
  cardSub: { fontSize: 14, fontFamily: FONTS.body, color: C.textSub, fontWeight: "500" },

  rememberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  rememberText: { fontSize: 14, fontFamily: FONTS.body, color: C.textSub, fontWeight: "700" },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: C.border, justifyContent: "center", paddingHorizontal: 3 },
  toggleOn: { backgroundColor: C.primary },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  toggleThumbOn: { alignSelf: "flex-end" },

  submitBtn: { backgroundColor: C.primary, borderRadius: 18, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  submitBtnDisabled: { backgroundColor: C.textMuted, shadowOpacity: 0 },
  submitText: { color: C.white, fontSize: 16, fontFamily: FONTS.body, fontWeight: "800", letterSpacing: 0.5 },
  submitArrow: { width: 28, height: 28, borderRadius: 10, backgroundColor: C.white, justifyContent: "center", alignItems: "center" },

  forgotBtn: { alignItems: "center", paddingTop: 20 },
  forgotText: { color: C.primary, fontSize: 14, fontFamily: FONTS.body, fontWeight: "800" },

  bottomSection: { marginTop: 24, alignItems: "center", maxWidth: 500, alignSelf: 'center', width: '100%' },
  registerBtn: { width: "100%", backgroundColor: C.white, borderRadius: 18, paddingVertical: 18, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  registerText: { color: C.primary, fontSize: 16, fontFamily: FONTS.body, fontWeight: "900" },
});