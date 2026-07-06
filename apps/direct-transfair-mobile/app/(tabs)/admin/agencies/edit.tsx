// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/edit.tsx
// =========================================================
// AGENCY EDIT v2.1 — Direct Transf'air
// ✅ v2.0 : Tous les champs du formulaire de création présents
//          Type agence (Filiale / Partenaire) modifiable
//          Pays + devise auto + indicatif téléphonique
//          Thème cohérent avec create.tsx
//
// ✅ v2.1 : 🐛 3 correctifs UX sur le champ téléphone
//
//   FIX 1 — Indicatif affiché en double
//     PROBLÈME : fetchDetails() plaçait data.phone (numéro COMPLET
//     venant du backend, ex. "33751244722") tel quel dans le champ
//     texte, alors que le sélecteur d'indicatif à côté affiche déjà
//     "FR 33". Résultat à l'écran : "FR 33" + "33751244722" —
//     l'indicatif apparaît deux fois.
//     CORRECTIF : stripDialCodeIfPresent() (data/phoneRules.ts)
//     retire l'indicatif du numéro chargé avant de l'afficher, en ne
//     gardant que le numéro national dans le champ — comme dans
//     create.tsx où le champ ne contient jamais l'indicatif.
//
//   FIX 2 — Nombre de chiffres non adapté au pays
//     Le champ acceptait n'importe quelle longueur de saisie. Ajout
//     d'une table de longueurs nationales par indicatif
//     (data/phoneRules.ts, ex : 9-10 chiffres pour la France, 8 pour
//     le Mali, 10 pour la Côte d'Ivoire/Bénin depuis leurs
//     renumérotations respectives). Limite la saisie via maxLength,
//     affiche un indice sous le champ, et bloque l'enregistrement
//     avec un message clair si la longueur est hors plage.
//
//   FIX 3 — Cadre rectangulaire orange au focus (web)
//     React Native Web laisse le navigateur dessiner son propre
//     contour de focus par défaut sur les <TextInput> (souvent teinté
//     par l'accent système de l'utilisateur — d'où le rectangle
//     orange constaté, incohérent avec la charte bleue de l'app).
//     Corrigé via outlineStyle: 'none' (web uniquement, aucun impact
//     iOS/Android) + un indicateur de focus "maison" (bordure bleue)
//     ajouté sur le champ téléphone pour ne pas perdre le retour
//     visuel au focus.
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, ScrollView, Alert,
  SafeAreaView, KeyboardAvoidingView, Platform, Modal, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";
import { countriesList, CountryData } from "../../../../data/countries";
import { citiesByCountry } from "../../../../data/cities";
import { getPhoneDigitRange, stripDialCodeIfPresent, phoneRangeHint } from "../../../../data/phoneRules";

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
  skyLt:    "#E0F2FE",
  skyMd:    "#7DD3FC",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  white:    "#FFFFFF",
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

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, required, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; required?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [shown,   setShown]   = useState(false);
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
          secureTextEntry={secureTextEntry && !shown}
          editable={editable}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
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
  // ✅ v2.1 FIX 3 : supprime l'anneau de focus natif du navigateur (web
  // uniquement — ignoré sur iOS/Android). Le retour visuel au focus
  // reste géré par le changement de bordure/fond du state `focused`
  // (et `phoneFocused` pour le champ téléphone, plus bas).
  input:    {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.ink, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  eyeBtn:   { padding: 12 },
  hint:     { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginTop: -8, marginBottom: 14 },
});

// ─── SelectButton ─────────────────────────────────────────
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

// ─── SectionHeader ────────────────────────────────────────
function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color + "18", justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: "900" as any, color: T.inkSub, letterSpacing: 1.5, fontFamily: T.font.sans }}>
        {title}
      </Text>
    </View>
  );
}

