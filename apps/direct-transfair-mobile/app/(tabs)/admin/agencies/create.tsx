// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/create.tsx
// =========================================================
// AGENCY CREATE v5.2 — Direct Transf'air
// ✅ v5.1 : type "PARTNER" / "SUBSIDIARY" envoyé au backend
//          bouton création remonté (paddingBottom nav)
//
// ✅ v5.2 : 2 correctifs UX téléphone — harmonisés avec edit.tsx v2.1
//   (edit.tsx a le bug visible du doublon d'indicatif car il précharge
//   un numéro existant ; create.tsx pars toujours d'un champ vide donc
//   n'a jamais eu ce bug précis, mais partage exactement les 2 mêmes
//   soucis résiduels ci-dessous, corrigés ici pour rester cohérent.)
//
//   FIX 1 — Nombre de chiffres non adapté au pays
//     Ajout de la même table de longueurs nationales par indicatif que
//     edit.tsx (partagée depuis data/phoneRules.ts — une seule source
//     de vérité pour les deux écrans) : limite la saisie via maxLength,
//     affiche un indice sous le champ, bloque l'envoi si hors plage.
//
//   FIX 2 — Cadre rectangulaire orange au focus (web)
//     Même correctif que edit.tsx : outlineStyle: 'none' (web
//     uniquement) + indicateur de focus "maison" sur le champ
//     téléphone pour ne pas perdre le retour visuel.
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, ScrollView, Alert,
  SafeAreaView, KeyboardAvoidingView, Platform, Modal, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";
import { countriesList, CountryData } from "../../../../data/countries";
import { citiesByCountry } from "../../../../data/cities";
import { getPhoneDigitRange, phoneRangeHint } from "../../../../data/phoneRules";

const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  borderMd: "#D1D9E6",
  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",
  sky:      "#0284C7",
  skyMid:   "#0369A1",
  skyLt:    "#E0F2FE",
  skyMd:    "#7DD3FC",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  white: "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "monospace"   }),
  },
  shadow: {
    card: { shadowColor: "#0284C7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
  },
};

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF",
  FR: "EUR", DE: "EUR", BE: "EUR", IT: "EUR", ES: "EUR", PT: "EUR",
  NL: "EUR", AT: "EUR", FI: "EUR", IE: "EUR", LU: "EUR", GR: "EUR",
  GB: "GBP", GG: "GBP", JE: "GBP",
  US: "USD", SV: "USD",
};

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, required, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; required?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [shown,   setShown]   = useState(false);
  const isPassword = secureTextEntry;
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}{required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <View style={[fS.box, focused && { borderColor: T.skyMd, backgroundColor: T.skyLt + "40" }, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={T.inkMuted}
          keyboardType={keyboardType} autoCapitalize={autoCapitalize}
          secureTextEntry={isPassword && !shown} editable={editable}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity style={fS.eyeBtn} onPress={() => setShown(!shown)}>
            <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={18} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap:     { marginBottom: 14 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  box:      { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, overflow: "hidden" },
  disabled: { backgroundColor: T.borderLt, opacity: 0.7 },
  // ✅ v5.2 FIX 2 : supprime l'anneau de focus natif du navigateur (web
  // uniquement — ignoré sur iOS/Android), remplacé par la bordure
  // bleue déjà gérée par le state `focused` ci-dessus.
  input:    {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.ink, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  eyeBtn:   { padding: 12 },
  hint:     { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginTop: -8, marginBottom: 14 },
});

function SelectButton({ label, value, onPress, required }: { label: string; value: string; onPress: () => void; required?: boolean }) {
  return (
    <View style={sbS.wrap}>
      <Text style={[sbS.label, { fontFamily: T.font.sans }]}>
        {label}{required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <TouchableOpacity style={sbS.btn} onPress={onPress} activeOpacity={0.8}>
        <Text style={[sbS.value, { color: value ? T.ink : T.inkMuted, fontFamily: T.font.sans }]}>
          {value || "Sélectionner…"}
        </Text>
        <View style={sbS.chevron}><Ionicons name="chevron-down" size={14} color={T.sky} /></View>
      </TouchableOpacity>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap:   { marginBottom: 14 },
  label:  { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  btn:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 13 },
  value:  { flex: 1, fontSize: 14, fontWeight: "600" },
  chevron:{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.skyLt, justifyContent: "center", alignItems: "center" },
});

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color + "18", justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: "900" as any, color: T.inkSub, letterSpacing: 1.5, fontFamily: T.font.sans }}>
        {title}
      </Text>
    </View>
  );
}

