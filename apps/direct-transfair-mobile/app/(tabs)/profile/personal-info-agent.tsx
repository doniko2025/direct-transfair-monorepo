// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-agent.tsx
// =========================================================
// PERSONAL INFO — AGENT v6.0
// Design: Soleil & Sable — thème 100% clair
// ✅ v6.0 :
//    - Fix danse clavier : ScrollView normal + Animated.View intérieur
//      (Animated.ScrollView causait une boucle d'animation à chaque
//       ouverture du clavier)
//    - Fix masquage tab bar : paddingBottom 40 → 100
//      (tab bar flottante = 68h + 16 bottom = 84px minimum)
//    - Pays : PickerModal depuis countriesList (flag + nom)
//    - Ville : PickerModal si villes dispo (citiesByCountry),
//              sinon champ texte libre
//    - Changement de pays → réinitialise la ville si elle n'existe plus
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
import { api }       from "../../../services/api";
import { countriesList }  from "../../../data/countries";
import { citiesByCountry } from "../../../data/cities";

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg:          "#FFFBEB",
  surface:     "#FFFFFF",
  surfaceAlt:  "#FEF3C7",
  border:      "#FDE68A",
  borderFocus: "#D97706",
  accent:      "#D97706",
  accentSoft:  "#FEF3C7",
  accentText:  "#B45309",
  text:        "#1C1917",
  textSub:     "#57534E",
  textDim:     "#A8A29E",
  red:         "#DC2626",
  redSoft:     "#FEF2F2",
  redBorder:   "#FECACA",
  radius: { sm: 10, md: 14, lg: 20, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

// ─── Field — texte libre ──────────────────────────────────
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
  label:       { fontSize: 10, fontWeight: "800", color: T.textSub, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  box:         { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused:  { borderColor: T.borderFocus, shadowColor: T.accent, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  boxDisabled: { backgroundColor: T.surfaceAlt },
  input:       { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600" },
  inputDisabled: { color: T.textSub },
});

// ─── PickerField — sélecteur modal ────────────────────────
type PickerOption = { label: string; value: string; flag?: string };

function PickerField({ label, value, onSelect, options, editable = true, style, placeholder }: {
  label:       string;
  value:       string;
  onSelect:    (v: string) => void;
  options:     PickerOption[];
  editable?:   boolean;
  style?:      any;
  placeholder?: string;
}) {
  const [open, setOpen]   = useState(false);
  const [q,    setQ]      = useState("");

  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  const selected    = options.find(o => o.value === value);
  const displayText = selected
    ? `${selected.flag ? selected.flag + "  " : ""}${selected.label}`
    : (value || "");

  const close = () => { setOpen(false); setQ(""); };

  return (
    <>
      <View style={[{ marginBottom: 14 }, style]}>
        <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <TouchableOpacity
          style={[fS.box, !editable && fS.boxDisabled]}
          onPress={() => editable && setOpen(true)}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Text
            style={[
              fS.input, { fontFamily: T.font.sans },
              !displayText && { color: T.textDim },
              !editable && fS.inputDisabled,
            ]}
            numberOfLines={1}
          >
            {displayText || placeholder || "Sélectionner…"}
          </Text>
          {editable
            ? <Ionicons name="chevron-down"  size={14} color={T.textDim} style={{ paddingRight: 12 }} />
            : <Ionicons name="lock-closed"   size={12} color={T.textDim} style={{ paddingRight: 12 }} />
          }
        </TouchableOpacity>
      </View>

      {/* Modale bottom-sheet */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={pk.overlay}>
          <View style={pk.sheet}>
            <View style={pk.handle} />

            {/* En-tête */}
            <View style={pk.header}>
              <Text style={[pk.title, { fontFamily: T.font.display }]}>{label}</Text>
              <TouchableOpacity style={pk.closeBtn} onPress={close}>
                <Ionicons name="close" size={18} color={T.textSub} />
              </TouchableOpacity>
            </View>

            {/* Barre de recherche */}
            <View style={pk.searchRow}>
              <Ionicons name="search" size={14} color={T.textDim} />
              <TextInput
                style={[pk.searchInput, { fontFamily: T.font.sans }]}
                value={q}
                onChangeText={setQ}
                placeholder="Rechercher…"
                placeholderTextColor={T.textDim}
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
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[pk.item, isSelected && pk.itemSelected]}
                    onPress={() => { onSelect(item.value); close(); }}
                    activeOpacity={0.7}
                  >
                    {item.flag && <Text style={pk.itemFlag}>{item.flag}</Text>}
                    <Text style={[
                      pk.itemLabel, { fontFamily: T.font.sans },
                      isSelected && { color: T.accent, fontWeight: "700" },
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={T.accent} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[pk.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const pk = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(28,25,23,0.50)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "82%", borderWidth: 1, borderColor: T.border },
  handle:       { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: T.border },
  title:        { fontSize: 17, fontWeight: "700", color: T.text },
  closeBtn:     { width: 30, height: 30, borderRadius: 9, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center" },
  searchRow:    { flexDirection: "row", alignItems: "center", gap: 10, margin: 14, backgroundColor: T.surfaceAlt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 12, height: 42 },
  searchInput:  { flex: 1, fontSize: 14, color: T.text, fontWeight: "600" },
  item:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#FEF9EE", gap: 12 },
  itemSelected: { backgroundColor: "#FFFBEB" },
  itemFlag:     { fontSize: 20 },
  itemLabel:    { flex: 1, fontSize: 14, fontWeight: "500", color: T.text },
  empty:        { textAlign: "center", color: T.textDim, padding: 24, fontWeight: "600", fontSize: 13 },
});

// ─── Options pays (construites une seule fois) ────────────
const COUNTRY_OPTIONS: PickerOption[] = countriesList.map(c => ({
  label: c.name,
  value: c.code,
  flag:  c.flag,
}));

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoAgent() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading,    setLoading]    = useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [city,       setCity]       = useState("");
  const [country,    setCountry]    = useState("");
  const [agencyName, setAgencyName] = useState("");

  // ✅ Animations sur Animated.Value (non liées au ScrollView)
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName  || "");
    setLastName(user.lastName    || "");
    setPhone(user.phone          || "");
    setCity(user.city            || "");
    setCountry(user.country      || "");
    setAgencyName((user as any).agency?.name || (user as any).agencyName || "");

    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName   || "");
    setCity(user.city           || "");
    setCountry(user.country     || "");
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
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        city,
        country,
      });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("Succès", "Profil agent mis à jour.");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    } finally { setLoading(false); }
  };

  // ── Résolution pays → liste de villes ──────────────────
  const selectedCountryData = countriesList.find(c => c.code === country);
  const availableCities     = selectedCountryData
    ? (citiesByCountry[selectedCountryData.name] ?? [])
    : [];

  const handleCountryChange = (code: string) => {
    setCountry(code);
    // Si la ville actuelle n'existe pas dans le nouveau pays, on la réinitialise
    const newCountryData = countriesList.find(c => c.code === code);
    if (newCountryData) {
      const cities = citiesByCountry[newCountryData.name] ?? [];
      if (city && cities.length > 0 && !cities.includes(city)) {
        setCity("");
      }
    }
  };

  const cityOptions: PickerOption[] = availableCities.map(c => ({ label: c, value: c }));
  // Afficher le picker de ville uniquement en mode édition ET si des villes existent
  const showCityPicker = isEditing && availableCities.length > 0;

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header fixe ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Profil Agent</Text>
          <Text style={[s.headerSub,   { fontFamily: T.font.sans   }]}>Vos informations personnelles</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnCancel]}
          onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
        >
          <Ionicons
            name={isEditing ? "close" : "pencil"}
            size={16}
            color={isEditing ? T.red : T.accentText}
          />
        </TouchableOpacity>
      </View>

      {/* ✅ Fix danse clavier :
           - KeyboardAvoidingView → inchangé (iOS only)
           - ScrollView NORMAL (plus Animated.ScrollView)
           - Animated.View INTÉRIEUR au ScrollView
           → le clavier ajuste le ScrollView normalement,
             sans rejouer l'animation de chargement */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop:    16,
            paddingBottom: 100, // ✅ Fix masquage : 68 (tab) + 16 (bottom) + 16 (marge)
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ✅ L'animation est sur le contenu, PAS sur le ScrollView */}
          <Animated.View style={{
            opacity:   fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}>

            {/* ── Avatar card ── */}
            <View style={s.avatarCard}>
              <View style={s.avatarCircle}>
                <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "AG"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { fontFamily: T.font.display }]}>
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
                </Text>
                {!!agencyName && (
                  <Text style={[s.agency, { fontFamily: T.font.sans }]}>{agencyName}</Text>
                )}
                <View style={s.badge}>
                  <Ionicons name="briefcase-outline" size={10} color={T.accentText} />
                  <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Agent</Text>
                </View>
              </View>
            </View>

            {/* ── Identité card ── */}
            <View style={s.card}>
              <View style={s.sectionHeader}>
                <View style={s.iconBox}>
                  <Ionicons name="person-outline" size={14} color={T.accentText} />
                </View>
                <Text style={[s.sectionTitle, { fontFamily: T.font.sans }]}>IDENTITÉ</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Prénom" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
                <Field label="Nom"    value={lastName}  onChange={setLastName}  editable={isEditing} style={{ flex: 1 }} placeholder="Nom"    />
              </View>
              <Field label="Téléphone"      value={phone}      editable={false}    keyboardType="phone-pad" placeholder="—" />
              <Field label="Agence affectée" value={agencyName} editable={false}    placeholder="—" />
            </View>

            {/* ── Localisation card ── */}
            <View style={s.card}>
              <View style={s.sectionHeader}>
                <View style={s.iconBox}>
                  <Ionicons name="location-outline" size={14} color={T.accentText} />
                </View>
                <Text style={[s.sectionTitle, { fontFamily: T.font.sans }]}>LOCALISATION</Text>
              </View>

              {/* ✅ Pays — sélecteur modal avec drapeau */}
              <PickerField
                label="Pays"
                value={country}
                onSelect={handleCountryChange}
                options={COUNTRY_OPTIONS}
                editable={isEditing}
                placeholder="Sélectionner un pays"
              />

              {/* ✅ Ville — picker si villes connues, sinon texte libre */}
              {showCityPicker ? (
                <PickerField
                  label="Ville"
                  value={city}
                  onSelect={setCity}
                  options={cityOptions}
                  editable={isEditing}
                  placeholder="Sélectionner une ville"
                />
              ) : (
                <Field
                  label="Ville"
                  value={city}
                  onChange={setCity}
                  editable={isEditing}
                  placeholder="Votre ville"
                />
              )}
            </View>

            {/* ── Bouton Enregistrer ── */}
            {isEditing && (
              <TouchableOpacity
                style={[s.saveBtn, loading && { opacity: 0.6 }]}
                onPress={save}
                disabled={loading}
                activeOpacity={0.85}
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

// ─── Styles principaux ────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:       { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle:   { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub:     { color: T.textDim, fontSize: 12, marginTop: 1 },
  editBtn:       { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  editBtnCancel: { backgroundColor: T.redSoft, borderColor: T.redBorder },

  avatarCard:   { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: T.borderFocus },
  avatarText:   { fontSize: 20, fontWeight: "700", color: T.accentText },
  name:         { fontSize: 17, fontWeight: "700", color: T.text },
  agency:       { fontSize: 13, color: T.textSub, marginTop: 2, fontWeight: "500" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  badgeText:    { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },

  card:          { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox:       { width: 28, height: 28, borderRadius: 8, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  sectionTitle:  { fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5 },

  saveBtn: {
    backgroundColor: T.accent, borderRadius: T.radius.md,
    paddingVertical: 16, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});