// apps/direct-transfair-mobile/app/(auth)/login.tsx
// =========================================================
// LOGIN v6.0 — Direct Transf'air
// ✅ Branding dynamique : logo, couleurs, nom, tagline
// ✅ Pill cliquable → modal pour entrer le code société
// ✅ Deep link directtransfair://CODE → auto-appliqué avant
//    l'arrivée ici (via [tenant]/index.tsx)
// =========================================================

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar, Modal, Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { useTenant } from "../../providers/TenantProvider";

// ─── Fonts ───────────────────────────────────────────────
const F = {
  display: Platform.select({ ios: "Georgia",  android: "serif",       default: "serif" }),
  body:    Platform.select({ ios: "System",   android: "sans-serif",  default: "sans-serif" }),
};

// ─── Color theme builder ──────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return isNaN(r + g + b) ? null : [r, g, b];
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

function darken(hex: string, f: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] * (1 - f), rgb[1] * (1 - f), rgb[2] * (1 - f));
}

function lighten(hex: string, f: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return toHex(
    rgb[0] + (255 - rgb[0]) * f,
    rgb[1] + (255 - rgb[1]) * f,
    rgb[2] + (255 - rgb[2]) * f,
  );
}

function buildTheme(primary: string) {
  const p = /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : "#059669";
  return {
    g1: darken(p, 0.85),   // fond très sombre (status bar)
    g2: darken(p, 0.70),   // fond sombre
    g3: darken(p, 0.45),   // fond moyen (bouton principal)
    g4: p,                 // couleur accent principale
    g5: lighten(p, 0.30),
    g6: lighten(p, 0.55),
    white:       "#FFFFFF",
    borderInput: "#E2E8F0",
    text:        "#0F172A",
    textSub:     "#374151",
    textMuted:   "#6B7280",
    textFaint:   "#9CA3AF",
    danger:      "#EF4444",
  };
}

// ─── FloatingInput ────────────────────────────────────────
function FloatingInput({
  label, value, onChangeText, secureTextEntry,
  keyboardType, autoCapitalize, icon, returnKeyType,
  onSubmitEditing, inputRef, accentColor,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  icon: string; returnKeyType?: any; onSubmitEditing?: () => void;
  inputRef?: React.Ref<TextInput>; accentColor: string;
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const hasValue = value.length > 0;

  return (
    <View style={[iS.wrap, focused && { borderColor: accentColor }]}>
      <View style={iS.iconBox}>
        <Ionicons name={icon as any} size={19} color={focused ? accentColor : "#9CA3AF"} />
      </View>
      <View style={{ flex: 1 }}>
        {(focused || hasValue) && (
          <Text style={[iS.floatLabel, { color: accentColor }]}>{label.toUpperCase()}</Text>
        )}
        <TextInput
          ref={inputRef}
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
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          underlineColorAndroid="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={iS.eye}>
          <Ionicons
            name={showPass ? "eye-outline" : "eye-off-outline"}
            size={19} color="#9CA3AF"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const iS = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 16,
    borderWidth: 1.5, borderColor: "#E2E8F0",
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  iconBox:    { width: 28, alignItems: "center", marginRight: 10 },
  floatLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, marginBottom: 1 },
  input:      { fontSize: 15, color: "#0F172A", fontWeight: "600", paddingVertical: 0 },
  eye:        { padding: 4 },
});

