// apps/direct-transfair-mobile/app/(auth)/register.tsx
// =========================================================
// REGISTER v5.8 — Direct Transf'air
// ✅ v5.7 conservé intégralement (CGU checkbox)
// ✅ v5.8 : CORRECTIFS MAJEURS
//
//   FIX 1 — catch block : plus de succès sur erreur réseau
//     AVANT : catch appelait setShowSuccess(true) même quand
//     status === undefined (erreur réseau, timeout, CORS).
//     L'utilisateur croyait son compte créé alors que ce n'était pas le cas.
//     APRÈS : erreur réseau → Alert explicite "Vérifiez votre connexion".
//
//   FIX 2 — Navigation directe vers verify-contact
//     AVANT : "Accéder à mon compte" → /(tabs)/home → auth guard
//     → verify-contact. Risque de perte des params userId.
//     APRÈS : on stocke registeredUser en local state depuis
//     le retour de registerUser() (AuthProvider v6.1 retourne
//     AuthUser | null). "Vérifier mon email" navigue directement
//     vers verify-contact avec userId garanti.
//
//   FIX 3 — SuccessModal mis à jour
//     Texte et bouton mentionnent la vérification email
//     pour préparer l'utilisateur à l'étape suivante.
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { useTenant } from "../../providers/TenantProvider";

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
  danger: "#EF4444", dangerSoft: "#FEF2F2",
  section1: "#1E40AF", section1Soft: "#EFF6FF",
  section2: "#059669", section2Soft: "#ECFDF5",
  section3: "#D97706", section3Soft: "#FFFBEB",
  section4: "#7C3AED", section4Soft: "#F5F3FF",
};

const COUNTRIES = [
  "Afghanistan","Algérie","Allemagne","Angola","Arabie Saoudite","Argentine",
  "Belgique","Bénin","Brésil","Burkina Faso","Cameroun","Canada","Cap-Vert",
  "Centrafrique","Chine","Comores","Congo","Côte d'Ivoire","Djibouti","Égypte",
  "Espagne","États-Unis","Éthiopie","France","Gabon","Gambie","Ghana","Guinée",
  "Guinée Bissau","Guinée Équatoriale","Italie","Japon","Kenya","Liberia","Libye",
  "Madagascar","Mali","Maroc","Mauritanie","Mozambique","Namibie","Niger","Nigéria",
  "Oman","Pays-Bas","Portugal","Qatar","République Démocratique du Congo",
  "Royaume-Uni","Rwanda","Sénégal","Sierra Leone","Somalie","Soudan","Suisse",
  "Tanzanie","Tchad","Togo","Tunisie","Turquie","Uganda","Zimbabwe",
].sort();

const COUNTRY_CODES: Record<string, string> = {
  "Guinée":"+224","France":"+33","Sénégal":"+221","Mali":"+223",
  "Côte d'Ivoire":"+225","Cameroun":"+237","Bénin":"+229",
  "Burkina Faso":"+226","Togo":"+228","Niger":"+227",
  "Nigéria":"+234","Ghana":"+233","Sierra Leone":"+232",
  "Liberia":"+231","Gambie":"+220","Guinée Bissau":"+245",
  "Cap-Vert":"+238","États-Unis":"+1","Canada":"+1",
  "Belgique":"+32","Royaume-Uni":"+44","Espagne":"+34",
  "Italie":"+39","Portugal":"+351","Allemagne":"+49",
  "Maroc":"+212","Algérie":"+213","Tunisie":"+216",
};

const REAL_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 500]);

// ─── Type local pour le user post-inscription ─────────────
type RegisteredUser = {
  id:    string;
  phone: string | null;
};

