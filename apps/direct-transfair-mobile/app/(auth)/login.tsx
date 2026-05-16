// apps/direct-transfair-mobile/app/(auth)/login.tsx
// =========================================================
// LOGIN v5.2 — Direct Transf'air
// ✅ Fix outlineStyle : appliqué inline sur TextInput, pas dans StyleSheet
// ✅ Fix underlineColorAndroid : prop uniquement, jamais dans StyleSheet
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const F = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  body:    Platform.select({ ios: "System",  android: "sans-serif", default: "sans-serif" }),
};

const C = {
  g1: "#022C22", g2: "#064E3B", g3: "#065F46", g4: "#059669",
  g5: "#10B981", g6: "#34D399",
  white: "#FFFFFF", bg: "#F8FFFE",
  borderInput: "#E2E8F0", borderFocus: "#059669",
  text: "#0F172A", textSub: "#374151", textMuted: "#6B7280", textFaint: "#9CA3AF",
  danger: "#EF4444",
};

// ─── Floating Input ───────────────────────────────────────
function FloatingInput({
  label, value, onChangeText, secureTextEntry,
  keyboardType, autoCapitalize, icon,
  returnKeyType, onSubmitEditing, inputRef,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  icon: string; returnKeyType?: any; onSubmitEditing?: () => void;
  inputRef?: React.Ref<TextInput>;
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const hasValue = value.length > 0;

  return (
    <View style={[iS.wrap, focused && iS.wrapFocused]}>
      <View style={iS.iconBox}>
        <Ionicons name={icon as any} size={19} color={focused ? C.g4 : C.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        {(focused || hasValue) && (
          <Text style={[iS.floatLabel, { color: C.g4 }]}>{label.toUpperCase()}</Text>
        )}
        <TextInput
          ref={inputRef}
          // ✅ outlineStyle appliqué INLINE, jamais dans StyleSheet
          style={[
            iS.input,
            !(focused || hasValue) && { paddingVertical: 5 },
            Platform.OS === "web" && ({ outlineStyle: "none" } as any),
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused || hasValue ? "" : label}
          placeholderTextColor={C.textFaint}
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          // ✅ underlineColorAndroid uniquement comme prop
          underlineColorAndroid="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={iS.eye}>
          <Ionicons
            name={showPass ? "eye-outline" : "eye-off-outline"}
            size={19} color={C.textFaint}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const iS = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.white,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.borderInput,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  wrapFocused: { borderColor: C.borderFocus },
  iconBox:     { width: 28, alignItems: "center", marginRight: 10 },
  floatLabel:  { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 1 },
  // ✅ PAS de underlineColorAndroid ni outlineStyle ici
  input: {
    fontSize: 15, color: C.text, fontWeight: "600", paddingVertical: 0,
  },
  eye: { padding: 4 },
});

// ─── Main ─────────────────────────────────────────────────
export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const [identifier,     setIdentifier]     = useState("");
  const [password,       setPassword]       = useState("");
  const [rememberMe,     setRememberMe]     = useState(false);
  const [currentTenant,  setCurrentTenant]  = useState("DONIKO");

  const passRef  = useRef<TextInput | null>(null);
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
      return Alert.alert("Champs requis", "Veuillez renseigner vos identifiants.");
    }
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
    try {
      await login({ identifier: identifier.trim(), password } as any);
    } catch (e: any) {
      const msg  = e.response?.data?.message || "Erreur de connexion au serveur.";
      const text = Array.isArray(msg) ? msg[0] : msg;
      if (Platform.OS === "web") { alert(text); }
      else { Alert.alert("Connexion échouée", text); }
    }
  };

  const canSubmit   = identifier.trim().length > 0 && password.trim().length > 0;
  const tenantLabel = currentTenant === "DONIKO" ? "Plateforme Globale" : currentTenant;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      <View style={s.bgBase} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <Ionicons name="swap-horizontal" size={30} color={C.g4} />
            </View>
          </View>
          <Text style={[s.appName, { fontFamily: F.display }]}>Direct Transf'air</Text>
          <Text style={[s.tagline, { fontFamily: F.body }]}>Transferts internationaux sécurisés</Text>
          <View style={s.pill}>
            <View style={s.pillDot} />
            <Text style={[s.pillTxt, { fontFamily: F.body }]}>{tenantLabel}</Text>
          </View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <View style={s.cardAccent} />
          <Text style={[s.cardTitle, { fontFamily: F.display }]}>Connectez-vous</Text>
          <Text style={[s.cardSub, { fontFamily: F.body }]}>
            Saisissez votre{" "}
            <Text style={{ fontWeight: "700", color: C.text }}>email</Text>
            {" "}ou votre{" "}
            <Text style={{ fontWeight: "700", color: C.text }}>identifiant client</Text>.
          </Text>

          <View style={{ marginTop: 22 }}>
            <FloatingInput
              label="Email ou identifiant"
              value={identifier}
              onChangeText={setIdentifier}
              icon="person-outline"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />
            <FloatingInput
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              icon="lock-closed-outline"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={canSubmit ? handleLogin : undefined}
              inputRef={passRef}
            />
          </View>

          {/* Remember me */}
          <TouchableOpacity
            style={s.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <Text style={[s.rememberTxt, { fontFamily: F.body }]}>Se souvenir de moi</Text>
            <View style={[s.toggle, rememberMe && s.toggleOn]}>
              <View style={[s.thumb, rememberMe && s.thumbOn]} />
            </View>
          </TouchableOpacity>

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[s.btn, !canSubmit && s.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading || !canSubmit}
              activeOpacity={0.9}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={[s.btnTxt, { fontFamily: F.body }]}>Se connecter</Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={C.g4} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={s.forgotBtn}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={[s.forgotTxt, { fontFamily: F.body }]}>
              Identifiant ou mot de passe perdu ?
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Bottom ── */}
        <View style={s.bottom}>
          <TouchableOpacity
            style={s.registerBtn}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.9}
          >
            <Ionicons name="person-add-outline" size={18} color={C.g4} style={{ marginRight: 8 }} />
            <Text style={[s.registerTxt, { fontFamily: F.body }]}>Devenir client</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.helpRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={[s.helpTxt, { fontFamily: F.body }]}>Assistance et cookies</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.g2 },
  bgBase:    { ...StyleSheet.absoluteFillObject, backgroundColor: C.g3 },
  bgCircle1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.05)", top: -80,  right: -80 },
  bgCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", top: 120,  left: -60 },

  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 56 : 64 },

  hero:      { alignItems: "center", marginBottom: 28 },
  logoOuter: { width: 78, height: 78, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  logoInner: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.white, justifyContent: "center", alignItems: "center" },
  appName:   { fontSize: 30, color: C.white, letterSpacing: -0.4, marginBottom: 5, textAlign: "center" },
  tagline:   { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "500", marginBottom: 16, textAlign: "center" },
  pill:      { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  pillDot:   { width: 7, height: 7, borderRadius: 99, backgroundColor: C.g6 },
  pillTxt:   { color: C.white, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

  card:       { backgroundColor: C.white, borderRadius: 28, padding: 24, overflow: "hidden", shadowColor: C.g1, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, maxWidth: 520, alignSelf: "center", width: "100%" },
  cardAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: C.g4 },
  cardTitle:  { fontSize: 28, color: C.text, letterSpacing: -0.3, marginBottom: 6, marginTop: 8 },
  cardSub:    { fontSize: 13, color: C.textMuted, fontWeight: "500", lineHeight: 20 },

  rememberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  rememberTxt: { fontSize: 13, color: C.textSub, fontWeight: "600" },
  toggle:      { width: 48, height: 28, borderRadius: 14, backgroundColor: C.borderInput, justifyContent: "center", paddingHorizontal: 3 },
  toggleOn:    { backgroundColor: C.g4 },
  thumb:       { width: 22, height: 22, borderRadius: 11, backgroundColor: C.white, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  thumbOn:     { alignSelf: "flex-end" },

  btn:         { backgroundColor: C.g3, borderRadius: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: C.g3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnDisabled: { backgroundColor: "#9CA3AF", shadowOpacity: 0 },
  btnTxt:      { color: C.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  btnArrow:    { width: 28, height: 28, borderRadius: 9, backgroundColor: C.white, justifyContent: "center", alignItems: "center" },

  forgotBtn:  { alignItems: "center", paddingTop: 18, paddingBottom: 2 },
  forgotTxt:  { color: C.g4, fontSize: 13, fontWeight: "700", textDecorationLine: "underline", textDecorationColor: C.g4 },

  bottom:      { marginTop: 20, alignItems: "center", gap: 14, maxWidth: 520, alignSelf: "center", width: "100%" },
  registerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", backgroundColor: C.white, borderRadius: 16, paddingVertical: 17, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  registerTxt: { color: C.g3, fontSize: 15, fontWeight: "900" },
  helpRow:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  helpTxt:     { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "600" },
});