// ─── TenantCodeModal ─────────────────────────────────────
function TenantCodeModal({
  visible, onClose, onApply, accentColor,
}: {
  visible: boolean; onClose: () => void;
  onApply: (code: string) => Promise<void>; accentColor: string;
}) {
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true); setError("");
    try {
      await onApply(trimmed);
      setCode(""); onClose();
    } catch {
      setError("Code société introuvable ou inactif.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => { onClose(); setCode(""); setError(""); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={tcmS.overlay}>
        <View style={tcmS.sheet}>
          <View style={tcmS.handle} />
          <View style={[tcmS.iconBox, { backgroundColor: `${accentColor}15` }]}>
            <Ionicons name="business-outline" size={22} color={accentColor} />
          </View>
          <Text style={tcmS.title}>Espace Société</Text>
          <Text style={tcmS.sub}>
            Saisissez le code fourni par votre société pour charger son espace personnalisé.
          </Text>
          <TextInput
            style={[
              tcmS.input,
              code ? { borderColor: accentColor } : {},
              Platform.OS === "web" && ({ outlineStyle: "none" } as any),
            ]}
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); setError(""); }}
            placeholder="Ex : ACME · BARAKA · NAFA"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleApply}
            underlineColorAndroid="transparent"
          />
          {!!error && (
            <View style={tcmS.errorRow}>
              <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
              <Text style={tcmS.errorTxt}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              tcmS.btn,
              { backgroundColor: accentColor },
              (!code.trim() || loading) && { opacity: 0.45 },
            ]}
            onPress={handleApply}
            disabled={!code.trim() || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={tcmS.btnTxt}>ACCÉDER À MON ESPACE</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={tcmS.cancelBtn} onPress={close}>
            <Text style={tcmS.cancelTxt}>Continuer sans code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const tcmS = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  sheet:     {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 }, elevation: 20,
  },
  handle:    { width: 40, height: 4, borderRadius: 99, backgroundColor: "#E2E8F0", marginBottom: 20 },
  iconBox:   { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  title:     { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  sub:       { fontSize: 13, color: "#6B7280", fontWeight: "500", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  input:     {
    width: "100%", fontSize: 20, fontWeight: "900", color: "#0F172A",
    backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0",
    paddingVertical: 16, paddingHorizontal: 18,
    textAlign: "center", letterSpacing: 4, marginBottom: 6,
  },
  errorRow:  { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10, alignSelf: "flex-start" },
  errorTxt:  { color: "#EF4444", fontSize: 12, fontWeight: "600" },
  btn:       { width: "100%", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 10, marginBottom: 4 },
  btnTxt:    { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  cancelBtn: { paddingVertical: 14 },
  cancelTxt: { color: "#6B7280", fontWeight: "700", fontSize: 14 },
});

// ─── Main ─────────────────────────────────────────────────
export default function LoginScreen() {
  const { login, isLoading }                          = useAuth();
  const { branding, isCustomBranding, loadBranding }  = useTenant();
  const router = useRouter();

  // Thème dérivé du branding actuel
  const C = useMemo(() => buildTheme(branding.primaryColor), [branding.primaryColor]);

  const [identifier,      setIdentifier]      = useState("");
  const [password,        setPassword]        = useState("");
  const [rememberMe,      setRememberMe]      = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);

  const passRef  = useRef<TextInput | null>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  // Resync tenant à chaque focus (sécurité)
  useFocusEffect(
    useCallback(() => {
      if (branding.code !== "DONIKO") {
        void (async () => { await (api as any).setTenant?.(branding.code); })();
      }
    }, [branding.code])
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
      Platform.OS === "web" ? alert(text) : Alert.alert("Connexion échouée", text);
    }
  };

  const canSubmit  = identifier.trim().length > 0 && password.trim().length > 0;
  const appName    = branding.name;
  const tagline    = branding.tagline ?? "Transferts internationaux sécurisés";
  const pillLabel  = isCustomBranding ? branding.name : "Choisir ma société →";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* Fond dégradé dynamique */}
      <View style={[sL.bgBase, { backgroundColor: C.g3 }]} />
      <View style={sL.bgCircle1} />
      <View style={sL.bgCircle2} />

      <ScrollView
        contentContainerStyle={sL.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══ HERO ══ */}
        <View style={sL.hero}>

          {/* Logo */}
          <View style={sL.logoOuter}>
            <View style={sL.logoInner}>
              {branding.logoUrl ? (
                <Image
                  source={{ uri: branding.logoUrl }}
                  style={{ width: 46, height: 46, borderRadius: 10 }}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="swap-horizontal" size={30} color={C.g4} />
              )}
            </View>
          </View>

          <Text style={[sL.appName, { fontFamily: branding.fontFamily ?? F.display }]}>
            {appName}
          </Text>
          <Text style={[sL.tagline, { fontFamily: F.body }]}>{tagline}</Text>

          {/* Pill — cliquable pour changer de société */}
          <TouchableOpacity
            style={sL.pill}
            onPress={() => setShowTenantModal(true)}
            activeOpacity={0.8}
          >
            <View style={[sL.pillDot, { backgroundColor: isCustomBranding ? "#4ADE80" : "#FCD34D" }]} />
            <Text style={[sL.pillTxt, { fontFamily: F.body }]}>{pillLabel}</Text>
            <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* ══ CARD ══ */}
        <View style={[sL.card, { shadowColor: C.g1 }]}>
          <View style={[sL.cardAccent, { backgroundColor: C.g4 }]} />

          <Text style={[sL.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>
            Connectez-vous
          </Text>
          <Text style={[sL.cardSub, { fontFamily: F.body }]}>
            {branding.welcomeMessage ?? (
              `Saisissez votre email ou votre identifiant ${appName}.`
            )}
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
              accentColor={C.g4}
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
              accentColor={C.g4}
            />
          </View>

          {/* Remember me */}
          <TouchableOpacity
            style={sL.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <Text style={[sL.rememberTxt, { fontFamily: F.body }]}>Se souvenir de moi</Text>
            <View style={[sL.toggle, rememberMe && { backgroundColor: C.g4 }]}>
              <View style={[sL.thumb, rememberMe && sL.thumbOn]} />
            </View>
          </TouchableOpacity>

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[
                sL.btn,
                { backgroundColor: C.g3, shadowColor: C.g3 },
                !canSubmit && sL.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !canSubmit}
              activeOpacity={0.9}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={[sL.btnTxt, { fontFamily: F.body }]}>Se connecter</Text>
                  <View style={sL.btnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={C.g4} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={sL.forgotBtn}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={[sL.forgotTxt, { color: C.g4, fontFamily: F.body }]}>
              Identifiant ou mot de passe perdu ?
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══ BOTTOM ══ */}
        <View style={sL.bottom}>
          <TouchableOpacity
            style={sL.registerBtn}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.9}
          >
            <Ionicons name="person-add-outline" size={18} color={C.g4} style={{ marginRight: 8 }} />
            <Text style={[sL.registerTxt, { color: C.g3, fontFamily: F.body }]}>
              Devenir client
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={sL.helpRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={[sL.helpTxt, { fontFamily: F.body }]}>Assistance et cookies</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal code société */}
      <TenantCodeModal
        visible={showTenantModal}
        onClose={() => setShowTenantModal(false)}
        onApply={loadBranding}
        accentColor={C.g4}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles layout (sans couleurs) ───────────────────────
const sL = StyleSheet.create({
  bgBase:      { ...StyleSheet.absoluteFillObject },
  bgCircle1:   { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.05)", top: -80, right: -80 },
  bgCircle2:   { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", top: 120, left: -60 },
  scroll:      { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 56 : 64 },

  hero:        { alignItems: "center", marginBottom: 28 },
  logoOuter:   { width: 78, height: 78, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  logoInner:   { width: 58, height: 58, borderRadius: 19, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  appName:     { fontSize: 30, color: "#FFFFFF", letterSpacing: -0.4, marginBottom: 5, textAlign: "center" },
  tagline:     { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "500", marginBottom: 16, textAlign: "center" },
  pill:        { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  pillDot:     { width: 7, height: 7, borderRadius: 99 },
  pillTxt:     { color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

  card:        { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 24, overflow: "hidden", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, maxWidth: 520, alignSelf: "center", width: "100%" },
  cardAccent:  { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  cardTitle:   { fontSize: 28, color: "#0F172A", letterSpacing: -0.3, marginBottom: 6, marginTop: 8 },
  cardSub:     { fontSize: 13, color: "#6B7280", fontWeight: "500", lineHeight: 20 },

  rememberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  rememberTxt: { fontSize: 13, color: "#374151", fontWeight: "600" },
  toggle:      { width: 48, height: 28, borderRadius: 14, backgroundColor: "#E2E8F0", justifyContent: "center", paddingHorizontal: 3 },
  thumb:       { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  thumbOn:     { alignSelf: "flex-end" },

  btn:         { borderRadius: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnDisabled: { backgroundColor: "#9CA3AF", shadowOpacity: 0 },
  btnTxt:      { color: "#FFFFFF", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  btnArrow:    { width: 28, height: 28, borderRadius: 9, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },

  forgotBtn:   { alignItems: "center", paddingTop: 18, paddingBottom: 2 },
  forgotTxt:   { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },

  bottom:      { marginTop: 20, alignItems: "center", gap: 14, maxWidth: 520, alignSelf: "center", width: "100%" },
  registerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 17, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  registerTxt: { fontSize: 15, fontWeight: "900" },
  helpRow:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  helpTxt:     { color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "600" },
});