// ─── Popup Succès v5.8 ────────────────────────────────────
// Texte et bouton mis à jour pour préparer à la vérification email
function SuccessModal({
  visible,
  onContinue,
  hasPhone,
}: {
  visible:    boolean;
  onContinue: () => void;
  hasPhone:   boolean;
}) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.8);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={sm.overlay}>
        <Animated.View style={[sm.card, { opacity, transform: [{ scale }] }]}>
          <View style={sm.iconOuter}>
            <View style={sm.iconInner}>
              <Ionicons name="checkmark" size={36} color={C.white} />
            </View>
          </View>

          <Text style={[sm.title, { fontFamily: F.display }]}>Compte créé !</Text>

          <Text style={[sm.sub, { fontFamily: F.body }]}>
            Bienvenue sur Direct Transf'air.{"\n"}
            Un code de vérification a été envoyé à votre adresse email.
            {hasPhone ? "\nVérifiez aussi votre téléphone." : ""}
          </Text>

          {/* Badge info étape suivante */}
          <View style={sm.badge}>
            <Ionicons name="mail-outline" size={14} color={C.g4} />
            <Text style={[sm.badgeTxt, { fontFamily: F.body }]}>
              Vérification requise avant de vous connecter
            </Text>
          </View>

          <View style={sm.divider} />

          <TouchableOpacity style={sm.btn} onPress={onContinue} activeOpacity={0.88}>
            <Ionicons name="mail-outline" size={16} color={C.white} />
            <Text style={[sm.btnTxt, { fontFamily: F.body }]}>Vérifier mon email</Text>
            <Ionicons name="arrow-forward" size={16} color={C.white} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(2,44,34,0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  card:     { backgroundColor: C.white, borderRadius: 28, padding: 32, width: "100%", maxWidth: 380, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  iconOuter:{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  iconInner:{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.g4, justifyContent: "center", alignItems: "center" },
  title:    { fontSize: 26, color: C.text, marginBottom: 10, textAlign: "center" },
  sub:      { fontSize: 14, color: C.textMuted, textAlign: "center", lineHeight: 22, fontWeight: "500", marginBottom: 16 },
  badge:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: 20 },
  badgeTxt: { fontSize: 12, color: C.g4, fontWeight: "600" },
  divider:  { width: "100%", height: 1, backgroundColor: "#F1F5F9", marginBottom: 20 },
  btn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.g3, borderRadius: 16, paddingVertical: 16, width: "100%" },
  btnTxt:   { color: C.white, fontSize: 15, fontWeight: "700" },
});

