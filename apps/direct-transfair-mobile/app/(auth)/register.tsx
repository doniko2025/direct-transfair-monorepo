// apps/direct-transfair-mobile/app/(auth)/register.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: W } = Dimensions.get("window");

const F = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "sans-serif" }),
};

const C = {
  g1: "#022C22", g2: "#064E3B", g3: "#065F46", g4: "#059669",
  g5: "#10B981", g6: "#34D399", gSoft: "#ECFDF5",
  white: "#FFFFFF", bg: "#F8FFFE",
  border: "#D1FAE5", borderInput: "#E2E8F0",
  text: "#0F172A", textSub: "#374151", textMuted: "#6B7280", textFaint: "#9CA3AF",
  danger: "#EF4444", dangerSoft: "#FEF2F2",
  section1: "#1E40AF", section1Soft: "#EFF6FF",
  section2: "#059669", section2Soft: "#ECFDF5",
  section3: "#7C3AED", section3Soft: "#F5F3FF",
};

// Pays africains + principaux (simplifiée)
const COUNTRIES = [
  "Afghanistan", "Algérie", "Allemagne", "Angola", "Arabie Saoudite",
  "Argentine", "Belgique", "Bénin", "Brésil", "Burkina Faso",
  "Cameroun", "Canada", "Cap-Vert", "Centrafrique", "Chine",
  "Comores", "Congo", "Côte d'Ivoire", "Djibouti", "Égypte",
  "Espagne", "États-Unis", "Éthiopie", "France", "Gabon",
  "Gambie", "Ghana", "Guinée", "Guinée Bissau", "Guinée Équatoriale",
  "Italie", "Japon", "Kenya", "Liberia", "Libye",
  "Madagascar", "Mali", "Maroc", "Mauritanie", "Mozambique",
  "Namibie", "Niger", "Nigéria", "Oman", "Pays-Bas",
  "Portugal", "Qatar", "République Démocratique du Congo", "Royaume-Uni",
  "Rwanda", "Sénégal", "Sierra Leone", "Somalie", "Soudan",
  "Suisse", "Tanzanie", "Tchad", "Togo", "Tunisie",
  "Turquie", "Uganda", "Zimbabwe",
].sort();

const COUNTRY_CODES: Record<string, string> = {
  "Guinée": "+224", "France": "+33", "Sénégal": "+221", "Mali": "+223",
  "Côte d'Ivoire": "+225", "Cameroun": "+237", "Bénin": "+229",
  "Burkina Faso": "+226", "Togo": "+228", "Niger": "+227",
  "Nigéria": "+234", "Ghana": "+233", "Sierra Leone": "+232",
  "Liberia": "+231", "Gambie": "+220", "Guinée Bissau": "+245",
  "Cap-Vert": "+238", "États-Unis": "+1", "Canada": "+1",
  "Belgique": "+32", "Royaume-Uni": "+44", "Espagne": "+34",
  "Italie": "+39", "Portugal": "+351", "Allemagne": "+49",
  "Maroc": "+212", "Algérie": "+213", "Tunisie": "+216",
};

