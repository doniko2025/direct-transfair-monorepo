// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info-wallet.tsx
// =========================================================
// PERSONAL INFO — CLIENT (WALLET) v5.2
// ✅ v5.1 : paddingBottom 40 → 120
// ✅ v5.2 :
//    - Fix danse clavier : ScrollView normal + Animated.View intérieur
//      (Animated.ScrollView causait une boucle à chaque focus de champ)
//    - CityPicker modal pour le champ Ville dans "Adresse de Résidence"
//      (si des villes sont disponibles pour le pays sélectionné)
//    - Changement de pays → ville réinitialisée si elle n'est plus dispo
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
import { api }    from "../../../services/api";
import { COUNTRIES }        from "../../../utils/countries";
import { citiesByCountry }  from "../../../data/cities";

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg:          "#ECFDF5",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F0FDF4",
  border:      "#A7F3D0",
  borderFocus: "#059669",
  accent:      "#059669",
  accentSoft:  "#D1FAE5",
  accentText:  "#065F46",
  text:        "#0F172A",
  textSub:     "#374151",
  textDim:     "#9CA3AF",
  red:         "#DC2626",
  redSoft:     "#FEF2F2",
  redBorder:   "#FECACA",
  info:        "#0284C7",
  infoSoft:    "#E0F2FE",
  radius: { sm: 10, md: 14, lg: 20, xl: 24 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChange, editable = true, style, placeholder, keyboardType, maxLength }: any) {
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
          maxLength={maxLength}
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
  box:           { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, flexDirection: "row", alignItems: "center" },
  boxFocused:    { borderColor: T.borderFocus, shadowColor: T.accent, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  boxDisabled:   { backgroundColor: T.surfaceAlt },
  input:         { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, fontWeight: "600" },
  inputDisabled: { color: T.textSub },
});

// ─── CountryPicker (pays — liste texte via COUNTRIES) ──────
function CountryPicker({ label, value, onChange, editable }: any) {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? (COUNTRIES as string[]).filter(c => c.toLowerCase().includes(q.toLowerCase()))
    : (COUNTRIES as string[]);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TouchableOpacity
        style={[fS.box, !editable && fS.boxDisabled, { paddingHorizontal: 14, paddingVertical: 13 }]}
        onPress={() => editable && setVisible(true)}
        activeOpacity={editable ? 0.8 : 1}
      >
        <Text style={{ flex: 1, fontSize: 14, color: value ? T.text : T.textDim, fontWeight: "600", fontFamily: T.font.sans }}>
          {value || "Sélectionner…"}
        </Text>
        {editable
          ? <Ionicons name="chevron-down" size={14} color={T.accent} />
          : <Ionicons name="lock-closed"  size={12} color={T.textDim} />
        }
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "72%", borderWidth: 1, borderColor: T.border }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border }}>
              <Text style={{ color: T.text, fontSize: 17, fontWeight: "700", fontFamily: T.font.display }}>Sélectionner un pays</Text>
              <TouchableOpacity
                style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border }}
                onPress={() => { setVisible(false); setQ(""); }}
              >
                <Ionicons name="close" size={17} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", margin: 14, gap: 8, backgroundColor: T.surfaceAlt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 12, height: 42 }}>
              <Ionicons name="search" size={14} color={T.textDim} />
              <TextInput
                style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: "600", fontFamily: T.font.sans }}
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
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: value === item ? T.accentSoft : T.surface }}
                  onPress={() => { onChange(item); setVisible(false); setQ(""); }}
                >
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: value === item ? "700" : "500", fontFamily: T.font.sans }}>{item}</Text>
                  {value === item && <Ionicons name="checkmark-circle" size={18} color={T.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── CityPicker ✅ v5.2 ───────────────────────────────────
function CityPicker({ label, value, onChange, cities, editable }: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  cities:   string[];
  editable: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? cities.filter(c => c.toLowerCase().includes(q.toLowerCase()))
    : cities;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TouchableOpacity
        style={[fS.box, !editable && fS.boxDisabled, { paddingHorizontal: 14, paddingVertical: 13 }]}
        onPress={() => editable && setVisible(true)}
        activeOpacity={editable ? 0.8 : 1}
      >
        <Text style={{ flex: 1, fontSize: 14, color: value ? T.text : T.textDim, fontWeight: "600", fontFamily: T.font.sans }}>
          {value || "Sélectionner une ville…"}
        </Text>
        {editable
          ? <Ionicons name="chevron-down" size={14} color={T.accent} />
          : <Ionicons name="lock-closed"  size={12} color={T.textDim} />
        }
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { setVisible(false); setQ(""); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "72%", borderWidth: 1, borderColor: T.border }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 14 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.border }}>
              <Text style={{ color: T.text, fontSize: 17, fontWeight: "700", fontFamily: T.font.display }}>{label}</Text>
              <TouchableOpacity
                style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: T.surfaceAlt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border }}
                onPress={() => { setVisible(false); setQ(""); }}
              >
                <Ionicons name="close" size={17} color={T.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", margin: 14, gap: 8, backgroundColor: T.surfaceAlt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 12, height: 42 }}>
              <Ionicons name="search" size={14} color={T.textDim} />
              <TextInput
                style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: "600", fontFamily: T.font.sans }}
                value={q}
                onChangeText={setQ}
                placeholder="Rechercher une ville…"
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
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: value === item ? T.accentSoft : T.surface }}
                  onPress={() => { onChange(item); setVisible(false); setQ(""); }}
                >
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: value === item ? "700" : "500", fontFamily: T.font.sans }}>{item}</Text>
                  {value === item && <Ionicons name="checkmark-circle" size={18} color={T.accent} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: T.textDim, fontSize: 13, fontFamily: T.font.sans }}>Aucune ville disponible</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────
