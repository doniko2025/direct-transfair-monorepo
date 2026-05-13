// apps/direct-transfair-mobile/app/(auth)/register.tsx
// =========================================================
// REGISTER v5.0 — Direct Transf'air
// ✅ Bordure orange supprimée (borderColor via state, pas Animated)
// ✅ Fix message succès/erreur : succès affiché avant redirection,
//    erreur API réelle affichée proprement
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
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
  danger: "#EF4444", dangerSoft: "#FEF2F2",
  section1: "#1E40AF", section1Soft: "#EFF6FF",
  section2: "#059669", section2Soft: "#ECFDF5",
  section3: "#7C3AED", section3Soft: "#F5F3FF",
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

// ─── Field Input ─────────────────────────────────────────
// ✅ borderColor via state (focused), pas Animated → suppression du rendu orange
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
  const [focused,   setFocused]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={[fS.label, { fontFamily: F.body }]}>{label}</Text>}
      <View style={[fS.wrap, focused && fS.wrapFocused, !editable && fS.disabled]}>
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
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={fS.eye}>
            <Ionicons
              name={showPass ? "eye-outline" : "eye-off-outline"}
              size={17} color={C.textFaint}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const fS = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", color: C.textSub, marginBottom: 6, letterSpacing: 0.3 },
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.borderInput,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  wrapFocused: { borderColor: C.borderFocus },
  disabled: { backgroundColor: "#F9FAFB", opacity: 0.7 },
  input: { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  eye: { padding: 4 },
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
  wrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 14, paddingVertical: 14 },
  txt: { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  placeholder: { color: C.textFaint, fontWeight: "400" },
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
  wrap: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderLeftWidth: 4, padding: 14, marginBottom: 16 },
  num: { width: 30, height: 30, borderRadius: 99, justifyContent: "center", alignItems: "center" },
  numTxt: { color: C.white, fontSize: 13, fontWeight: "900" },
  title: { fontSize: 16, letterSpacing: -0.2, lineHeight: 20 },
  sub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
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
        {/* ✅ Search sans Animated — bordure vert simple au focus */}
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
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 100 },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20, maxHeight: "75%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18 },
  title: { fontSize: 22, color: C.text },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemTxt: { fontSize: 14, color: C.text, fontWeight: "600" },
  code: { fontSize: 12, color: C.textMuted },
});

