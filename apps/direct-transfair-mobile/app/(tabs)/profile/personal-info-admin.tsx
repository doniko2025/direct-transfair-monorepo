// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-admin.tsx
// =========================================================
// PERSONAL INFO — COMPANY ADMIN v5.3
// ✅ v5.1 : fix "page danse" (Animated.View séparé du ScrollView)
// ✅ v5.2 : paddingBottom 120 + champs identité civile complets
// ✅ v5.3 — 2 erreurs TypeScript corrigées :
//
//   FIX 1 — ts(2322) ligne 337 :
//   useState("M") → useState<"M" | "F">("M")
//   → TypeScript inférait string au lieu de "M" | "F"
//
//   FIX 2 — ts(2322) ligne 445 :
//   GenderPill.onChange: (v: string) → (v: "M" | "F")
//   → signature incompatible avec SetStateAction<"M" | "F">
//
//   FIX 3 — ts(2353) ligne 341 :
//   birthCity supprimé de l'objet updateProfile
//   → la propriété n'existe pas dans Partial<AuthUser>
//   → seul birthPlace est conservé (alias correct du champ)
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

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg:          "#F0FDFA",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F0FDFA",
  border:      "#CCFBF1",
  borderFocus: "#0D9488",
  accent:      "#0D9488",
  accentSoft:  "#CCFBF1",
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
function Field({
  label, value, onChange, editable = true, style, placeholder, keyboardType,
}: any) {
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
        {!editable && (
          <Ionicons name="lock-closed" size={12} color={T.textDim} style={{ paddingRight: 12 }} />
        )}
      </View>
    </View>
  );
}