function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={sC.card}>
      <View style={sC.header}>
        <View style={sC.iconBox}><Ionicons name={icon as any} size={14} color={T.accentText} /></View>
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

// ─── Main Screen ──────────────────────────────────────────
export default function PersonalInfoWallet() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [loading,     setLoading]     = useState(false);
  const [isEditing,   setIsEditing]   = useState(false);
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [birthDate,   setBirthDate]   = useState("");
  const [birthPlace,  setBirthPlace]  = useState("");
  const [nationality, setNationality] = useState("");
  const [address,     setAddress]     = useState("");
  const [postalCode,  setPostalCode]  = useState("");
  const [city,        setCity]        = useState("");
  const [country,     setCountry]     = useState("");

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const formatDate = (iso: string) => {
    if (!iso) return "";
    if (iso.includes("T") || iso.includes("-")) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
    return iso;
  };

  const handleDateChange = (text: string) => {
    let c = text.replace(/\D/g, "");
    if (c.length > 4) c = `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
    else if (c.length > 2) c = `${c.slice(0, 2)}/${c.slice(2, 4)}`;
    setBirthDate(c);
  };

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName     || "");
    setLastName(user.lastName       || "");
    setPhone(user.phone             || "");
    setEmail(user.email             || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace   || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet   || "");
    setPostalCode(user.postalCode   || "");
    setCity(user.city               || "");
    setCountry(user.country         || "");
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 2 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 2 }),
    ]).start();
  }, [user]);

  const cancelEdit = () => {
    if (!user) return;
    setFirstName(user.firstName     || "");
    setLastName(user.lastName       || "");
    setPhone(user.phone             || "");
    setBirthDate(formatDate(user.birthDate || ""));
    setBirthPlace(user.birthPlace   || "");
    setNationality(user.nationality || "");
    setAddress(user.addressStreet   || "");
    setPostalCode(user.postalCode   || "");
    setCity(user.city               || "");
    setCountry(user.country         || "");
    setIsEditing(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !city.trim() || !country.trim()) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    if (birthDate.length > 0 && birthDate.length !== 10) {
      Alert.alert("Format invalide", "La date doit être au format JJ/MM/AAAA.");
      return;
    }
    try {
      setLoading(true);
      const parsedDate = birthDate.length === 10
        ? (() => { const p = birthDate.split("/"); return `${p[2]}-${p[1]}-${p[0]}T00:00:00.000Z`; })()
        : undefined;
      await api.updateProfile({
        firstName:     firstName.trim(),
        lastName:      lastName.trim(),
        phone:         phone.trim(),
        birthDate:     parsedDate,
        birthPlace:    birthPlace.trim(),
        nationality,
        addressStreet: address.trim(),
        postalCode:    postalCode.trim(),
        city:          city.trim(),
        country,
      });
      await refreshUser();
      setIsEditing(false);
      Alert.alert("Succès", "Informations mises à jour avec succès.");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible d'enregistrer.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  // ── Villes disponibles pour le pays de résidence ✅ v5.2
  const residenceCities  = citiesByCountry[country] ?? [];
  const showCityPicker   = isEditing && residenceCities.length > 0;

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
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mes Informations</Text>
          <Text style={[s.headerSub,   { fontFamily: T.font.sans   }]}>Profil & KYC</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, isEditing && s.editBtnCancel]}
          onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
        >
          <Ionicons name={isEditing ? "close" : "pencil"} size={16} color={isEditing ? T.red : T.accentText} />
        </TouchableOpacity>
      </View>

      {/* ✅ Fix danse clavier : ScrollView normal + Animated.View intérieur */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 120,  // espace tab bar flottante
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Avatar */}
            <View style={s.avatarCard}>
              <View style={s.avatarCircle}>
                <Text style={[s.avatarText, { fontFamily: T.font.display }]}>{initials || "CL"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { fontFamily: T.font.display }]}>
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : "—"}
                </Text>
                {!!email && <Text style={[s.emailText, { fontFamily: T.font.sans }]}>{email}</Text>}
                <View style={s.badge}>
                  <Ionicons name="wallet-outline" size={10} color={T.accentText} />
                  <Text style={[s.badgeText, { fontFamily: T.font.sans }]}>Client</Text>
                </View>
              </View>
            </View>

            {/* Bannière info */}
            {!isEditing && (
              <View style={s.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={T.info} />
                <Text style={[s.infoText, { fontFamily: T.font.sans }]}>
                  Appuyez sur le crayon en haut à droite pour modifier vos informations.
                </Text>
              </View>
            )}

            {/* Identité */}
            <SectionCard icon="person-outline" title="Identité">
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Prénom *" value={firstName} onChange={setFirstName} editable={isEditing} style={{ flex: 1 }} placeholder="Prénom" />
                <Field label="Nom *"    value={lastName}  onChange={setLastName}  editable={isEditing} style={{ flex: 1 }} placeholder="Nom"    />
              </View>
              <Field label="Téléphone *"  value={phone} onChange={setPhone} editable={isEditing} keyboardType="phone-pad" placeholder="+33 6 00 00 00 00" />
              <Field label="Adresse email" value={email} editable={false} placeholder="—" />
            </SectionCard>

            {/* État civil */}
            <SectionCard icon="document-text-outline" title="État Civil">
              <Field
                label="Date de naissance (JJ/MM/AAAA)"
                value={birthDate}
                onChange={handleDateChange}
                editable={isEditing}
                keyboardType="numeric"
                maxLength={10}
                placeholder="15/06/1990"
              />
              <Field label="Lieu de naissance" value={birthPlace} onChange={setBirthPlace} editable={isEditing} placeholder="Paris, France" />
              <CountryPicker label="Nationalité" value={nationality} onChange={setNationality} editable={isEditing} />
            </SectionCard>

            {/* Adresse de Résidence */}
            <SectionCard icon="home-outline" title="Adresse de Résidence">
              <Field label="Adresse complète *" value={address} onChange={setAddress} editable={isEditing} placeholder="12 Rue des Lilas…" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Code postal" value={postalCode} onChange={setPostalCode} editable={isEditing} keyboardType="numeric" style={{ flex: 0.45 }} placeholder="75001" />
                {/* ✅ v5.2 : CityPicker si villes disponibles, sinon Field texte */}
                {showCityPicker ? (
                  <View style={{ flex: 1 }}>
                    <CityPicker
                      label="Ville *"
                      value={city}
                      onChange={setCity}
                      cities={residenceCities}
                      editable={isEditing}
                    />
                  </View>
                ) : (
                  <Field label="Ville *" value={city} onChange={setCity} editable={isEditing} style={{ flex: 1 }} placeholder="Paris" />
                )}
              </View>
              {/* ✅ v5.2 : CountryPicker avec reset ville si nécessaire */}
              <CountryPicker
                label="Pays de résidence *"
                value={country}
                onChange={(newCountry: string) => {
                  setCountry(newCountry);
                  const cities = citiesByCountry[newCountry] ?? [];
                  if (city && cities.length > 0 && !cities.includes(city)) setCity("");
                }}
                editable={isEditing}
              />
            </SectionCard>

            {/* Bouton Enregistrer */}
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
                      <Text style={[s.saveTxt, { fontFamily: T.font.sans }]}>ENREGISTRER LES MODIFICATIONS</Text>
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
  emailText:    { fontSize: 12, color: T.textSub, marginTop: 2 },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: T.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  badgeText:    { fontSize: 10, fontWeight: "700", color: T.accentText, letterSpacing: 0.5 },

  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: T.infoSoft, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: "#BAE6FD", marginBottom: 14 },
  infoText:   { flex: 1, color: T.info, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  saveBtn: { backgroundColor: T.accent, borderRadius: T.radius.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: T.accent, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  saveTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});