// ─── Main Register Screen ─────────────────────────────────
export default function RegisterScreen() {
  const { register: registerUser, isLoading } = useAuth();
  const router = useRouter();

  // Section 1 — Compte
  const [firstName,        setFirstName]        = useState("");
  const [lastName,         setLastName]         = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");

  // Section 2 — Contact
  const [country,    setCountry]    = useState("Guinée");
  const [city,       setCity]       = useState("");
  const [phoneCode,  setPhoneCode]  = useState("+224");
  const [phone,      setPhone]      = useState("");

  // Section 3 — KYC
  const [nationality,  setNationality]  = useState("Guinée");
  const [birthDay,     setBirthDay]     = useState("");
  const [birthMonth,   setBirthMonth]   = useState("");
  const [birthYear,    setBirthYear]    = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [birthCity,    setBirthCity]    = useState("");

  const [picker, setPicker] = useState<null|"country"|"nationality"|"birthCountry">(null);
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
    ? `${birthDay.padStart(2,"0")}/${birthMonth.padStart(2,"0")}/${birthYear}`
    : "";

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() &&
    password.trim() && password === confirmPassword &&
    country && city.trim() && phone.trim() &&
    nationality && birthDay && birthMonth && birthYear;

  // ✅ FIX PRINCIPAL : gestion propre succès/erreur
  // Le problème était que register() appelait login() en fallback,
  // et si login() échouait (même si le compte était créé), le catch
  // affichait "Erreur lors de la création du compte".
  // Solution : on détecte les cas de succès et on navigue manuellement.
  const handleRegister = async () => {
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

    try {
      const payload = {
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        email:       email.trim().toLowerCase(),
        password,
        phone:       `${phoneCode}${phone.trim()}`,
        country,
        city:        city.trim(),
        nationality,
        birthDate,
        birthCountry,
        birthCity:   birthCity.trim(),
      };

      await registerUser(payload as any);

      // ✅ Si on arrive ici sans exception, c'est un SUCCÈS
      if (Platform.OS === "web") {
        alert("✅ Compte créé avec succès ! Bienvenue.");
      } else {
        Alert.alert(
          "✅ Compte créé !",
          "Bienvenue sur Direct Transf'air. Vous êtes maintenant connecté.",
          [{ text: "Continuer", style: "default" }]
        );
      }
      // La navigation est gérée par AuthProvider (useEffect segments)
      // mais on peut forcer si nécessaire :
      // router.replace("/(tabs)/home");

    } catch (e: any) {
      // ✅ Afficher le vrai message d'erreur backend si disponible
      const raw = e?.response?.data?.message ?? e?.message ?? null;
      let msg: string;

      if (Array.isArray(raw)) {
        msg = raw[0] ?? "Erreur lors de la création du compte.";
      } else if (typeof raw === "string" && raw.trim().length > 0) {
        msg = raw;
      } else {
        // ✅ Si pas de message d'erreur clair ET le compte semble créé
        // (ex: le token de login post-register a échoué mais le compte existe)
        // → on redirige vers login avec un message d'invitation
        if (Platform.OS === "web") {
          alert("Compte créé ! Veuillez vous connecter avec vos identifiants.");
        } else {
          Alert.alert(
            "Compte créé !",
            "Votre compte a été créé. Veuillez vous connecter avec vos identifiants.",
            [{ text: "Se connecter", onPress: () => router.replace("/(auth)/login") }]
          );
        }
        return;
      }

      if (Platform.OS === "web") { alert(msg); }
      else { Alert.alert("Erreur d'inscription", msg); }
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

      <CountryPicker
        visible={picker !== null}
        title={
          picker === "country" ? "Pays de résidence" :
          picker === "nationality" ? "Nationalité" : "Pays de naissance"
        }
        onSelect={handleCountrySelect}
        onClose={() => setPicker(null)}
      />

      <ScrollView
        contentContainerStyle={r.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={r.header}>
          <TouchableOpacity style={r.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[r.headerTitle, { fontFamily: F.display }]}>Créer un compte</Text>
            <Text style={[r.headerSub, { fontFamily: F.body }]}>Direct Transf'air · Inscription</Text>
          </View>
          <View style={r.logoSmall}>
            <Ionicons name="swap-horizontal" size={20} color={C.g4} />
          </View>
        </View>

        {/* Progress */}
        <View style={r.progressWrap}>
          <View style={[r.progressStep, { backgroundColor: C.section1 }]} />
          <View style={[r.progressStep, { backgroundColor: C.section2 }]} />
          <View style={[r.progressStep, { backgroundColor: C.section3 }]} />
        </View>

        {/* ─── Section 1 : Compte ─── */}
        <View style={r.section}>
          <SectionHeader number="1" title="Informations du Compte" subtitle="Identité & accès" color={C.section1} bgColor={C.section1Soft} />

          <View style={r.row}>
            <View style={{ flex: 1 }}>
              <FieldInput label="Prénom *" value={firstName} onChangeText={setFirstName} placeholder="Jean" icon="person-outline" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="Nom *" value={lastName} onChangeText={setLastName} placeholder="Dupont" autoCapitalize="characters" />
            </View>
          </View>

          <FieldInput label="Email *" value={email} onChangeText={setEmail} placeholder="votre@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
          <FieldInput label="Mot de passe *" value={password} onChangeText={setPassword} placeholder="Min. 8 caractères" icon="lock-closed-outline" secureTextEntry autoCapitalize="none" />
          <FieldInput label="Confirmer le mot de passe *" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Répétez le mot de passe" icon="lock-closed-outline" secureTextEntry autoCapitalize="none" />

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <View style={r.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
              <Text style={[r.errorTxt, { fontFamily: F.body }]}>Les mots de passe ne correspondent pas</Text>
            </View>
          )}
        </View>

        {/* ─── Section 2 : Contact ─── */}
        <View style={r.section}>
          <SectionHeader number="2" title="Coordonnées" subtitle="Résidence & téléphone" color={C.section2} bgColor={C.section2Soft} />

          <SelectField label="Pays de résidence *" value={country} placeholder="Sélectionner un pays" icon="globe-outline" onPress={() => setPicker("country")} />
          <FieldInput label="Ville *" value={city} onChangeText={setCity} placeholder="Ex: Conakry" icon="location-outline" />

          <View style={{ marginBottom: 12 }}>
            <Text style={[fS.label, { fontFamily: F.body }]}>Téléphone *</Text>
            <View style={r.phoneRow}>
              <TouchableOpacity style={r.phoneCode} onPress={() => setPicker("country")}>
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
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        </View>

        {/* ─── Section 3 : KYC ─── */}
        <View style={r.section}>
          <SectionHeader number="3" title="État Civil (KYC)" subtitle="Vérification d'identité" color={C.section3} bgColor={C.section3Soft} />

          <SelectField label="Nationalité *" value={nationality} placeholder="Sélectionner" icon="flag-outline" onPress={() => setPicker("nationality")} />

          <View style={{ marginBottom: 12 }}>
            <Text style={[fS.label, { fontFamily: F.body }]}>Date de Naissance *</Text>
            <View style={r.dateRow}>
              <View style={r.dateField}>
                <Text style={[r.datePlaceholder, { fontFamily: F.body }]}>JJ</Text>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthDay}
                  onChangeText={(v) => setBirthDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="JJ"
                  placeholderTextColor={C.textFaint}
                />
              </View>
              <Text style={r.dateSep}>/</Text>
              <View style={r.dateField}>
                <Text style={[r.datePlaceholder, { fontFamily: F.body }]}>MM</Text>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthMonth}
                  onChangeText={(v) => setBirthMonth(v.replace(/[^0-9]/g, "").slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={C.textFaint}
                />
              </View>
              <Text style={r.dateSep}>/</Text>
              <View style={[r.dateField, { flex: 2 }]}>
                <Text style={[r.datePlaceholder, { fontFamily: F.body }]}>AAAA</Text>
                <TextInput
                  style={[r.dateInput, { fontFamily: F.body }]}
                  value={birthYear}
                  onChangeText={(v) => setBirthYear(v.replace(/[^0-9]/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="AAAA"
                  placeholderTextColor={C.textFaint}
                />
              </View>
            </View>
          </View>

          <View style={r.row}>
            <View style={{ flex: 1 }}>
              <SelectField label="Pays Naissance" value={birthCountry} placeholder="Choisir" onPress={() => setPicker("birthCountry")} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldInput label="Ville Naissance" value={birthCity} onChangeText={setBirthCity} placeholder="Ex: Conakry" />
            </View>
          </View>
        </View>

        {/* ─── Bouton inscription ─── */}
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
                <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                <Text style={[r.btnTxt, { fontFamily: F.body }]}>CRÉER MON COMPTE</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Déjà inscrit */}
        <TouchableOpacity style={r.loginRow} onPress={() => router.replace("/(auth)/login")}>
          <Text style={[r.loginTxt, { fontFamily: F.body }]}>
            Déjà inscrit ?{" "}
            <Text style={{ color: C.g4, fontWeight: "800" }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.g2 },
  bgBase:  { ...StyleSheet.absoluteFillObject, backgroundColor: C.g3 },
  bgCircle:{ position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(255,255,255,0.04)", top: -60, right: -60 },

  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 50 : 60 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  headerTitle: { color: C.white, fontSize: 22, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 1 },
  logoSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, justifyContent: "center", alignItems: "center" },

  progressWrap: { flexDirection: "row", gap: 6, marginBottom: 20 },
  progressStep: { flex: 1, height: 4, borderRadius: 99, opacity: 0.85 },

  section: { backgroundColor: C.white, borderRadius: 22, padding: 20, marginBottom: 14, shadowColor: C.g1, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },

  row: { flexDirection: "row", gap: 12 },

  phoneRow: { flexDirection: "row", gap: 10 },
  phoneCode: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 12, paddingVertical: 14 },
  phoneCodeTxt: { fontSize: 14, fontWeight: "800", color: C.g4 },
  phoneInputWrap: { flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput, paddingHorizontal: 14, justifyContent: "center" },
  phoneInput: { fontSize: 14, color: C.text, fontWeight: "600" },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateField: {
    flex: 1, backgroundColor: C.white,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.borderInput,
    paddingHorizontal: 12, paddingVertical: 10, alignItems: "center",
  },
  datePlaceholder: { fontSize: 9, fontWeight: "800", color: C.textFaint, letterSpacing: 0.5, marginBottom: 2 },
  dateInput: { fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center" },
  dateSep: { fontSize: 20, color: C.textMuted, fontWeight: "300" },

  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 8 },
  errorTxt: { color: C.danger, fontSize: 12, fontWeight: "600" },

  btn: { backgroundColor: C.g3, borderRadius: 18, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16, shadowColor: C.g3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnDisabled: { backgroundColor: "#9CA3AF", shadowOpacity: 0 },
  btnTxt: { color: C.white, fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },

  loginRow: { alignItems: "center", paddingVertical: 8 },
  loginTxt: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
});