const fS = StyleSheet.create({
  label:         { fontSize: 10, fontWeight: "800", color: T.textSub, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  box:           { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused:    { borderColor: T.borderFocus, shadowColor: T.accent, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  boxDisabled:   { backgroundColor: T.surfaceAlt },
  input:         { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600" },
  inputDisabled: { color: T.textSub },
});

// ─── Section Card ─────────────────────────────────────────
function SectionCard({ icon, title, children }: {
  icon: string; title: string; children: React.ReactNode;
}) {
  return (
    <View style={sC.card}>
      <View style={sC.header}>
        <View style={sC.iconBox}>
          <Ionicons name={icon as any} size={14} color={T.accentText} />
        </View>
        <Text style={[sC.title, { fontFamily: T.font.sans }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sC = StyleSheet.create({
  card:    { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  header:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.accentSoft, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 11, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Gender Pill ──────────────────────────────────────────
// ✅ FIX v5.3 : onChange typé (v: "M" | "F") au lieu de (v: string)
//    → compatible avec SetStateAction<"M" | "F"> de useState<"M" | "F">
function GenderPill({ value, onChange, editable }: {
  value: string;
  onChange: (v: "M" | "F") => void; // ✅ FIX ts(2322)
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

// ─── Country Picker Modal ─────────────────────────────────
function CountryPickerModal({ visible, onClose, onSelect, title }: {
  visible: boolean; onClose: () => void;
  onSelect: (c: CountryData) => void; title: string;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? countriesList.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : countriesList;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cpS.overlay}>
        <View style={cpS.sheet}>
          <View style={cpS.handle} />
          <View style={cpS.header}>
            <Text style={[cpS.title, { fontFamily: T.font.sans }]}>{title}</Text>
            <TouchableOpacity style={cpS.closeBtn} onPress={() => { onClose(); setQ(""); }}>
              <Ionicons name="close" size={18} color={T.textSub} />
            </TouchableOpacity>
          </View>
          <View style={cpS.searchBox}>
            <Ionicons name="search-outline" size={15} color={T.textDim} />
            <TextInput
              style={[cpS.searchInput, { fontFamily: T.font.sans }]}
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher un pays…"
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
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={cpS.item}
                onPress={() => { onSelect(item); onClose(); setQ(""); }}
                activeOpacity={0.75}
              >
                <Text style={cpS.flag}>{item.flag}</Text>
                <Text style={[cpS.itemName, { fontFamily: T.font.sans }]}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[cpS.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const cpS = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderWidth: 1, borderColor: T.border },
  handle:      { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border },
  title:       { fontSize: 17, fontWeight: "700", color: T.text },
  closeBtn:    { width: 32, height: 32, borderRadius: 9, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center" },
  searchBox:   { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: T.surfaceAlt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: T.text, fontWeight: "600" },
  item:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  flag:        { fontSize: 22 },
  itemName:    { fontSize: 14, fontWeight: "600", color: T.text },
  empty:       { color: T.textDim, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── Country Selector (champ + modal intégré) ─────────────
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
      <CountryPickerModal
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
        title={label}
      />
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────
export default function PersonalInfoAdmin() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading,   setLoading]   = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Identité & fonction
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [phone,        setPhone]        = useState("");
  const [jobTitle,     setJobTitle]     = useState("");
  const [agencyName,   setAgencyName]   = useState("");

  // Identité civile
  // ✅ FIX v5.3 ts(2322) : type explicite "M" | "F" pour correspondre à AuthUser.gender
  const [gender,       setGender]       = useState<"M" | "F">("M");
  const [nationality,  setNationality]  = useState("");
  const [birthDate,    setBirthDate]    = useState("");
  const [birthCity,    setBirthCity]    = useState("");
  const [birthCountry, setBirthCountry] = useState("");

  // Localisation
  const [city,    setCity]    = useState("");
  const [country, setCountry] = useState("");

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // ── Chargement depuis le contexte auth ────────────────
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName              || "");
    setLastName(user.lastName                || "");
    setPhone((user as any).phone             || "");
    setJobTitle((user as any).jobTitle       || "");
    setAgencyName(user.agency?.name || (user as any).agencyName || "");
    setGender(((user as any).gender as "M" | "F") || "M");
    setNationality(user.nationality          || "");
    setBirthDate(user.birthDate              || "");
    setBirthCity(user.birthPlace             || ""); // birthPlace = ville de naissance
    setBirthCountry((user as any).birthCountry || "");
    setCity(user.city                        || "");
    setCountry(user.country                  || "");
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  // ── Annulation ───────────────────────────────────────
  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName              || "");
    setLastName(user.lastName                || "");
    setPhone((user as any).phone             || "");
    setJobTitle((user as any).jobTitle       || "");
    setGender(((user as any).gender as "M" | "F") || "M");
    setNationality(user.nationality          || "");
    setBirthDate(user.birthDate              || "");
    setBirthCity(user.birthPlace             || "");
    setBirthCountry((user as any).birthCountry || "");
    setCity(user.city                        || "");
    setCountry(user.country                  || "");
    setIsEditing(false);
  };

  // ── Sauvegarde ───────────────────────────────────────
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
        // ✅ FIX v5.3 ts(2353) : birthCity supprimé — n'existe pas dans Partial<AuthUser>
        //    seul birthPlace (alias du champ DB) est conservé
        birthPlace:   birthCity.trim()    || undefined,
        birthCountry: birthCountry.trim() || undefined,
        city:         city.trim()         || undefined,
        country:      country.trim()      || undefined,
      });
      await refreshUser?.();
      setIsEditing(false);
      Alert.alert("Succès", "Profil mis à jour avec succès.");
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder les modifications.");
    } finally {
      setLoading(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
            Profil Administrateur
          </Text>
          <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
            Informations de votre compte
          </Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnCancel]}
          onPress={() => (isEditing ? cancelEdit() : setIsEditing(true))}
        >
          <Ionicons
            name={isEditing ? "close" : "pencil"}
            size={16}
            color={isEditing ? T.red : T.accentText}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 120, // dépasse la tab bar
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Animation d'entrée sur le contenu uniquement */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* ── Avatar / Résumé ── */}
            <View style={s.avatarCard}>
              <View style={s.avatarCircle}>
                <Text style={[s.avatarText, { fontFamily: T.font.display }]}>
                  {initials || "CA"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { fontFamily: T.font.display }]}>
                  {firstName || lastName
                    ? `${firstName} ${lastName}`.trim()
                    : "—"}
                </Text>
                {!!agencyName && (
                  <Text style={[s.agency, { fontFamily: T.font.sans }]}>{agencyName}</Text>
                )}
                <View style={s.badge}>
                  <Ionicons name="business-outline" size={10} color={T.accentText} />
                  <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Administrateur</Text>
                </View>
              </View>
            </View>

            {/* ══ 01 — IDENTITÉ & FONCTION ══ */}
            <SectionCard icon="person-outline" title="Identité & Fonction">
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field
                  label="Prénom" value={firstName} onChange={setFirstName}
                  editable={isEditing} style={{ flex: 1 }} placeholder="Prénom"
                />
                <Field
                  label="Nom" value={lastName} onChange={setLastName}
                  editable={isEditing} style={{ flex: 1 }} placeholder="Nom"
                />
              </View>
              <Field
                label="Téléphone"
                value={phone}
                onChange={setPhone}
                editable={isEditing}
                placeholder="+224 620 000 000"
                keyboardType="phone-pad"
              />
              <Field
                label="Fonction"
                value={jobTitle}
                onChange={setJobTitle}
                editable={isEditing}
                placeholder="Directeur Général…"
              />
              <Field label="Société" value={agencyName} editable={false} />
            </SectionCard>

            {/* ══ 02 — IDENTITÉ CIVILE ══ */}
            <SectionCard icon="id-card-outline" title="Identité Civile">
              <GenderPill value={gender} onChange={setGender} editable={isEditing} />
              <CountrySelector
                label="Nationalité"
                value={nationality}
                onSelect={(c) => setNationality(c.name)}
                editable={isEditing}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field
                  label="Date naissance"
                  value={birthDate}
                  onChange={setBirthDate}
                  editable={isEditing}
                  placeholder="JJ/MM/AAAA"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Lieu naissance"
                  value={birthCity}
                  onChange={setBirthCity}
                  editable={isEditing}
                  placeholder="Conakry"
                  style={{ flex: 1 }}
                />
              </View>
              <CountrySelector
                label="Pays de naissance"
                value={birthCountry}
                onSelect={(c) => setBirthCountry(c.name)}
                editable={isEditing}
              />
            </SectionCard>

            {/* ══ 03 — LOCALISATION ══ */}
            <SectionCard icon="location-outline" title="Localisation">
              <Field
                label="Ville" value={city} onChange={setCity}
                editable={isEditing} placeholder="Paris"
              />
              <Field
                label="Pays" value={country} onChange={setCountry}
                editable={isEditing} placeholder="France"
              />
            </SectionCard>

            {/* ── Bouton Enregistrer ── */}
            {isEditing && (
              <TouchableOpacity
                style={[s.saveBtn, loading && { opacity: 0.6 }]}
                onPress={save}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                    <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                  </>
                )}
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
    paddingBottom: 16,
    gap: 12,
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: T.radius.sm,
    backgroundColor: T.surfaceAlt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  headerTitle:   { color: T.text, fontSize: 17, fontWeight: "700" },
  headerSub:     { color: T.textDim, fontSize: 12, marginTop: 1 },
  editBtn: {
    width: 38, height: 38, borderRadius: T.radius.sm,
    backgroundColor: T.accentSoft,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  editBtnCancel: { backgroundColor: T.redSoft, borderColor: T.redBorder },

  avatarCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.surface, borderRadius: T.radius.xl,
    padding: 18, marginBottom: 14,
    borderWidth: 1.5, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.accentSoft,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: T.borderFocus,
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: T.accentText },
  name:       { fontSize: 17, fontWeight: "700", color: T.text },
  agency:     { fontSize: 13, color: T.textSub, marginTop: 2, fontWeight: "500" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6,
    backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },

  saveBtn: {
    backgroundColor: T.accent, borderRadius: T.radius.md,
    paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});