/////// apps/direct-transfair-mobile/app/(auth)/login.tsx
// apps/direct-transfair-mobile/app/(auth)/login.tsx
import React, { useState, useCallback, useRef } from "react";
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
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: W, height: H } = Dimensions.get("window");

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  // Brand green (inspiré Direct Transf'air + Cetelem style)
  green1: "#064E3B",
  green2: "#065F46",
  green3: "#059669",
  green4: "#34D399",
  greenSoft: "#ECFDF5",

  white: "#FFFFFF",
  offWhite: "#F9FAFB",
  border: "#E5E7EB",
  borderFocus: "#059669",

  text: "#0F172A",
  textSub: "#374151",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",

  danger: "#EF4444",
};

// ─── Animated Input ───────────────────────────────────────────────────────────
function FloatingInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  icon: string;
}) {
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

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.borderFocus],
  });

  return (
    <Animated.View style={[inputStyles.wrap, { borderColor }]}>
      <View style={inputStyles.iconBox}>
        <Ionicons name={icon as any} size={18} color={focused ? C.green3 : C.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        {(focused || value.length > 0) && (
          <Text style={inputStyles.floatingLabel}>{label}</Text>
        )}
        <TextInput
          style={[inputStyles.input, !(focused || value.length > 0) && inputStyles.inputCentered]}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={focused || value.length > 0 ? "" : label}
          placeholderTextColor={C.textFaint}
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={inputStyles.eyeBtn}>
          <Ionicons name={showPass ? "eye-outline" : "eye-off-outline"} size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  iconBox: { width: 28, alignItems: "center", marginRight: 8 },
  floatingLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.green3,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    fontSize: 15,
    color: C.text,
    fontWeight: "600",
    paddingVertical: 0,
  },
  inputCentered: {
    paddingVertical: 4,
  },
  eyeBtn: { padding: 4 },
});

// ─── Decorative Circles ──────────────────────────────────────────────────────
function BgCircles() {
  return (
    <>
      <View style={[bgStyles.circle, { width: 300, height: 300, top: -80, right: -80, opacity: 0.12 }]} />
      <View style={[bgStyles.circle, { width: 200, height: 200, top: 60, left: -60, opacity: 0.08 }]} />
      <View style={[bgStyles.circle, { width: 140, height: 140, top: H * 0.25, right: -30, opacity: 0.1 }]} />
      <View style={[bgStyles.circle, { width: 80, height: 80, top: H * 0.18, left: W * 0.3, opacity: 0.07 }]} />
    </>
  );
}

const bgStyles = StyleSheet.create({
  circle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: C.white,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [currentTenant, setCurrentTenant] = useState("DONIKO");

  // Button press animation
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
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Champs requis", "Veuillez renseigner vos identifiants.");
      return;
    }
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    try {
      await login({ email: identifier.trim(), password });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Erreur de connexion au serveur.";
      Alert.alert("Connexion échouée", Array.isArray(msg) ? msg[0] : msg);
    }
  };

  const canSubmit = identifier.trim().length > 0 && password.trim().length > 0;
  const tenantLabel = currentTenant === "DONIKO" ? "Plateforme Globale" : currentTenant;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.green1} />

      {/* ── Background ── */}
      <View style={s.bg}>
        <BgCircles />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero top ── */}
        <View style={s.heroSection}>
          {/* Logo / Icon */}
          <View style={s.logoWrap}>
            <View style={s.logoOuter}>
              <View style={s.logoInner}>
                <Ionicons name="swap-horizontal" size={28} color={C.green1} />
              </View>
            </View>
          </View>

          <Text style={s.appName}>Direct Transf'air</Text>
          <Text style={s.appTagline}>Transferts internationaux sécurisés</Text>

          {/* Tenant pill */}
          <View style={s.tenantPill}>
            <View style={s.tenantDot} />
            <Text style={s.tenantText}>{tenantLabel}</Text>
          </View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Connectez-vous</Text>
          <Text style={s.cardSub}>
            Saisissez votre <Text style={{ fontWeight: "800", color: C.text }}>email</Text> ou votre{" "}
            <Text style={{ fontWeight: "800", color: C.text }}>identifiant</Text>.
          </Text>

          <View style={{ marginTop: 22 }}>
            <FloatingInput
              label="Email ou identifiant"
              value={identifier}
              onChangeText={setIdentifier}
              icon="person-outline"
              keyboardType="email-address"
            />
            <FloatingInput
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              icon="lock-closed-outline"
              secureTextEntry
            />
          </View>

          {/* Remember me */}
          <TouchableOpacity
            style={s.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <Text style={s.rememberText}>Se souvenir de moi</Text>
            <View style={[s.toggle, rememberMe && s.toggleOn]}>
              <View style={[s.toggleThumb, rememberMe && s.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {/* Submit */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading || !canSubmit}
              activeOpacity={0.9}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={s.submitText}>Se connecter</Text>
                  <View style={s.submitArrow}>
                    <Ionicons name="arrow-forward" size={16} color={C.green1} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Forgot */}
          <TouchableOpacity style={s.forgotBtn}>
            <Text style={s.forgotText}>Identifiant ou mot de passe perdu ?</Text>
          </TouchableOpacity>
        </View>

        {/* ── Bottom actions ── */}
        <View style={s.bottomSection}>
          <TouchableOpacity style={s.registerBtn}>
            <Text style={s.registerText}>Devenir client</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.helpRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={s.helpText}>Assistance et cookies</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.green1 },

  // Background
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.green2,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 56 : 70,
    paddingBottom: 32,
  },
  logoWrap: { marginBottom: 18 },
  logoOuter: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoInner: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },
  appName: {
    fontSize: 26,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "600",
    marginBottom: 16,
  },
  tenantPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  tenantDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: C.green4,
  },
  tenantText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: "500",
    lineHeight: 20,
  },

  // Remember me
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 4,
  },
  rememberText: { fontSize: 13, color: C.textSub, fontWeight: "600" },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 99,
    backgroundColor: C.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: C.green3 },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: "flex-end" },

  // Submit
  submitBtn: {
    backgroundColor: C.green2,
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  submitArrow: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },

  // Forgot
  forgotBtn: { alignItems: "center", paddingTop: 18, paddingBottom: 4 },
  forgotText: {
    color: C.green3,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: C.green3,
  },

  // Bottom
  bottomSection: {
    marginTop: 20,
    gap: 12,
    alignItems: "center",
  },
  registerBtn: {
    width: "100%",
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
  },
  registerText: {
    color: C.green2,
    fontSize: 15,
    fontWeight: "800",
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 6,
  },
  helpText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
});