// ─── Field Input ─────────────────────────────────────────
function FieldInput({
  label, value, onChangeText, placeholder, icon,
  secureTextEntry, keyboardType, autoCapitalize,
  multiline, maxLength, returnKeyType, onSubmitEditing,
  inputRef, editable = true,
}: {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; icon?: string; secureTextEntry?: boolean;
  keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
  maxLength?: number; returnKeyType?: any; onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>; editable?: boolean;
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={[fS.label, { fontFamily: F.body }]}>{label}</Text>}
      <View style={[fS.wrap, focused && fS.wrapFocused, !editable && fS.disabled]}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={17}
            color={focused ? C.g4 : C.textFaint}
            style={{ marginRight: 8 }}
          />
        )}
        <TextInput
          ref={inputRef}
          style={[
            fS.input, { fontFamily: F.body },
            multiline && fS.multiline,
            Platform.OS === "web" && ({ outlineStyle: "none" } as any),
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? label}
          placeholderTextColor={C.textFaint}
          secureTextEntry={secureTextEntry && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "words"}
          autoCorrect={false}
          multiline={multiline}
          maxLength={maxLength}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          underlineColorAndroid="transparent"
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={fS.eye}>
            <Ionicons
              name={showPass ? "eye-outline" : "eye-off-outline"}
              size={17}
              color={C.textFaint}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const fS = StyleSheet.create({
  label:      { fontSize: 11, fontWeight: "700", color: C.textSub, marginBottom: 6, letterSpacing: 0.3 },
  wrap:       { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  wrapFocused:{ borderColor: C.borderFocus },
  disabled:   { backgroundColor: "#F9FAFB", opacity: 0.7 },
  input:      { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  multiline:  { minHeight: 60, textAlignVertical: "top" },
  eye:        { padding: 4 },
});

// ─── Date Input ───────────────────────────────────────────
function DateBox({ value, onChangeText, placeholder, maxLength }: {
  value: string; onChangeText: (v: string) => void;
  placeholder: string; maxLength: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        db.input,
        focused && { borderColor: C.borderFocus },
        Platform.OS === "web" && ({ outlineStyle: "none" } as any),
      ]}
      value={value}
      onChangeText={(v) => onChangeText(v.replace(/\D/g, "").slice(0, maxLength))}
      placeholder={placeholder}
      placeholderTextColor={C.textFaint}
      keyboardType="numeric"
      maxLength={maxLength}
      textAlign="center"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      underlineColorAndroid="transparent"
    />
  );
}

const db = StyleSheet.create({
  input: {
    width: "100%",
    fontSize: 15, color: C.text, fontWeight: "600",
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.borderInput,
    paddingVertical: 14, paddingHorizontal: 8,
  },
});

// ─── Select Field ─────────────────────────────────────────
function SelectField({ label, value, placeholder, onPress, icon }: {
  label?: string; value: string; placeholder: string; onPress: () => void; icon?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={[fS.label, { fontFamily: F.body }]}>{label}</Text>}
      <TouchableOpacity style={sS.wrap} onPress={onPress} activeOpacity={0.8}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={17}
            color={value ? C.g4 : C.textFaint}
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={[sS.txt, { fontFamily: F.body }, !value && sS.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

const sS = StyleSheet.create({
  wrap:       { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 14, paddingVertical: 14 },
  txt:        { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  placeholder:{ color: C.textFaint, fontWeight: "400" },
});

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ number, title, subtitle, color, bgColor }: {
  number: string; title: string; subtitle: string; color: string; bgColor: string;
}) {
  return (
    <View style={[shS.wrap, { backgroundColor: bgColor, borderLeftColor: color }]}>
      <View style={[shS.num, { backgroundColor: color }]}>
        <Text style={[shS.numTxt, { fontFamily: F.body }]}>{number}</Text>
      </View>
      <View>
        <Text style={[shS.title, { fontFamily: F.display, color }]}>{title}</Text>
        <Text style={[shS.sub, { fontFamily: F.body }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const shS = StyleSheet.create({
  wrap:   { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderLeftWidth: 4, padding: 14, marginBottom: 16 },
  num:    { width: 30, height: 30, borderRadius: 99, justifyContent: "center", alignItems: "center" },
  numTxt: { color: C.white, fontSize: 13, fontWeight: "900" },
  title:  { fontSize: 16, letterSpacing: -0.2, lineHeight: 20 },
  sub:    { fontSize: 11, color: C.textMuted, marginTop: 1 },
});

// ─── Country Picker ───────────────────────────────────────
function CountryPicker({ visible, onSelect, onClose, title }: {
  visible: boolean; onSelect: (c: string) => void; onClose: () => void; title: string;
}) {
  const [search, setSearch] = useState("");
  if (!visible) return null;
  const filtered = COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={cpS.overlay}>
      <View style={cpS.sheet}>
        <View style={cpS.header}>
          <Text style={[cpS.title, { fontFamily: F.display }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={cpS.closeBtn}>
            <Ionicons name="close" size={20} color={C.textSub} />
          </TouchableOpacity>
        </View>
        <View style={cpS.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.textFaint} />
          <TextInput
            style={[
              cpS.searchInput, { fontFamily: F.body },
              Platform.OS === "web" && ({ outlineStyle: "none" } as any),
            ]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un pays..."
            placeholderTextColor={C.textFaint}
            autoFocus
            underlineColorAndroid="transparent"
          />
        </View>
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          {filtered.map((c) => (
            <TouchableOpacity
              key={c}
              style={cpS.item}
              onPress={() => { onSelect(c); setSearch(""); onClose(); }}
            >
              <Text style={[cpS.itemTxt, { fontFamily: F.body }]}>{c}</Text>
              {COUNTRY_CODES[c] && (
                <Text style={[cpS.code, { fontFamily: F.body }]}>{COUNTRY_CODES[c]}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const cpS = StyleSheet.create({
  overlay:    { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 100 },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20, maxHeight: "75%" },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18 },
  title:      { fontSize: 22, color: C.text },
  closeBtn:   { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchInput:{ flex: 1, fontSize: 14, color: C.text },
  item:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemTxt:    { fontSize: 14, color: C.text, fontWeight: "600" },
  code:       { fontSize: 12, color: C.textMuted },
});

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const { register: registerUser } = useAuth();
  const { branding } = useTenant();
  const router = useRouter();

  // ── Champs formulaire ────────────────────────────────────
  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [country,   setCountry]   = useState("Guinée");
  const [city,      setCity]      = useState("");
  const [phoneCode, setPhoneCode] = useState("+224");
  const [phone,     setPhone]     = useState("");

  const [addressStreet, setAddressStreet] = useState("");
  const [postalCode,    setPostalCode]    = useState("");
  const [addressCity,   setAddressCity]   = useState("");

  const [nationality,  setNationality]  = useState("Guinée");
  const [birthDay,     setBirthDay]     = useState("");
  const [birthMonth,   setBirthMonth]   = useState("");
  const [birthYear,    setBirthYear]    = useState("");
  const [birthCity,    setBirthCity]    = useState("");
  const [birthCountry, setBirthCountry] = useState("");

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [picker,      setPicker]      = useState<null | "country" | "nationality" | "birthCountry">(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const btnScale = useRef(new Animated.Value(1)).current;

  // ✅ v5.8 : stocke les infos du user créé pour naviguer vers verify-contact
  const [registeredUser, setRegisteredUser] = useState<RegisteredUser | null>(null);

  const handleCountrySelect = (c: string) => {
    if (picker === "country") {
      setCountry(c);
      setPhoneCode(COUNTRY_CODES[c] || "+");
    } else if (picker === "nationality") {
      setNationality(c);
    } else if (picker === "birthCountry") {
      setBirthCountry(c);
    }
  };

  const birthDate = birthDay && birthMonth && birthYear
    ? `${birthDay.padStart(2, "0")}/${birthMonth.padStart(2, "0")}/${birthYear}`
    : "";

  const canSubmit = Boolean(
    firstName.trim() && lastName.trim() && email.trim() &&
    password.trim() && password === confirmPassword &&
    country && city.trim() && phone.trim() &&
    nationality && birthDay && birthMonth && birthYear &&
    termsAccepted
  );

  const handleRegister = async () => {
    if (!termsAccepted) {
      Alert.alert(
        "Conditions requises",
        "Vous devez accepter les Conditions générales et la Politique de confidentialité pour créer votre compte.",
      );
      return;
    }
    if (!canSubmit) {
      Alert.alert("Formulaire incomplet", "Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mots de passe", "Les mots de passe ne correspondent pas.");
      return;
    }
    if (birthYear.length !== 4) {
      Alert.alert("Date invalide", "L'année de naissance doit comporter 4 chiffres.");
      return;
    }

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();

    setSubmitting(true);

    try {
      const payload = {
        firstName:     firstName.trim(),
        lastName:      lastName.trim(),
        email:         email.trim().toLowerCase(),
        password,
        phone:         `${phoneCode}${phone.trim()}`,
        country,
        city:          city.trim(),
        nationality,
        birthDate,
        birthPlace:    birthCity.trim(),
        birthCity:     birthCity.trim(),
        birthCountry,
        addressStreet: addressStreet.trim(),
        postalCode:    postalCode.trim(),
        addressCity:   addressCity.trim() || city.trim(),
      };

      // ✅ v5.8 : registerUser() retourne AuthUser | null (AuthProvider v6.1)
      const result = await registerUser(payload as any);

      if (result) {
        const u = result as any;
        setRegisteredUser({
          id:    u.id,
          phone: u.phone ?? null,
        });
      }

      setShowSuccess(true);

    } catch (e: any) {
      const status = e?.response?.status;

      if (status && REAL_ERROR_STATUSES.has(status)) {
        // Erreur métier (400 doublon email, 409 conflit, etc.)
        const raw = e?.response?.data?.message || e?.message || "Erreur inconnue.";
        const msg = Array.isArray(raw) ? raw[0] : String(raw);
        Alert.alert("Inscription échouée", msg);
        return;
      }

      // ✅ v5.8 FIX : erreur réseau → message explicite (AVANT : setShowSuccess(true) = DANGEREUX)
      const isNetwork =
        !status ||
        e?.message?.toLowerCase().includes("network") ||
        e?.code === "ECONNABORTED";

      Alert.alert(
        isNetwork ? "Erreur de connexion" : "Erreur inattendue",
        isNetwork
          ? "Impossible de créer le compte. Vérifiez votre connexion internet et réessayez."
          : (e?.message ?? "Une erreur est survenue. Réessayez."),
      );

    } finally {
      setSubmitting(false);
    }
  };

  // ✅ v5.8 : navigation directe vers verify-contact (plus de passage par /(tabs)/home)
  const handleSuccessContinue = () => {
    setShowSuccess(false);
    if (registeredUser) {
      router.replace({
        pathname: "/(auth)/verify-contact",
        params: {
          userId:        registeredUser.id,
          emailVerified: "0",   // Freshly registered → email jamais vérifié
          phoneVerified: registeredUser.phone ? "0" : "1",
          hasPhone:      registeredUser.phone ? "1" : "0",
        },
      } as any);
    } else {
      // Fallback sécurisé (ne devrait pas arriver)
      router.replace("/(tabs)/home" as any);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={r.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />
      <View style={r.bgBase} />
      <View style={r.bgCircle} />

      <SuccessModal
        visible={showSuccess}
        onContinue={handleSuccessContinue}
        hasPhone={!!phone.trim()}
      />

      <CountryPicker
        visible={picker !== null}
        title={
          picker === "country"      ? "Pays de résidence" :
          picker === "nationality"  ? "Nationalité" :
                                      "Pays de naissance"
        }
        onSelect={handleCountrySelect}
        onClose={() => setPicker(null)}
      />

      <View style={r.header}>
        <TouchableOpacity
          style={r.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[r.headerTitle, { fontFamily: F.display }]}>Créer un compte</Text>
          <Text style={[r.headerSub, { fontFamily: F.body }]}>
            {branding.name} — Inscription
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={r.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section 1 : Identité ── */}
        <SectionHeader
          number="1"
          title="Identité personnelle"
          subtitle="Vos informations de base"
          color={C.section1}
          bgColor={C.section1Soft}
        />
        <FieldInput
          label="Prénom *"
          value={firstName}
          onChangeText={setFirstName}
          icon="person-outline"
          placeholder="Prénom"
        />
        <FieldInput
          label="Nom *"
          value={lastName}
          onChangeText={setLastName}
          icon="person-outline"
          placeholder="Nom de famille"
          autoCapitalize="characters"
        />
        <FieldInput
          label="Adresse email *"
          value={email}
          onChangeText={setEmail}
          icon="mail-outline"
          placeholder="email@exemple.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FieldInput
          label="Mot de passe *"
          value={password}
          onChangeText={setPassword}
          icon="lock-closed-outline"
          placeholder="6 caractères minimum"
          secureTextEntry
          returnKeyType="next"
        />
        <FieldInput
          label="Confirmer le mot de passe *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          icon="lock-closed-outline"
          placeholder="Répéter le mot de passe"
          secureTextEntry
          returnKeyType="done"
        />

        {password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword && (
          <View style={r.errorRow}>
            <Ionicons name="alert-circle" size={14} color={C.danger} />
            <Text style={[r.errorTxt, { fontFamily: F.body }]}>
              Les mots de passe ne correspondent pas
            </Text>
          </View>
        )}

        <View style={r.divider} />

        {/* ── Section 2 : Contact ── */}
        <SectionHeader
          number="2"
          title="Informations de contact"
          subtitle="Pays, ville et téléphone"
          color={C.section2}
          bgColor={C.section2Soft}
        />
        <SelectField
          label="Pays de résidence *"
          value={country}
          placeholder="Sélectionner votre pays"
          onPress={() => setPicker("country")}
          icon="location-outline"
        />
        <FieldInput
          label="Ville de résidence *"
          value={city}
          onChangeText={setCity}
          icon="business-outline"
          placeholder="Ex: Conakry"
        />

        <Text style={[fS.label, { fontFamily: F.body }]}>Téléphone *</Text>
        <View style={r.phoneRow}>
          <TouchableOpacity
            style={r.phoneCode}
            onPress={() => setPicker("country")}
            activeOpacity={0.8}
          >
            <Text style={[r.phoneCodeTxt, { fontFamily: F.body }]}>{phoneCode}</Text>
            <Ionicons name="chevron-down" size={12} color={C.textFaint} />
          </TouchableOpacity>
          <TextInput
            style={[
              r.phoneInput, { fontFamily: F.body },
              Platform.OS === "web" && ({ outlineStyle: "none" } as any),
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder="6 12 34 56 78"
            placeholderTextColor={C.textFaint}
            keyboardType="phone-pad"
            underlineColorAndroid="transparent"
          />
        </View>

        <View style={r.divider} />

        {/* ── Section 3 : Adresse ── */}
        <SectionHeader
          number="3"
          title="Adresse de résidence"
          subtitle="Rue, code postal, ville"
          color={C.section3}
          bgColor={C.section3Soft}
        />
        <FieldInput
          label="Adresse complète"
          value={addressStreet}
          onChangeText={setAddressStreet}
          icon="home-outline"
          placeholder="12 Rue des Lilas..."
        />
        <View style={r.twoCol}>
          <View style={{ flex: 0.4 }}>
            <FieldInput
              label="Code postal"
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numeric"
              placeholder="75001"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <FieldInput
              label="Ville (si différente)"
              value={addressCity}
              onChangeText={setAddressCity}
              placeholder={city || "Ex: Paris"}
            />
          </View>
        </View>

        <View style={r.divider} />

        {/* ── Section 4 : État civil ── */}
        <SectionHeader
          number="4"
          title="État civil et Origine"
          subtitle="Nationalité et date de naissance"
          color={C.section4}
          bgColor={C.section4Soft}
        />
        <SelectField
          label="Nationalité *"
          value={nationality}
          placeholder="Sélectionner votre nationalité"
          onPress={() => setPicker("nationality")}
          icon="flag-outline"
        />

        <Text style={[fS.label, { fontFamily: F.body }]}>Date de naissance *</Text>
        <View style={r.dateRow}>
          <View style={{ flex: 1 }}>
            <DateBox
              value={birthDay}
              onChangeText={setBirthDay}
              placeholder="JJ"
              maxLength={2}
            />
          </View>
          <Text style={r.dateSep}>/</Text>
          <View style={{ flex: 1 }}>
            <DateBox
              value={birthMonth}
              onChangeText={setBirthMonth}
              placeholder="MM"
              maxLength={2}
            />
          </View>
          <Text style={r.dateSep}>/</Text>
          <View style={{ flex: 2 }}>
            <DateBox
              value={birthYear}
              onChangeText={setBirthYear}
              placeholder="AAAA"
              maxLength={4}
            />
          </View>
        </View>

        <SelectField
          label="Pays de naissance"
          value={birthCountry}
          placeholder="Sélectionner..."
          onPress={() => setPicker("birthCountry")}
          icon="globe-outline"
        />
        <FieldInput
          label="Ville / Lieu de naissance"
          value={birthCity}
          onChangeText={setBirthCity}
          icon="business-outline"
          placeholder="Ex: Conakry"
        />

        <View style={r.divider} />

        {/* ── Checkbox CGU (v5.7) ── */}
        <View style={[r.checkCard, termsAccepted && r.checkCardActive]}>
          <View style={r.checkRow}>
            <TouchableOpacity
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.75}
              hitSlop={10}
              style={r.checkboxHit}
            >
              <View style={[r.checkbox, termsAccepted && r.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={13} color={C.white} />}
              </View>
            </TouchableOpacity>
            <Text style={[r.checkTxt, { fontFamily: F.body }]}>
              {"J'ai lu et j'accepte les "}
              <Text
                style={r.checkLink}
                onPress={() => router.push("/(auth)/terms")}
              >
                {"Conditions générales d'utilisation"}
              </Text>
              {" et la "}
              <Text
                style={r.checkLink}
                onPress={() => router.push("/(auth)/privacy-policy")}
              >
                {"Politique de confidentialité"}
              </Text>
              {" de Direct Transf'air."}
            </Text>
          </View>
          {!termsAccepted && (
            <View style={r.checkHint}>
              <Ionicons name="information-circle-outline" size={12} color={C.g4} />
              <Text style={[r.checkHintTxt, { fontFamily: F.body }]}>
                Obligatoire pour créer votre compte
              </Text>
            </View>
          )}
        </View>

        {/* ── Bouton CTA ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[r.submitBtn, (!canSubmit || submitting) && r.submitDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit || submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                <Text style={[r.submitTxt, { fontFamily: F.body }]}>
                  CRÉER MON COMPTE
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={r.loginRow}>
          <Text style={[r.loginTxt, { fontFamily: F.body }]}>Déjà un compte ?</Text>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login-v2" as any)}
            hitSlop={8}
          >
            <Text style={[r.loginLink, { fontFamily: F.body }]}>Se connecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const r = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  bgBase:      { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.g1, zIndex: -2 },
  bgCircle:    { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: C.g2, top: -100, right: -80, zIndex: -1 },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 56, paddingBottom: 18, gap: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: C.white, fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  scroll:      { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, backgroundColor: C.bg },
  divider:     { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20 },
  twoCol:      { flexDirection: "row", alignItems: "flex-start" },
  phoneRow:    { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, overflow: "hidden", marginBottom: 12 },
  phoneCode:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRightWidth: 1.5, borderRightColor: C.borderInput, paddingHorizontal: 12, paddingVertical: 14 },
  phoneCodeTxt:{ fontSize: 14, color: C.text, fontWeight: "700" },
  phoneInput:  { flex: 1, fontSize: 14, color: C.text, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 14 },
  dateRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, width: "100%" },
  dateSep:     { fontSize: 20, color: C.textMuted, fontWeight: "600" },
  errorRow:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.dangerSoft, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#FECACA" },
  errorTxt:    { fontSize: 12, color: C.danger, fontWeight: "600" },
  checkCard:       { backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, padding: 16, marginBottom: 16 },
  checkCardActive: { borderColor: C.g4, backgroundColor: "#F0FDF4" },
  checkRow:        { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkboxHit:     { paddingTop: 2 },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.borderInput, backgroundColor: C.white, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  checkboxChecked: { backgroundColor: C.g4, borderColor: C.g4 },
  checkTxt:        { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 20, fontWeight: "500" },
  checkLink:       { color: C.g4, fontWeight: "700", textDecorationLine: "underline" },
  checkHint:       { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  checkHintTxt:    { fontSize: 11, color: C.g4, fontWeight: "600" },
  submitBtn:     { backgroundColor: C.g3, borderRadius: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: C.g3, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  submitDisabled:{ backgroundColor: "#9CA3AF", shadowOpacity: 0 },
  submitTxt:     { color: C.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  loginRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 },
  loginTxt:  { fontSize: 14, color: C.textMuted, fontWeight: "500" },
  loginLink: { fontSize: 14, color: C.g4, fontWeight: "700" },
});