function PickerModal({ visible, onClose, title, data, onSelect, renderItem }: {
  visible: boolean; onClose: () => void; title: string;
  data: any[]; onSelect: (item: any) => void;
  renderItem: (item: any) => React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? data.filter((item: any) => (typeof item === "string" ? item : item.name ?? "").toLowerCase().includes(q.toLowerCase()))
    : data;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pmS.overlay}>
        <View style={pmS.sheet}>
          <View style={pmS.handle} />
          <View style={pmS.headerRow}>
            <Text style={[pmS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <TouchableOpacity style={pmS.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={T.inkSub} />
            </TouchableOpacity>
          </View>
          <View style={pmS.searchBox}>
            <Ionicons name="search" size={16} color={T.inkMuted} />
            <TextInput
              style={[pmS.searchInput, { fontFamily: T.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Rechercher…" placeholderTextColor={T.inkMuted} autoFocus
            />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={14} color={T.inkMuted} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => (typeof item === "string" ? item : item.code ?? item.name ?? i.toString())}
            renderItem={({ item }) => (
              <TouchableOpacity style={pmS.item} onPress={() => { onSelect(item); onClose(); setQ(""); }}>
                {renderItem(item)}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[pmS.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}
const pmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderWidth: 1, borderColor: T.border },
  handle:  { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  title:   { color: T.ink, fontSize: 18, fontWeight: "700" },
  closeBtn:{ width: 32, height: 32, borderRadius: 9, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, height: 44 },
  // ✅ v5.2 FIX 2 : même correctif d'anneau de focus natif que fS.input
  searchInput: {
    flex: 1, fontSize: 14, color: T.ink, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  item:    { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  empty:   { color: T.inkMuted, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ✅ TypeToggle — envoie "PARTNER" / "SUBSIDIARY" au backend
function TypeToggle({ isPartner, onChange }: { isPartner: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={ttS.card}>
      <TouchableOpacity
        style={[ttS.option, !isPartner && { backgroundColor: T.tealLt, borderColor: T.tealMd }]}
        onPress={() => onChange(false)} activeOpacity={0.85}
      >
        {!isPartner && <View style={[ttS.activeDot, { backgroundColor: T.teal }]} />}
        <View style={{ flex: 1 }}>
          <Text style={[ttS.optTitle, { color: !isPartner ? T.teal : T.inkSub, fontFamily: T.font.sans }]}>Agence Filiale</Text>
          <Text style={[ttS.optDesc, { fontFamily: T.font.sans }]}>Propriété directe · Gains à 100%</Text>
        </View>
        {!isPartner && <Ionicons name="checkmark-circle" size={20} color={T.teal} />}
      </TouchableOpacity>
      <View style={ttS.divider} />
      <TouchableOpacity
        style={[ttS.option, isPartner && { backgroundColor: T.skyLt, borderColor: T.skyMd }]}
        onPress={() => onChange(true)} activeOpacity={0.85}
      >
        {isPartner && <View style={[ttS.activeDot, { backgroundColor: T.sky }]} />}
        <View style={{ flex: 1 }}>
          <Text style={[ttS.optTitle, { color: isPartner ? T.sky : T.inkSub, fontFamily: T.font.sans }]}>Agence Partenaire</Text>
          <Text style={[ttS.optDesc, { fontFamily: T.font.sans }]}>Société tierce indépendante · Commissionnée</Text>
        </View>
        {isPartner && <Ionicons name="checkmark-circle" size={20} color={T.sky} />}
      </TouchableOpacity>
    </View>
  );
}
const ttS = StyleSheet.create({
  card:     { backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1.5, borderColor: T.border, marginBottom: 14, overflow: "hidden", ...T.shadow.soft },
  option:   { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, borderWidth: 1, borderColor: "transparent" },
  activeDot:{ width: 4, height: 36, borderRadius: 99 },
  optTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  optDesc:  { fontSize: 11, color: T.inkMuted, fontWeight: "500", lineHeight: 15 },
  divider:  { height: 1, backgroundColor: T.border },
});

function CurrencyBadge({ currency }: { currency: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    XOF: { bg: T.amberLt, color: T.amber },
    GNF: { bg: T.redLt,   color: T.red   },
    EUR: { bg: T.blueLt,  color: T.blue  },
    USD: { bg: T.greenLt, color: T.green },
    GBP: { bg: "#EDE9FE", color: "#7C3AED" },
  };
  const cfg = colors[currency] ?? { bg: T.borderLt, color: T.inkSub };
  return (
    <View style={[cbS.pill, { backgroundColor: cfg.bg, borderColor: cfg.color + "30" }]}>
      <Ionicons name="cash-outline" size={11} color={cfg.color} />
      <Text style={[cbS.txt, { color: cfg.color, fontFamily: T.font.mono }]}>{currency}</Text>
    </View>
  );
}
const cbS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  txt:  { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
});

// ─── Main ─────────────────────────────────────────────────
export default function CreateAgencyScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [name,             setName]             = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName,  setManagerLastName]  = useState("");
  const [phone,            setPhone]            = useState("");
  const [phoneFocused,     setPhoneFocused]     = useState(false);
  const [address,          setAddress]          = useState("");
  const [isPartner,        setIsPartner]        = useState(false);
  const [submitting,       setSubmitting]       = useState(false);

  const [selectedCountry,   setSelectedCountry]   = useState<CountryData>(countriesList[0]);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState<CountryData>(countriesList[0]);
  const [selectedCity,      setSelectedCity]      = useState("");

  const [showCountryModal,   setShowCountryModal]   = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showCityModal,      setShowCityModal]      = useState(false);

  const [toastMsg, setToastMsg]  = useState("");
  const toastAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    setSelectedCity("");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [selectedCountry]);

  const countryCode    = (selectedCountry.code ?? "").toUpperCase().substring(0, 2);
  const agencyCurrency = (selectedCountry as any).currency ?? COUNTRY_CURRENCY_MAP[countryCode] ?? "XOF";
  const availableCities = (citiesByCountry as any)[selectedCountry.name] ?? [];

  // ✅ v5.2 FIX 1 : plage de chiffres attendue pour l'indicatif actuel
  // (voir data/phoneRules.ts — partagé avec edit.tsx)
  const phoneRange = getPhoneDigitRange(selectedPhoneCode.dialCode);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !managerFirstName.trim() || !managerLastName.trim() || !selectedCity) {
      Alert.alert("Champs manquants", "Tous les champs marqués * sont obligatoires.");
      return;
    }

    const nationalDigits = phone.replace(/\D/g, "");

    // ✅ v5.2 FIX 1 : validation souple adaptée au pays choisi
    // (ignorée si le champ est vide, le téléphone reste optionnel ici)
    if (nationalDigits && (nationalDigits.length < phoneRange.min || nationalDigits.length > phoneRange.max)) {
      Alert.alert(
        "Numéro invalide",
        `Le numéro doit contenir ${phoneRangeHint(phoneRange)} pour l'indicatif ${selectedPhoneCode.dialCode}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const dialDigits = (selectedPhoneCode.dialCode ?? "").replace(/\D/g, "");
      // ✅ Reconstruction à partir des chiffres seuls (plus robuste que
      // l'ancienne concaténation de chaînes, qui aurait pu embarquer
      // des espaces tapés au clavier physique sur le champ national).
      const fullPhone = nationalDigits ? `+${dialDigits}${nationalDigits}` : "";
      const autoCode  = name.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

      const payload = {
        name:            name.trim(),
        code:            autoCode,
        address:         address.trim() || selectedCity,
        phone:           fullPhone,
        email:           email.trim(),
        adminEmail:      email.trim(),
        adminFirstName:  managerFirstName.trim(),
        adminLastName:   managerLastName.trim(),
        adminPassword:   password.trim(),
        managerName:     `${managerFirstName.trim()} ${managerLastName.trim()}`,
        country:         selectedCountry.code ?? selectedCountry.name,
        currency:        agencyCurrency,
        primaryCurrency: agencyCurrency,
        city:            selectedCity,
        // ✅ FIX : champ "type" envoyé explicitement au backend
        type:            isPartner ? "PARTNER" : "SUBSIDIARY",
        subscriptionType: isPartner ? "PURCHASE" : "RENTAL",
        status:          "ACTIVE",
      };

      await api.createAgency(payload as any);
      showToast(`✅ Agence "${name.trim()}" créée · ${agencyCurrency}`);
      setTimeout(() => router.back(), 2800);
    } catch (error: any) {
      const rawMsg = error?.response?.data?.message ?? error?.message ?? "Erreur technique.";
      const displayMsg = Array.isArray(rawMsg) ? rawMsg[0] : String(rawMsg);
      if (Platform.OS === "web") alert(`Erreur\n\n${displayMsg}`);
      else if (error?.response?.status === 401) Alert.alert("Session expirée", "Veuillez vous reconnecter.");
      else Alert.alert("Erreur", displayMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={["#38BDF8", "#0284C7"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* Toast */}
        <Animated.View style={[s.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }]}>
          <Ionicons name="checkmark-circle" size={20} color={T.white} />
          <Text style={[s.toastTxt, { fontFamily: T.font.sans }]}>{toastMsg}</Text>
        </Animated.View>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nouvelle Agence</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
                {selectedCountry.flag ?? ""} {selectedCountry.name}
              </Text>
              <CurrencyBadge currency={agencyCurrency} />
            </View>
          </View>
        </View>

        {/* Contenu */}
        <Animated.View style={[s.body, { opacity: fadeAnim }]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={s.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Type agence */}
              <View style={s.sectionCard}>
                <TypeToggle isPartner={isPartner} onChange={setIsPartner} />
              </View>

              {/* Identité */}
              <View style={s.sectionCard}>
                <SectionHeader icon="business-outline" title="IDENTITÉ" color={T.sky} />
                <Field label="Nom de l'agence"    value={name}     onChangeText={setName}     placeholder="Agence de Paris" required />
                <Field label="Email de connexion" value={email}    onChangeText={setEmail}    placeholder="agence@domaine.com" keyboardType="email-address" autoCapitalize="none" required />
                <Field label="Mot de passe"       value={password} onChangeText={setPassword} placeholder="Mot de passe sécurisé" secureTextEntry required />
              </View>

              {/* Responsable */}
              <View style={s.sectionCard}>
                <SectionHeader icon="person-outline" title="RESPONSABLE" color={T.teal} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Prénom" value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Alpha" required />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Nom" value={managerLastName} onChangeText={setManagerLastName} placeholder="DIALLO" required />
                  </View>
                </View>

                {/* Indicatif + numéro */}
                <Text style={[fS.label, { fontFamily: T.font.sans, marginBottom: 6 }]}>TÉLÉPHONE</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
                  <TouchableOpacity
                    style={[sbS.btn, { width: 110 }]}
                    onPress={() => setShowPhoneCodeModal(true)}
                  >
                    <Text style={[sbS.value, { fontFamily: T.font.sans, fontSize: 13 }]}>
                      {selectedPhoneCode.flag ?? ""} {selectedPhoneCode.dialCode}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={T.sky} />
                  </TouchableOpacity>
                  <View style={[fS.box, { flex: 1 }, phoneFocused && { borderColor: T.skyMd, backgroundColor: T.skyLt + "40" }]}>
                    <TextInput
                      style={[fS.input, { fontFamily: T.font.sans }]}
                      value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, ""))}
                      placeholder="620 000 000" placeholderTextColor={T.inkMuted}
                      keyboardType="phone-pad"
                      maxLength={phoneRange.max}
                      onFocus={() => setPhoneFocused(true)} onBlur={() => setPhoneFocused(false)}
                    />
                  </View>
                </View>
                {/* ✅ v5.2 FIX 1 : repère du format attendu pour l'indicatif choisi */}
                <Text style={[fS.hint, { fontFamily: T.font.sans }]}>{phoneRangeHint(phoneRange)}</Text>
              </View>

              {/* Localisation */}
              <View style={s.sectionCard}>
                <SectionHeader icon="location-outline" title="LOCALISATION" color={T.blue} />
                <SelectButton
                  label="Pays"
                  value={`${selectedCountry.flag ?? ""} ${selectedCountry.name}`}
                  onPress={() => setShowCountryModal(true)}
                  required
                />
                <SelectButton
                  label="Ville"
                  value={selectedCity}
                  onPress={() => availableCities.length > 0 ? setShowCityModal(true) : Alert.alert("Info", "Sélectionnez un pays d'abord.")}
                  required
                />
                <Field
                  label="Adresse complète"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Rue, quartier, numéro…"
                />

                {/* Devise auto */}
                <View style={s.currencyInfo}>
                  <Ionicons name="information-circle-outline" size={14} color={T.sky} />
                  <Text style={[s.currencyInfoTxt, { fontFamily: T.font.sans }]}>
                    Devise automatique depuis le pays :
                  </Text>
                  <CurrencyBadge currency={agencyCurrency} />
                </View>
              </View>

              {/* Bouton créer — padding bottom suffisant pour passer au-dessus de la tab bar */}
              <TouchableOpacity
                style={[s.createBtn, submitting && { opacity: 0.65 }]}
                onPress={handleCreate}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting
                  ? <ActivityIndicator color={T.white} />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={T.white} />
                      <Text style={[s.createBtnTxt, { fontFamily: T.font.sans }]}>
                        CRÉER L'AGENCE · {agencyCurrency}
                      </Text>
                    </>
                }
              </TouchableOpacity>

              {/* ✅ Espace suffisant pour la tab bar */}
              <View style={{ height: 100 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>

        {/* Modals */}
        <PickerModal
          visible={showCountryModal} onClose={() => setShowCountryModal(false)}
          title="Pays" data={countriesList}
          onSelect={(c: CountryData) => { setSelectedCountry(c); setSelectedPhoneCode(c); }}
          renderItem={(item: CountryData) => (
            <Text style={[{ fontSize: 14, color: T.ink, fontWeight: "600" }, { fontFamily: T.font.sans }]}>
              {item.flag ?? ""} {item.name} — {item.dialCode}
            </Text>
          )}
        />
        <PickerModal
          visible={showPhoneCodeModal} onClose={() => setShowPhoneCodeModal(false)}
          title="Indicatif" data={countriesList}
          onSelect={(c: CountryData) => setSelectedPhoneCode(c)}
          renderItem={(item: CountryData) => (
            <Text style={[{ fontSize: 14, color: T.ink, fontWeight: "600" }, { fontFamily: T.font.sans }]}>
              {item.flag ?? ""} {item.name} {item.dialCode}
            </Text>
          )}
        />
        <PickerModal
          visible={showCityModal} onClose={() => setShowCityModal(false)}
          title="Ville" data={availableCities}
          onSelect={(city: string) => setSelectedCity(city)}
          renderItem={(item: string) => (
            <Text style={[{ fontSize: 14, color: T.ink, fontWeight: "600" }, { fontFamily: T.font.sans }]}>
              {item}
            </Text>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  toast: {
    position: "absolute", top: 60, left: 20, right: 20, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.teal, borderRadius: T.radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 10,
  },
  toastTxt: { color: T.white, fontSize: 13, fontWeight: "700", flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 8 : 4,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },

  body:   { flex: 1, backgroundColor: T.pageBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  scroll: { padding: 20 },

  sectionCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
    ...T.shadow.soft,
  },

  currencyInfo: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.skyLt, borderRadius: T.radius.md,
    padding: 12, borderWidth: 1, borderColor: T.skyMd + "60",
    marginTop: 4,
  },
  currencyInfoTxt: { color: T.sky, fontSize: 12, fontWeight: "600", flex: 1 },

  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: T.sky, borderRadius: T.radius.lg,
    paddingVertical: 18, marginTop: 4,
    shadowColor: T.sky, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  createBtnTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },
});