// ─── PickerModal ──────────────────────────────────────────
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
  // ✅ v2.1 FIX 3 : même correctif d'anneau de focus natif que fS.input
  searchInput: {
    flex: 1, fontSize: 14, color: T.ink, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  item:    { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  empty:   { color: T.inkMuted, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── TypeToggle ───────────────────────────────────────────
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
  card:     { backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1.5, borderColor: T.border, marginBottom: 14, overflow: "hidden" },
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, backgroundColor: cfg.bg, borderColor: cfg.color + "30" }}>
      <Ionicons name="cash-outline" size={11} color={cfg.color} />
      <Text style={{ fontSize: 11, fontWeight: "900", letterSpacing: 0.5, color: cfg.color, fontFamily: T.font.mono }}>{currency}</Text>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────
export default function EditAgencyScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Champs identité
  const [name,    setName]    = useState("");
  const [code,    setCode]    = useState("");
  const [email,   setEmail]   = useState("");

  // Responsable
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName,  setManagerLastName]  = useState("");
  const [phone,            setPhone]            = useState("");
  const [phoneFocused,     setPhoneFocused]     = useState(false);

  // Localisation
  const [address, setAddress] = useState("");
  const [city,    setCity]    = useState("");

  // Type & pays
  const [isPartner,       setIsPartner]       = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(countriesList[0]);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState<CountryData>(countriesList[0]);

  // Modals
  const [showCountryModal,   setShowCountryModal]   = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showCityModal,      setShowCityModal]      = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const countryCode    = (selectedCountry.code ?? "").toUpperCase().substring(0, 2);
  const agencyCurrency = (selectedCountry as any).currency ?? COUNTRY_CURRENCY_MAP[countryCode] ?? "XOF";
  const availableCities = (citiesByCountry as any)[selectedCountry.name] ?? [];

  // ✅ v2.1 FIX 2 : plage de chiffres attendue pour l'indicatif actuel
  // (voir data/phoneRules.ts — recalculée à chaque changement d'indicatif)
  const phoneRange = getPhoneDigitRange(selectedPhoneCode.dialCode);

  useEffect(() => {
    if (id) void fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      const data = await api.getAgency(id as string);

      setName(data.name ?? "");
      setCode((data as any).code ?? "");
      setEmail(data.email ?? "");
      setAddress(data.address ?? "");
      setCity(data.city ?? "");

      // ✅ Type agence
      setIsPartner((data as any).type === "PARTNER");

      // Responsable : séparer managerName si firstName/lastName pas dispo
      const agents = Array.isArray((data as any).agents) ? (data as any).agents : [];
      const manager = agents.find((a: any) => a.role === "COMPANY_ADMIN" || a.role === "AGENT") ?? agents[0];
      if (manager) {
        setManagerFirstName(manager.firstName ?? "");
        setManagerLastName(manager.lastName ?? "");
      } else {
        const parts = ((data as any).managerName ?? "").split(" ");
        setManagerFirstName(parts[0] ?? "");
        setManagerLastName(parts.slice(1).join(" ") ?? "");
      }

      // Pays — déterminé AVANT le téléphone pour pouvoir retirer
      // correctement l'indicatif déjà présent dans data.phone (FIX 1)
      let matchedCountry: CountryData | null = null;
      if (data.country) {
        const found = countriesList.find(
          (c) => c.code?.toUpperCase() === data.country?.toUpperCase() || c.name === data.country
        );
        if (found) {
          matchedCountry = found;
          setSelectedCountry(found);
          setSelectedPhoneCode(found);
        }
      }

      // ✅ v2.1 FIX 1 : l'indicatif s'affichait deux fois (une fois dans
      // le sélecteur "FR 33", une fois au début du champ texte
      // "33751244722") car data.phone renvoyé par le backend contient
      // déjà l'indicatif complet, et on le recopiait tel quel dans le
      // champ censé ne contenir que le numéro national (comme dans
      // create.tsx). On retire maintenant l'indicatif avant affichage.
      const dialCodeForStrip = matchedCountry?.dialCode ?? selectedPhoneCode.dialCode;
      setPhone(stripDialCodeIfPresent(data.phone, dialCodeForStrip));

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      Alert.alert("Erreur", "Impossible de charger l'agence");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Champs requis", "Le nom et l'email sont obligatoires.");
      return;
    }

    const nationalDigits = phone.replace(/\D/g, "");
    const dialDigits     = (selectedPhoneCode.dialCode ?? "").replace(/\D/g, "");

    // ✅ v2.1 FIX 2 : validation souple adaptée au pays choisi
    // (ex : 9-10 chiffres pour la France, 8 pour le Mali, 10 pour la
    // Côte d'Ivoire…). Ignorée si le champ est vide (téléphone optionnel).
    if (nationalDigits && (nationalDigits.length < phoneRange.min || nationalDigits.length > phoneRange.max)) {
      Alert.alert(
        "Numéro invalide",
        `Le numéro doit contenir ${phoneRangeHint(phoneRange)} pour l'indicatif ${selectedPhoneCode.dialCode}.`,
      );
      return;
    }

    setSaving(true);
    try {
      // ✅ v2.1 FIX 1 : on reconstruit toujours l'indicatif + le numéro
      // national à partir de zéro, plutôt que l'ancien
      // `phone.startsWith(dialCode) ? phone : dialCode + phone` qui
      // laissait passer un indicatif déjà présent dans `phone` (d'où le
      // doublon visible à l'écran) et qui pouvait produire un numéro
      // composé uniquement de l'indicatif si le champ était vide.
      const fullPhone = nationalDigits ? `+${dialDigits}${nationalDigits}` : "";

      await api.updateAgency(id as string, {
        name:            name.trim(),
        code:            code.trim(),
        email:           email.trim(),
        phone:           fullPhone,
        address:         address.trim(),
        city:            city,
        country:         selectedCountry.code ?? selectedCountry.name,
        currency:        agencyCurrency,
        primaryCurrency: agencyCurrency,
        // ✅ Type agence mis à jour
        type:            isPartner ? "PARTNER" : "SUBSIDIARY",
        subscriptionType: isPartner ? "PURCHASE" : "RENTAL",
        managerName:     `${managerFirstName.trim()} ${managerLastName.trim()}`.trim(),
      } as any);

      if (Platform.OS === "web") { alert("Agence modifiée !"); router.back(); }
      else Alert.alert("✅ Succès", "Agence modifiée avec succès !", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Erreur lors de la modification";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={T.sky} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.pageBg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Modifier l'Agence</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
              {selectedCountry.flag ?? ""} {selectedCountry.name}
            </Text>
            <CurrencyBadge currency={agencyCurrency} />
          </View>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Info banner */}
            <View style={s.alertBox}>
              <View style={s.alertIcon}>
                <Ionicons name="information" size={16} color={T.blue} />
              </View>
              <Text style={[s.alertTxt, { fontFamily: T.font.sans }]}>
                Modifier l'email changera l'identifiant de connexion du responsable.
              </Text>
            </View>

            {/* Type */}
            <View style={s.sectionCard}>
              <SectionHeader icon="storefront-outline" title="TYPE D'AGENCE" color={T.sky} />
              <TypeToggle isPartner={isPartner} onChange={setIsPartner} />
            </View>

            {/* Identité */}
            <View style={s.sectionCard}>
              <SectionHeader icon="business-outline" title="IDENTITÉ" color={T.sky} />
              <Field label="Nom de l'agence"       value={name}  onChangeText={setName}  required />
              <Field label="Code agence (unique)"  value={code}  onChangeText={setCode}  placeholder="LAB0001" />
              <Field label="Email (login responsable)" value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" required />
            </View>

            {/* Responsable */}
            <View style={s.sectionCard}>
              <SectionHeader icon="person-outline" title="RESPONSABLE" color={T.teal} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Prénom" value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Alpha" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Nom" value={managerLastName} onChangeText={setManagerLastName} placeholder="DIALLO" />
                </View>
              </View>

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
              {/* ✅ v2.1 FIX 2 : repère du format attendu pour l'indicatif choisi */}
              <Text style={[fS.hint, { fontFamily: T.font.sans }]}>{phoneRangeHint(phoneRange)}</Text>
            </View>

            {/* Localisation */}
            <View style={s.sectionCard}>
              <SectionHeader icon="location-outline" title="LOCALISATION" color={T.blue} />
              <SelectButton
                label="Pays"
                value={`${selectedCountry.flag ?? ""} ${selectedCountry.name}`}
                onPress={() => setShowCountryModal(true)}
              />
              <SelectButton
                label="Ville"
                value={city}
                onPress={() => {
                  if (availableCities.length > 0) setShowCityModal(true);
                  else Alert.alert("Info", "Sélectionnez un pays avec des villes disponibles.");
                }}
              />
              <Field
                label="Adresse complète"
                value={address} onChangeText={setAddress}
                placeholder="Quartier, Rue, numéro…"
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

            {/* Bouton enregistrer */}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.65 }]}
              onPress={handleUpdate}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving
                ? <ActivityIndicator color={T.white} />
                : <>
                    <Ionicons name="checkmark-done-outline" size={20} color={T.white} />
                    <Text style={[s.saveBtnTxt, { fontFamily: T.font.sans }]}>
                      ENREGISTRER LES MODIFICATIONS
                    </Text>
                  </>
              }
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Modals */}
      <PickerModal
        visible={showCountryModal} onClose={() => setShowCountryModal(false)}
        title="Pays" data={countriesList}
        onSelect={(c: CountryData) => { setSelectedCountry(c); setSelectedPhoneCode(c); setCity(""); }}
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
        onSelect={(c: string) => setCity(c)}
        renderItem={(item: string) => (
          <Text style={[{ fontSize: 14, color: T.ink, fontWeight: "600" }, { fontFamily: T.font.sans }]}>
            {item}
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.borderLt, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: T.ink },
  headerSub:   { fontSize: 11, color: T.inkSub, fontWeight: "600" },

  scroll: { padding: 20 },

  sectionCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
    ...T.shadow.soft,
  },

  alertBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.blueLt, borderRadius: T.radius.md,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  alertIcon: {
    width: 30, height: 30, borderRadius: 99,
    backgroundColor: "#DBEAFE",
    justifyContent: "center", alignItems: "center",
  },
  alertTxt: { color: "#1E40AF", flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  currencyInfo: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.skyLt, borderRadius: T.radius.md,
    padding: 12, borderWidth: 1, borderColor: T.skyMd + "60", marginTop: 4,
  },
  currencyInfoTxt: { color: T.sky, fontSize: 12, fontWeight: "600", flex: 1 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: T.sky, borderRadius: T.radius.lg,
    paddingVertical: 18, marginTop: 4,
    shadowColor: T.sky, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  saveBtnTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },
});