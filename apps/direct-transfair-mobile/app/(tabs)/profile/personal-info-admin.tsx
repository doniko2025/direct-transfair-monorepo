// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
// =========================================================
// PERSONAL INFO — COMPANY ADMIN v5.6
// ✅ v5.1 : fix danse clavier
// ✅ v5.2 : paddingBottom 120
// ✅ v5.3 : fixes TypeScript
// ✅ v5.4 : CountrySelector + CitySelector pour Localisation
// ✅ v5.5 : Fond blanc pur — plus de vert/teal en background
//    - bg        = #FFFFFF (était #F0FDFA vert transparent)
//    - surfaceAlt = #F4F7FA (gris neutre pour champs disabled/alt)
//    - border    = #E4E9F0 (gris neutre — plus de teal en bordure)
//    - accentSoft = #E8F9F6 (teal très doux conservé pour focus/sélection)
//    - SectionCard : ombre portée + bande teal gauche pour distinguer
//      les liens du fond blanc
//
// ✅ v5.6 : 🐛 3 correctifs
//
//   FIX 1 — "Société" : mauvaise source de lecture + verrouillé en dur
//     PROBLÈME : agencyName lisait user.agency?.name / user.agencyName,
//     deux champs qui n'existent jamais pour un COMPANY_ADMIN (il n'est
//     rattaché à aucune Agency — agency est réservé aux AGENT). Le nom
//     de LA société d'un admin vit dans user.client.name. Résultat :
//     le champ affichait toujours vide, et en plus était figé en dur
//     (editable={false}, sans onChange).
//     CORRECTIF : lecture depuis user.client?.name en priorité, champ
//     rendu éditable (comme les autres), sauvegardé séparément via le
//     nouvel endpoint self-service PATCH /clients/me/company-name
//     (voir api.updateMyCompanyName()) — updateProfile() (/auth/me)
//     ne peut pas modifier Client.name, ce n'est pas un champ User.
//
//   FIX 2 — Genre/Nationalité/Naissance qui semblaient ne jamais se
//     sauvegarder
//     Ce n'était pas ce fichier : AuthService.toPublicUser() (backend)
//     omettait gender/jobTitle/birthCountry dans sa réponse — même
//     bien enregistrés en base, ces 3 champs n'étaient jamais renvoyés
//     après une sauvegarde ni au chargement suivant. Corrigé côté
//     backend (auth.service.ts v5.2). Rien à changer ici pour ce point.
//
//   FIX 3 — Cadre rectangulaire au focus (web)
//     Même correctif que sur les autres écrans (agencies/edit.tsx,
//     agents.tsx…) : outlineStyle: 'none' sur les <TextInput>, web
//     uniquement, sans impact iOS/Android.
// =========================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, StatusBar, Animated, ScrollView, Modal, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";
import { api }     from "../../../services/api";
import { countriesList, type CountryData } from "../../../data/countries";
import { citiesByCountry }                 from "../../../data/cities";