// ─── Composant Input Simple ───────────────────────────────────────────────────
function FieldInput({
  label, value, onChangeText, placeholder, icon, secureTextEntry,
  keyboardType, autoCapitalize, multiline, maxLength,
  returnKeyType, onSubmitEditing, inputRef, editable = true,
}: {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; icon?: string; secureTextEntry?: boolean;
  keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
  maxLength?: number; returnKeyType?: any; onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.spring(anim, { toValue: 1, useNativeDriver: false, speed: 30 }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.spring(anim, { toValue: 0, useNativeDriver: false, speed: 30 }).start();
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.borderInput, C.g4],
  });

  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={[fS.label, { fontFamily: F.body }]}>{label}</Text>}
      <Animated.View style={[fS.wrap, { borderColor }, !editable && fS.disabled]}>
        {icon && (
          <Ionicons
            name={icon as any} size={17}
            color={focused ? C.g4 : C.textFaint}
            style={{ marginRight: 8 }}
          />
        )}
        <TextInput
          ref={inputRef}
          style={[fS.input, { fontFamily: F.body }, multiline && fS.multiline]}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
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
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={fS.eye}>
            <Ionicons
              name={showPass ? "eye-outline" : "eye-off-outline"}
              size={17} color={C.textFaint}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const fS = StyleSheet.create({
  label: {
    fontSize: 11, fontWeight: "700", color: C.textSub,
    marginBottom: 6, letterSpacing: 0.3,
  },
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  disabled: { backgroundColor: "#F9FAFB", opacity: 0.7 },
  input: { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  eye: { padding: 4 },
});

// ─── Select simulé ────────────────────────────────────────────────────────────
function SelectField({
  label, value, placeholder, onPress, icon,
}: {
  label?: string; value: string; placeholder: string; onPress: () => void; icon?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={[fS.label, { fontFamily: F.body }]}>{label}</Text>}
      <TouchableOpacity style={sS.wrap} onPress={onPress} activeOpacity={0.8}>
        {icon && (
          <Ionicons name={icon as any} size={17} color={value ? C.g4 : C.textFaint} style={{ marginRight: 8 }} />
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
  wrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.white,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  txt: { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  placeholder: { color: C.textFaint, fontWeight: "400" },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  number, title, subtitle, color, bgColor,
}: {
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
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderLeftWidth: 4, padding: 14, marginBottom: 16,
  },
  num: {
    width: 30, height: 30, borderRadius: 99,
    justifyContent: "center", alignItems: "center",
  },
  numTxt: { color: C.white, fontSize: 13, fontWeight: "900" },
  title: { fontSize: 16, letterSpacing: -0.2, lineHeight: 20 },
  sub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
});

// ─── Country Picker Modal ─────────────────────────────────────────────────────
function CountryPicker({
  visible, onSelect, onClose, title,
}: {
  visible: boolean; onSelect: (c: string) => void; onClose: () => void; title: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  if (!visible) return null;

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
            style={[cpS.searchInput, { fontFamily: F.body }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un pays…"
            placeholderTextColor={C.textFaint}
            autoFocus
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
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end", zIndex: 100,
  },
  sheet: {
    backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "75%",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 18,
  },
  title: { fontSize: 22, color: C.text },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.bg,
    justifyContent: "center", alignItems: "center",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.bg,
    borderRadius: 12, borderWidth: 1, borderColor: C.borderInput,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  item: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  itemTxt: { fontSize: 14, color: C.text, fontWeight: "600" },
  code: { fontSize: 12, color: C.textMuted },
});

// ─── Main Register Screen ─────────────────────────────────────────────────────
export default function RegisterScreen() {
  const { register: registerUser, isLoading } = useAuth();
  const router = useRouter();

  // Section 1: Compte
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Section 2: Contact
  const [country, setCountry] = useState("Guinée");
  const [city, setCity] = useState("");
  const [phoneCode, setPhoneCode] = useState("+224");
  const [phone, setPhone] = useState("");

  // Section 3: KYC
  const [nationality, setNationality] = useState("Guinée");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [birthCity, setBirthCity] = useState("");

  // Pickers
  const [picker, setPicker] = useState<null | "country" | "nationality" | "birthCountry">(null);

  const btnScale = useRef(new Animated.Value(1)).current;

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

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() &&
    password.trim() && password === confirmPassword &&
    country && city.trim() && phone.trim() &&
    nationality && birthDay && birthMonth && birthYear;

  const handleRegister = async () => {
    if (!canSubmit) {
      return Alert.alert("Formulaire incomplet", "Veuillez remplir tous les champs obligatoires.");
    }
    if (password !== confirmPassword) {
      return Alert.alert("Mots de passe", "Les mots de passe ne correspondent pas.");
    }
    if (birthYear.length !== 4) {
      return Alert.alert("Date invalide", "L'année de naissance doit comporter 4 chiffres.");
    }

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    try {
      const basePayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: `${phoneCode}${phone.trim()}`,
        country,
        city: city.trim(),
      };
      // Champs KYC supplémentaires non définis dans RegisterPayload de base
      const kycExtra: Record<string, string> = {
        nationality,
        birthDate,
        birthCountry,
        birthCity: birthCity.trim(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await registerUser({ ...basePayload, ...kycExtra } as any);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Erreur lors de la création du compte.";
      const text = Array.isArray(msg) ? msg[0] : msg;
      if (Platform.OS === "web") { alert(text); } else { Alert.alert("Erreur", text); }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={r.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* Background */}
      <View style={r.bgBase} />
      <View style={r.bgCircle} />

      {/* Country Picker */}
      <CountryPicker
        visible={picker !== null}
        title={picker === "country" ? "Pays de résidence" : picker === "nationality" ? "Nationalité" : "Pays de naissance"}
        onSelect={handleCountrySelect}
        onClose={() => setPicker(null)}
      />

      <ScrollView
        contentContainerStyle={r.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={r.header}>
          <TouchableOpacity style={r.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[r.headerTitle, { fontFamily: F.display }]}>Créer un compte</Text>
            <Text style={[r.headerSub, { fontFamily: F.body }]}>
              Direct Transf'air · Inscription
            </Text>
          </View>
          <View style={r.logoSmall}>
            <Ionicons name="swap-horizontal" size={20} color={C.g4} />
          </View>
        </View>

        {/* Progress bar */}
        <View style={r.progressWrap}>
          <View style={[r.progressStep, { backgroundColor: C.section1 }]} />
          <View style={[r.progressStep, { backgroundColor: C.section2 }]} />
          <View style={[r.progressStep, { backgroundColor: C.section3 }]} />
        </View>

        {/* ────── SECTION 1 : COMPTE ────── */}
        <View style={r.section}>
          <SectionHeader
            number="1"
            title="Informations du Compte"
            subtitle="Identité & accès"
            color={C.section1}
            bgColor={C.section1Soft}
          />

          <View style={r.row}>
            <View style={{ flex: 1 }}>
              <FieldInput
                label="Prénom *"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jean"
                icon="person-outline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput
                label="Nom *"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Dupont"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <FieldInput
            label="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FieldInput
            label="Mot de passe *"
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 caractères"
            icon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
          />

          <FieldInput
            label="Confirmer le mot de passe *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Répétez le mot de passe"
            icon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
          />

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <View style={r.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
              <Text style={[r.errorTxt, { fontFamily: F.body }]}>Les mots de passe ne correspondent pas</Text>
            </View>
          )}
        </View>

        {/* ────── SECTION 2 : CONTACT ────── */}
        <View style={r.section}>
          <SectionHeader
            number="2"
            title="Coordonnées"
            subtitle="Résidence & téléphone"
            color={C.section2}
            bgColor={C.section2Soft}
          />

          <SelectField
            label="Pays de résidence *"
            value={country}
            placeholder="Sélectionner un pays"
            icon="globe-outline"
            onPress={() => setPicker("country")}
          />

          <FieldInput
            label="Ville *"
            value={city}
            onChangeText={setCity}
            placeholder="Ex: Conakry"
            icon="location-outline"
          />

          {/* Téléphone avec indicatif */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[fS.label, { fontFamily: F.body }]}>Téléphone *</Text>
            <View style={r.phoneRow}>
              <TouchableOpacity
                style={r.phoneCode}
                onPress={() => setPicker("country")}
              >
                <Text style={[r.phoneCodeTxt, { fontFamily: F.body }]}>{phoneCode}</Text>
                <Ionicons name="chevron-down" size={13} color={C.g4} />
              </TouchableOpacity>
              <View style={r.phoneInputWrap}>
                <TextInput
                  style={[r.phoneInput, { fontFamily: F.body }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="6 12 34 56 78"
                  placeholderTextColor={C.textFaint}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ────── SECTION 3 : KYC ────── */}
        <View style={r.section}>
          <SectionHeader
            number="3"
            title="État Civil (KYC)"
            subtitle="Vérification d'identité"
            color={C.section3}
            bgColor={C.section3Soft}
          />

          <SelectField
            label="Nationalité *"
            value={nationality}
            placeholder="Sélectionner"
            icon="flag-outline"
            onPress={() => setPicker("nationality")}
          />

          {/* Date de naissance — 3 champs séparés sur 1 ligne */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[fS.label, { fontFamily: F.body }]}>Date de Naissance *</Text>
            <View style={r.dateRow}>
              <View style={r.dateFieldWrap}>
                <Text style={[r.datePlaceholder, { fontFamily: F.body }, birthDay && r.datePlaceholderActive]}>JJ</Text>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthDay}
                  onChangeText={(v) => {
                    const n = v.replace(/\D/g, "").slice(0, 2);
                    setBirthDay(n);
                  }}
                  placeholder="JJ"
                  placeholderTextColor={C.textFaint}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={r.dateSep}>/</Text>
              <View style={r.dateFieldWrap}>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthMonth}
                  onChangeText={(v) => setBirthMonth(v.replace(/\D/g, "").slice(0, 2))}
                  placeholder="MM"
                  placeholderTextColor={C.textFaint}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
              <Text style={r.dateSep}>/</Text>
              <View style={[r.dateFieldWrap, { flex: 2 }]}>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthYear}
                  onChangeText={(v) => setBirthYear(v.replace(/\D/g, "").slice(0, 4))}
                  placeholder="AAAA"
                  placeholderTextColor={C.textFaint}
                  keyboardType="numeric"
                  maxLength={4}
                  textAlign="center"
                />
              </View>
            </View>
          </View>

          <View style={r.row}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Pays Naissance"
                value={birthCountry}
                placeholder="Choisir"
                onPress={() => setPicker("birthCountry")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput
                label="Ville Naissance"
                value={birthCity}
                onChangeText={setBirthCity}
                placeholder="Ex: Conakry"
              />
            </View>
          </View>
        </View>

        {/* ── Submit ── */}
        <View style={r.submitSection}>
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[r.btn, !canSubmit && r.btnDisabled]}
              onPress={handleRegister}
              disabled={isLoading || !canSubmit}
              activeOpacity={0.9}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={[r.btnTxt, { fontFamily: F.body }]}>CRÉER MON COMPTE</Text>
                  <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={r.loginRow}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={[r.loginTxt, { fontFamily: F.body }]}>Déjà inscrit ? </Text>
            <Text style={[r.loginLink, { fontFamily: F.body }]}>Se connecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: C.g3 },
  bgCircle: {
    position: "absolute", width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.04)", top: -60, right: -60,
  },

  scroll: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 18,
    paddingTop: Platform.OS === "android" ? 48 : 56,
    backgroundColor: "transparent",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 24, color: C.white, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },
  logoSmall: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: C.white,
    justifyContent: "center", alignItems: "center",
  },

  // Progress
  progressWrap: {
    flexDirection: "row", gap: 6, paddingHorizontal: 20, marginBottom: 20,
  },
  progressStep: {
    flex: 1, height: 4, borderRadius: 99,
  },

  // Section
  section: {
    backgroundColor: C.white, borderRadius: 24, padding: 20,
    marginHorizontal: 16, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },

  row: { flexDirection: "row", gap: 10 },

  // Phone
  phoneRow: { flexDirection: "row", gap: 10 },
  phoneCode: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.gSoft, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: 12, paddingVertical: 14,
    minWidth: 78,
  },
  phoneCodeTxt: { fontSize: 14, fontWeight: "800", color: C.g4 },
  phoneInputWrap: {
    flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.borderInput, paddingHorizontal: 14, paddingVertical: 12,
    justifyContent: "center",
  },
  phoneInput: { fontSize: 14, color: C.text, fontWeight: "600" },

  // Date
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateFieldWrap: {
    flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.borderInput, paddingVertical: 12, paddingHorizontal: 6,
    justifyContent: "center", alignItems: "center",
  },
  datePlaceholder: { fontSize: 9, color: C.textFaint, marginBottom: 1 },
  datePlaceholderActive: { color: C.g4 },
  dateInput: { fontSize: 16, color: C.text, fontWeight: "700", textAlign: "center" },
  dateSep: { fontSize: 20, color: C.textMuted, fontWeight: "300", marginTop: 2 },

  // Error
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.dangerSoft, borderRadius: 10,
    padding: 10, marginTop: -4, marginBottom: 10,
  },
  errorTxt: { fontSize: 12, color: C.danger, fontWeight: "600" },

  // Submit section
  submitSection: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  btn: {
    backgroundColor: C.g3, borderRadius: 18, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: C.g2, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  btnDisabled: { backgroundColor: "#9CA3AF", shadowOpacity: 0 },
  btnTxt: { color: C.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },

  loginRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18,
  },
  loginTxt: { fontSize: 14, color: C.textSub },
  loginLink: { fontSize: 14, fontWeight: "800", color: C.g4 },
});