// ─── Design tokens v5.5 ──────────────────────────────────
// Fond blanc pur — vert/teal uniquement pour les accents interactifs
const T = {
  bg:          "#FFFFFF",   // ✅ v5.5 : était #F0FDFA (vert transparent)
  surface:     "#FFFFFF",
  surfaceAlt:  "#F4F7FA",   // ✅ v5.5 : gris très léger pour disabled/alt
  border:      "#E4E9F0",   // ✅ v5.5 : gris neutre (était #CCFBF1 teal)
  borderFocus: "#0D9488",   // teal conservé pour le focus uniquement
  accent:      "#0D9488",
  accentSoft:  "#E8F9F6",   // ✅ v5.5 : teal très doux (était #CCFBF1)
  accentText:  "#0F766E",
  text:        "#0F172A",
  textSub:     "#374151",
  textDim:     "#9CA3AF",
  red:         "#DC2626",
  redSoft:     "#FEF2F2",
  redBorder:   "#FECACA",
  radius: { sm: 10, md: 14, lg: 20, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && fS.boxFocused, !editable && fS.boxDisabled]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={T.textDim}
          keyboardType={keyboardType}
          style={[fS.input, { fontFamily: T.font.sans }, !editable && fS.inputDisabled]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {!editable && <Ionicons name="lock-closed" size={12} color={T.textDim} style={{ paddingRight: 12 }} />}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  label:         { fontSize: 10, fontWeight: "800", color: T.textSub, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  // ✅ v5.5 : fond blanc + bordure grise neutre — focus bascule en teal
  box:           { backgroundColor: T.surface,    borderWidth: 1.5, borderColor: T.border,      borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused:    { borderColor: T.borderFocus,    backgroundColor: "#FAFFFE",
                   shadowColor: T.accent, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  boxDisabled:   { backgroundColor: T.surfaceAlt, borderColor: "#EAEEF4" },
  // ✅ v5.6 FIX 3 : supprime l'anneau de focus natif du navigateur (web
  // uniquement — ignoré sur iOS/Android). Le retour visuel au focus
  // reste géré par boxFocused ci-dessus.
  input:         {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  inputDisabled: { color: T.textSub },
});

// ─── Section Card ─────────────────────────────────────────
// ✅ v5.5 : ombre portée + bande accent gauche pour distinguer du fond blanc
function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={sC.card}>
      {/* Bande teal gauche — repère visuel sur fond blanc */}
      <View style={sC.accentBar} />
      <View style={sC.inner}>
        <View style={sC.header}>
          <View style={sC.iconBox}><Ionicons name={icon as any} size={14} color={T.accentText} /></View>
          <Text style={[sC.title, { fontFamily: T.font.sans }]}>{title}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}
const sC = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius:    T.radius.lg,
    marginBottom:    14,
    borderWidth:     1,
    borderColor:     T.border,
    flexDirection:   "row",
    overflow:        "hidden",
    // ✅ v5.5 : ombre accentuée pour faire ressortir les cartes sur blanc
    shadowColor:     "#64748B",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.10,
    shadowRadius:    14,
    elevation:       5,
  },
  // ✅ v5.5 : bande teal 4px sur le côté gauche
  accentBar: { width: 4, backgroundColor: T.accent },
  inner:     { flex: 1, padding: 18 },
  header:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox:   { width: 28, height: 28, borderRadius: 8, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  title:     { fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Gender Pill ──────────────────────────────────────────
function GenderPill({ value, onChange, editable }: {
  value:    string;
  onChange: (v: "M" | "F") => void;
  editable: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>GENRE</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {([{ k: "M", label: "Homme" }, { k: "F", label: "Femme" }] as const).map((opt) => {
          const active = value === opt.k;
          return (
            <TouchableOpacity
              key={opt.k}
              style={[gpS.pill, active && gpS.pillActive, !editable && { opacity: 0.6 }]}
              onPress={() => editable && onChange(opt.k)}
              disabled={!editable}
              activeOpacity={0.8}
            >
              {active && <View style={gpS.dot} />}
              <Text style={[gpS.label, { fontFamily: T.font.sans }, active && gpS.labelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const gpS = StyleSheet.create({
  pill:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, gap: 6 },
  pillActive:  { backgroundColor: T.accentSoft, borderColor: T.borderFocus },
  dot:         { width: 6, height: 6, borderRadius: 99, backgroundColor: T.accent },
  label:       { fontSize: 14, fontWeight: "600", color: T.textSub },
  labelActive: { color: T.accentText, fontWeight: "800" },
});

// ─── Styles partagés modals picker ────────────────────────
const cpS = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderWidth: 1, borderColor: T.border },
  handle:      { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  title:       { fontSize: 17, fontWeight: "700", color: T.text },
  closeBtn:    { width: 32, height: 32, borderRadius: 9, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center" },
  searchBox:   { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: T.surfaceAlt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, height: 44 },
  // ✅ v5.6 FIX 3 : même correctif d'anneau de focus natif que fS.input
  searchInput: {
    flex: 1, fontSize: 14, color: T.text, fontWeight: "600",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  item:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  flag:        { fontSize: 22 },
  itemName:    { flex: 1, fontSize: 14, fontWeight: "600", color: T.text },
  empty:       { color: T.textDim, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── Country Picker Modal ─────────────────────────────────
function CountryPickerModal({ visible, onClose, onSelect, title }: {
  visible: boolean; onClose: () => void;
  onSelect: (c: CountryData) => void; title: string;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? countriesList.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : countriesList;
  const close = () => { onClose(); setQ(""); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={cpS.overlay}>
        <View style={cpS.sheet}>
          <View style={cpS.handle} />
          <View style={cpS.header}>
            <Text style={[cpS.title, { fontFamily: T.font.sans }]}>{title}</Text>
            <TouchableOpacity style={cpS.closeBtn} onPress={close}>
              <Ionicons name="close" size={18} color={T.textSub} />
            </TouchableOpacity>
          </View>
          <View style={cpS.searchBox}>
            <Ionicons name="search-outline" size={15} color={T.textDim} />
            <TextInput
              style={[cpS.searchInput, { fontFamily: T.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Rechercher un pays…" placeholderTextColor={T.textDim}
              autoFocus
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color={T.textDim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={cpS.item} onPress={() => { onSelect(item); close(); }} activeOpacity={0.75}>
                <Text style={cpS.flag}>{item.flag}</Text>
                <Text style={[cpS.itemName, { fontFamily: T.font.sans }]}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[cpS.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Country Selector ─────────────────────────────────────
function CountrySelector({ label, value, onSelect, editable = true }: {
  label: string; value: string;
  onSelect: (c: CountryData) => void; editable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const found = countriesList.find(c => c.name === value || c.code === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TouchableOpacity
        style={[fS.box, !editable && fS.boxDisabled]}
        onPress={() => editable && setOpen(true)}
        disabled={!editable}
        activeOpacity={0.8}
      >
        <Text style={[fS.input, { color: found ? T.text : T.textDim }]}>
          {found ? `${found.flag}  ${found.name}` : "Sélectionner…"}
        </Text>
        {editable
          ? <Ionicons name="chevron-down" size={15} color={T.textDim} style={{ paddingRight: 12 }} />
          : <Ionicons name="lock-closed"  size={12} color={T.textDim} style={{ paddingRight: 12 }} />
        }
      </TouchableOpacity>
      <CountryPickerModal visible={open} onClose={() => setOpen(false)} onSelect={onSelect} title={label} />
    </View>
  );
}

// ─── City Selector ────────────────────────────────────────
function CitySelector({ label, value, onSelect, cities, editable = true }: {
  label: string; value: string;
  onSelect: (city: string) => void;
  cities: string[]; editable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState("");
  const filtered = q.trim()
    ? cities.filter(c => c.toLowerCase().includes(q.toLowerCase()))
    : cities;
  const close = () => { setOpen(false); setQ(""); };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TouchableOpacity
        style={[fS.box, !editable && fS.boxDisabled]}
        onPress={() => editable && setOpen(true)}
        disabled={!editable}
        activeOpacity={0.8}
      >
        <Text style={[fS.input, { color: value ? T.text : T.textDim }]}>
          {value || "Sélectionner une ville…"}
        </Text>
        {editable
          ? <Ionicons name="chevron-down" size={15} color={T.textDim} style={{ paddingRight: 12 }} />
          : <Ionicons name="lock-closed"  size={12} color={T.textDim} style={{ paddingRight: 12 }} />
        }
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={cpS.overlay}>
          <View style={cpS.sheet}>
            <View style={cpS.handle} />
            <View style={cpS.header}>
              <Text style={[cpS.title, { fontFamily: T.font.sans }]}>{label}</Text>
              <TouchableOpacity style={cpS.closeBtn} onPress={close}>
                <Ionicons name="close" size={18} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <View style={cpS.searchBox}>
              <Ionicons name="search-outline" size={15} color={T.textDim} />
              <TextInput
                style={[cpS.searchInput, { fontFamily: T.font.sans }]}
                value={q} onChangeText={setQ}
                placeholder="Rechercher une ville…" placeholderTextColor={T.textDim}
                autoFocus
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color={T.textDim} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[cpS.item, value === item && { backgroundColor: T.accentSoft }]}
                  onPress={() => { onSelect(item); close(); }}
                  activeOpacity={0.75}
                >
                  <Text style={[cpS.itemName, { fontFamily: T.font.sans }, value === item && { color: T.accentText, fontWeight: "700" }]}>
                    {item}
                  </Text>
                  {value === item && <Ionicons name="checkmark-circle" size={16} color={T.accent} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[cpS.empty, { fontFamily: T.font.sans }]}>Aucune ville disponible</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────
export default function PersonalInfoAdmin() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading,      setLoading]      = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [phone,        setPhone]        = useState("");
  const [jobTitle,     setJobTitle]     = useState("");
  const [agencyName,   setAgencyName]   = useState("");
  const [gender,       setGender]       = useState<"M" | "F">("M");
  const [nationality,  setNationality]  = useState("");
  const [birthDate,    setBirthDate]    = useState("");
  const [birthCity,    setBirthCity]    = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [city,         setCity]         = useState("");
  const [country,      setCountry]      = useState("");

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // ✅ v5.6 FIX 1 : nom de société — pour ne l'envoyer à la sauvegarde
  // QUE s'il a réellement changé (évite un appel réseau inutile).
  const initialAgencyNameRef = useRef("");

  const loadFromUser = () => {
    if (!user) return;
    setFirstName(user.firstName                                         || "");
    setLastName(user.lastName                                           || "");
    setPhone((user as any).phone                                        || "");
    setJobTitle((user as any).jobTitle                                  || "");
    // ✅ v5.6 FIX 1 : user.client.name en priorité — un COMPANY_ADMIN
    // n'a pas d'agence (agency est réservé aux AGENT), donc
    // user.agency?.name / user.agencyName sont toujours vides pour ce
    // rôle. Le vrai nom de la société vit sur user.client.name.
    const companyName = (user as any).client?.name || (user as any).agency?.name || (user as any).agencyName || "";
    setAgencyName(companyName);
    initialAgencyNameRef.current = companyName;
    setGender(((user as any).gender as "M" | "F")                       || "M");
    setNationality(user.nationality                                     || "");
    setBirthDate(user.birthDate                                         || "");
    setBirthCity(user.birthPlace                                        || "");
    setBirthCountry((user as any).birthCountry                          || "");
    setCity(user.city                                                   || "");
    setCountry(user.country                                             || "");
  };

  useEffect(() => {
    if (!user) return;
    loadFromUser();
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  const cancelEdit = () => {
    loadFromUser();
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Champs requis", "Prénom et nom sont obligatoires.");
      return;
    }
    try {
      setLoading(true);

      await api.updateProfile({
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        phone:        phone.trim()        || undefined,
        jobTitle:     jobTitle.trim()     || undefined,
        gender,
        nationality:  nationality.trim()  || undefined,
        birthDate:    birthDate.trim()    || undefined,
        birthPlace:   birthCity.trim()    || undefined,
        birthCountry: birthCountry.trim() || undefined,
        city:         city.trim()         || undefined,
        country:      country.trim()      || undefined,
      });

      // ✅ v5.6 FIX 1 — Société : Client.name n'est PAS un champ User,
      // donc updateProfile() (/auth/me) ne peut pas le modifier. On
      // appelle l'endpoint self-service dédié, uniquement si la valeur
      // a changé (évite un appel réseau inutile à chaque sauvegarde).
      const trimmedAgencyName = agencyName.trim();
      if (trimmedAgencyName && trimmedAgencyName !== initialAgencyNameRef.current) {
        await api.updateMyCompanyName(trimmedAgencyName);
      }

      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("Succès", "Profil mis à jour avec succès.");
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : (msg || "Impossible de sauvegarder les modifications."));
    } finally { setLoading(false); }
  };

  // Villes disponibles pour le pays de résidence
  const countryName = countriesList.find(c => c.code === country || c.name === country)?.name ?? country;
  const locCities   = citiesByCountry[countryName] ?? [];
  const showCityPicker = isEditing && locCities.length > 0;

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Administrateur</Text>
          <Text style={[s.headerSub,   { fontFamily: T.font.sans   }]}>Informations de votre compte</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnCancel]}
          onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
        >
          <Ionicons name={isEditing ? "close" : "pencil"} size={16} color={isEditing ? T.red : T.accentText} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // ✅ v5.5 : fond blanc explicite sur le scroll
          style={{ backgroundColor: T.bg }}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Avatar card */}
            <View style={s.avatarCard}>
              <View style={s.avatarCircle}>
                <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "CA"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { fontFamily: T.font.display }]}>
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
                </Text>
                {!!agencyName && <Text style={[s.agency, { fontFamily: T.font.sans }]}>{agencyName}</Text>}
                <View style={s.badge}>
                  <Ionicons name="business-outline" size={10} color={T.accentText} />
                  <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Administrateur</Text>
                </View>
              </View>
            </View>

            {/* 01 — Identité & Fonction */}
            <SectionCard icon="person-outline" title="Identité & Fonction">
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
                <Field label="Nom"    value={lastName}  onChange={setLastName}  editable={isEditing} style={{ flex: 1 }} placeholder="Nom"    />
              </View>
              <Field label="Téléphone" value={phone}      onChange={setPhone}    editable={isEditing} keyboardType="phone-pad" placeholder="+224 620 000 000" />
              <Field label="Fonction"  value={jobTitle}   onChange={setJobTitle} editable={isEditing} placeholder="Directeur Général…" />
              {/* ✅ v5.6 FIX 1 : déverrouillé, source de lecture corrigée
                  (user.client.name), sauvegarde via endpoint dédié dans save() */}
              <Field label="Société"   value={agencyName} onChange={setAgencyName} editable={isEditing} placeholder="Nom de la société" />
            </SectionCard>

            {/* 02 — Identité Civile */}
            <SectionCard icon="id-card-outline" title="Identité Civile">
              <GenderPill value={gender} onChange={setGender} editable={isEditing} />
              <CountrySelector label="Nationalité" value={nationality} onSelect={(c) => setNationality(c.name)} editable={isEditing} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Date naissance" value={birthDate} onChange={setBirthDate} editable={isEditing} placeholder="JJ/MM/AAAA" style={{ flex: 1 }} />
                <Field label="Lieu naissance" value={birthCity} onChange={setBirthCity} editable={isEditing} placeholder="Conakry"    style={{ flex: 1 }} />
              </View>
              <CountrySelector label="Pays de naissance" value={birthCountry} onSelect={(c) => setBirthCountry(c.name)} editable={isEditing} />
            </SectionCard>

            {/* 03 — Localisation */}
            <SectionCard icon="location-outline" title="Localisation">
              <CountrySelector
                label="Pays"
                value={country}
                onSelect={(c) => {
                  setCountry(c.name);
                  const cities = citiesByCountry[c.name] ?? [];
                  if (city && cities.length > 0 && !cities.includes(city)) setCity("");
                }}
                editable={isEditing}
              />
              {showCityPicker ? (
                <CitySelector label="Ville" value={city} onSelect={setCity} cities={locCities} editable={isEditing} />
              ) : (
                <Field label="Ville" value={city} onChange={setCity} editable={isEditing} placeholder="Paris" />
              )}
            </SectionCard>

            {/* Bouton Enregistrer */}
            {isEditing && (
              <TouchableOpacity
                style={[s.saveBtn, loading && { opacity: 0.6 }]}
                onPress={save} disabled={loading} activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <>
                      <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                      <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                    </>
                }
              </TouchableOpacity>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16, gap: 12,
    // ✅ v5.5 : header blanc avec séparateur neutre
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: T.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3,
  },
  backBtn:       { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle:   { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub:     { color: T.textDim, fontSize: 12, marginTop: 1 },
  editBtn:       { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  editBtnCancel: { backgroundColor: T.redSoft, borderColor: T.redBorder },

  // ✅ v5.5 : avatar card avec ombre neutre (pas de fond vert)
  avatarCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: T.radius.xl, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: T.borderFocus },
  avatarText:   { fontSize: 20, fontWeight: "700", color: T.accentText },
  name:         { fontSize: 17, fontWeight: "700", color: T.text },
  agency:       { fontSize: 13, color: T.textSub, marginTop: 2, fontWeight: "500" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  badgeText:    { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },

  saveBtn: { backgroundColor: T.accent, borderRadius: T.radius.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});