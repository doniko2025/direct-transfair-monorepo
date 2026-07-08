// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/create.tsx
// =========================================================
// BENEFICIARY CREATE v6.2 — Direct Transf'air
// ✅ v6.0 : Anti-doublon, UI compacte, contacts natifs
// ✅ v6.1 : fond blanc neutre #FAFAFA, ombres neutres
// ✅ v6.2 : Correction du cadre bleu parasite autour des champs en édition
//   - Même cause que sur les écrans précédents (rates.tsx, personal-info-wallet.tsx) :
//     le <TextInput> du composant `Field` n'avait aucun reset du contour de focus
//     natif du navigateur sur web. Au focus, Chrome superposait son propre
//     rectangle bleu par-dessus la bordure verte voulue de `f.box` (visible sur
//     le champ "Nom" de la capture).
//   - Fix appliqué avec cast `as any` d'emblée (leçon tirée de l'erreur TS du
//     fichier précédent) pour éviter le conflit avec le style natif RN
//     `outlineStyle` (typé "solid" | "dotted" | "dashed" | undefined).
//   ⚠️ HORS PÉRIMÈTRE (appliqué quand même, à valider) : le même fix a été
//     appliqué au <TextInput> du numéro de téléphone Mobile Money, qui a la
//     même structure (TextInput dans un View bordée `f.box`) et pouvait donc
//     afficher le même bug au focus. Je n'ai PAS touché aux champs de
//     recherche des modals (`pm.searchInput`), qui ont une structure
//     différente et n'ont pas été signalés — dis-moi si tu veux que je les
//     corrige aussi par cohérence.
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView,
  Modal, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView,
  Platform, Animated, StatusBar, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { api } from "../../../services/api";
import { showAlert } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";
import { citiesByCountry } from "../../../data/cities";

const C = {
  green:       "#059669",
  greenDark:   "#047857",
  greenLight:  "#F0FDF4",
  greenBorder: "#A7F3D0",
  greenPale:   "#ECFDF5",
  heroGlass:   "rgba(255,255,255,0.14)",
  heroGlassBdr:"rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.65)",
  heroGlow:    "rgba(255,255,255,0.08)",
  pageBg:      "#FAFAFA",   // ← était #F0FDF8
  white:       "#FFFFFF",
  cardBorder:  "#E5E5EA",   // ← était #D1FAE5
  inputBg:     "#F8F8F8",   // ← était #F8FFFC
  ink:         "#0D2B1F",
  inkMid:      "#1F5C3A",
  inkSoft:     "#6B9E85",
  red:         "#EF4444",
  redBg:       "#FEF2F2",
  blue:        "#3B82F6",
  r: { xs: 8, sm: 12, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif",          default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",  default: "monospace"  }),
  },
};

const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").toLowerCase();
}

// ─── Field ──────────────────────────────────────────────
// ✅ v6.2 : reset du contour de focus web ajouté sur le <TextInput>
function Field({ label, value, onChangeText, placeholder, keyboardType, required, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; required?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={f.wrap}>
      <Text style={[f.lbl, { fontFamily: C.font.sans }]}>
        {label}{required && <Text style={{ color: C.red }}> *</Text>}
      </Text>
      <View style={[f.box, focused && { borderColor: C.green }, !editable && { opacity: 0.5 }]}>
        <TextInput
          style={[
            f.input,
            { fontFamily: C.font.sans },
            // ✅ v6.2 : reset du contour de focus natif du navigateur — sans ça,
            // Chrome superpose son propre rectangle bleu par-dessus la bordure
            // verte de `f.box` au focus (visible sur le champ "Nom" de la capture).
            // Cast `as any` nécessaire : `outlineStyle` est déjà un style natif RN
            // typé "solid" | "dotted" | "dashed" | undefined, incompatible avec "none".
            Platform.OS === "web" && ({
              outlineStyle: "none",
              outlineWidth: 0,
              borderWidth: 0,
              boxShadow: "none",
            } as any),
          ]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.inkSoft}
          keyboardType={keyboardType} editable={editable}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
        />
      </View>
    </View>
  );
}
const f = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  lbl:   { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 0.8, marginBottom: 5, textTransform: "uppercase" },
  box:   { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  // ✅ v6.2 : borderWidth:0 en dur — le contour visible vient uniquement de `box` (View parente)
  input: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink, fontWeight: "600", borderWidth: 0 },
});

// ─── Select Button ───────────────────────────────────────
function SelectBtn({ label, value, onPress, icon, required }: {
  label: string; value: string; onPress: () => void; icon?: string; required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[f.lbl, { fontFamily: C.font.sans }]}>{label}{required && <Text style={{ color: C.red }}> *</Text>}</Text>
      <TouchableOpacity style={sb.btn} onPress={onPress} activeOpacity={0.8}>
        <View style={sb.left}>
          {icon && <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>}
          <Text style={[sb.val, { fontFamily: C.font.sans }, !value && { color: C.inkSoft }]}>{value || "Sélectionner…"}</Text>
        </View>
        <View style={sb.chevron}>
          <Ionicons name="chevron-down" size={12} color={C.green} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
const sb = StyleSheet.create({
  btn:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, paddingVertical: 11 },
  left:   { flexDirection: "row", alignItems: "center", flex: 1 },
  val:    { fontSize: 13, color: C.ink, fontWeight: "600" },
  chevron:{ width: 24, height: 24, borderRadius: 7, backgroundColor: C.greenPale, justifyContent: "center", alignItems: "center" },
});

// ─── Picker Modal ────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, renderItem }: any) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? data.filter((item: any) => (typeof item === "string" ? item : item.name ?? "").toLowerCase().includes(q.toLowerCase()))
    : data;
  const close = () => { onClose(); setQ(""); };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.handle} />
          <View style={pm.head}>
            <Text style={[pm.title, { fontFamily: C.font.serif }]}>{title}</Text>
            <TouchableOpacity style={pm.closeBtn} onPress={close}>
              <Ionicons name="close" size={16} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={pm.search}>
            <Ionicons name="search" size={13} color={C.inkSoft} />
            <TextInput style={[pm.searchInput, { fontFamily: C.font.sans }]} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={C.inkSoft} autoFocus underlineColorAndroid="transparent" />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={13} color={C.inkSoft} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered} keyExtractor={(item, i) => (item?.code ?? item ?? i).toString()}
            renderItem={renderItem} showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            ListEmptyComponent={<Text style={[pm.empty, { fontFamily: C.font.sans }]}>Aucun résultat</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
const pm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:      { width: 32, height: 3, borderRadius: C.r.pill, backgroundColor: "#DDDDDD", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  head:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:       { color: C.ink, fontSize: 16, fontWeight: "700" },
  closeBtn:    { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center" },
  search:      { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "600" },
  empty:       { color: C.inkSoft, textAlign: "center", padding: 20, fontWeight: "600" },
});

const pmItem = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  txt: { color: C.ink, fontSize: 13, fontWeight: "600", flex: 1 },
  dial:{ color: C.green, fontSize: 11, fontWeight: "900", marginRight: 8 },
});

// ─── Phone Contact Card ──────────────────────────────────
function PhoneContactCard({ contact, onSelect }: { contact: any; onSelect: () => void }) {
  const initials = ((contact.firstName?.[0] ?? "") + (contact.lastName?.[0] ?? "")).toUpperCase() || "?";
  const colors   = avatarColor(contact.firstName || "A");
  return (
    <TouchableOpacity style={pc.row} onPress={onSelect} activeOpacity={0.75}>
      <View style={[pc.avatar, { backgroundColor: colors.bg }]}>
        <Text style={[pc.initials, { color: colors.text, fontFamily: C.font.serif }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[pc.name, { fontFamily: C.font.sans }]} numberOfLines={1}>{contact.firstName} {contact.lastName ?? ""}</Text>
        {contact.phoneNumbers?.[0]?.number && <Text style={[pc.phone, { fontFamily: C.font.mono }]} numberOfLines={1}>{contact.phoneNumbers[0].number}</Text>}
      </View>
      <Ionicons name="add-circle-outline" size={18} color={C.green} />
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  avatar:  { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  initials:{ fontSize: 14, fontWeight: "900" },
  name:    { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 2 },
  phone:   { fontSize: 11, color: C.inkSoft, fontWeight: "600" },
});

// ─── Main Screen ─────────────────────────────────────────
export default function BeneficiaryCreateScreen() {
  const router = useRouter();

  const [firstName,      setFirstName]      = useState("");
  const [lastName,       setLastName]       = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry,   setPhoneCountry]   = useState<CountryData>(countriesList[0]);
  const [city,           setCity]           = useState("");
  const [phoneNumber,    setPhoneNumber]    = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  const [showCountryModal,   setShowCountryModal]   = useState(false);
  const [showCityModal,      setShowCityModal]      = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showContactsModal,  setShowContactsModal]  = useState(false);
  const [phoneContacts,      setPhoneContacts]      = useState<any[]>([]);
  const [loadingContacts,    setLoadingContacts]    = useState(false);
  const [contactSearch,      setContactSearch]      = useState("");

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2 && city.trim().length >= 2;
  const availableCities: string[] = (citiesByCountry as any)[addressCountry.name] ?? [];
  const progress = [
    firstName.trim().length >= 2 && lastName.trim().length >= 2,
    city.trim().length >= 2,
    phoneNumber.trim().length > 0,
  ];

  const openPhoneContacts = async () => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez l'accès aux contacts dans les paramètres.", [{ text: "OK" }]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      setPhoneContacts(data.filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0));
      setShowContactsModal(true);
    } catch { Alert.alert("Erreur", "Impossible d'accéder aux contacts."); }
    finally { setLoadingContacts(false); }
  };

  const handleSelectContact = (contact: any) => {
    setFirstName(contact.firstName || "");
    setLastName(contact.lastName || "");
    const rawPhone = contact.phoneNumbers?.[0]?.number ?? "";
    const cleaned  = rawPhone.replace(/[\s\-\(\)]/g, "");
    const sorted   = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const match    = sorted.find((c) => cleaned.startsWith(c.dialCode));
    if (match) { setPhoneCountry(match); setPhoneNumber(cleaned.replace(match.dialCode, "")); }
    else setPhoneNumber(cleaned);
    setShowContactsModal(false); setContactSearch("");
  };

  const filteredContacts = phoneContacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const s = contactSearch.toLowerCase();
    return `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(s) || (c.phoneNumbers?.[0]?.number ?? "").includes(s);
  });

  const handleCreate = async () => {
    if (!canSubmit) { showAlert("Validation", "Veuillez remplir le nom, le prénom et la ville."); return; }
    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      let fullPhone: string | null = null;
      if (phoneNumber.trim().length > 0) {
        const dial = phoneCountry.dialCode.replace("+", "");
        const num  = phoneNumber.trim().replace(/^0+/, "");
        fullPhone  = `+${dial}${num}`;
      }
      const existing = await api.getBeneficiaries();
      const duplicate = existing.find((b) => {
        const sameName  = (b.fullName ?? "").trim().toLowerCase() === fullName.toLowerCase();
        const samePhone = fullPhone && b.phone && normalizePhone(b.phone) === normalizePhone(fullPhone);
        return sameName || !!samePhone;
      });
      if (duplicate) {
        showAlert("Contact déjà existant", `"${duplicate.fullName}" est déjà dans vos contacts${duplicate.phone ? ` (${duplicate.phone})` : ""}.`);
        setSubmitting(false); return;
      }
      await api.createBeneficiary({ fullName, country: addressCountry.name, city: city.trim(), phone: fullPhone });
      showAlert("✅ Ajouté", "Contact ajouté avec succès.", () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de la création.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      <View style={s.hero}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Nouveau Contact</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>{progress.filter(Boolean).length}/3 étapes complétées</Text>
          </View>
        </View>
        <View style={s.progressRow}>
          {progress.map((done, i) => (
            <View key={i} style={[s.progressSeg, { backgroundColor: done ? C.white : "rgba(255,255,255,0.3)" }]} />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Import contacts */}
          <TouchableOpacity style={s.importBtn} onPress={openPhoneContacts} disabled={loadingContacts} activeOpacity={0.88}>
            <View style={s.importIconBox}>
              {loadingContacts ? <ActivityIndicator color={C.green} size="small" /> : <Ionicons name="people-outline" size={18} color={C.green} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.importTitle, { fontFamily: C.font.sans }]}>Importer depuis mes contacts</Text>
              <Text style={[s.importSub,   { fontFamily: C.font.sans }]}>Accéder au répertoire téléphonique</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.green} />
          </TouchableOpacity>

          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={[s.orTxt, { fontFamily: C.font.sans }]}>ou saisir manuellement</Text>
            <View style={s.orLine} />
          </View>

          {/* Identité */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: progress[0] ? C.green : C.inkSoft }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>IDENTITÉ</Text>
          </View>
          <View style={s.card}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" required editable={!submitting} /></View>
              <View style={{ flex: 1 }}><Field label="Nom"    value={lastName}  onChangeText={setLastName}  placeholder="Diallo"  required editable={!submitting} /></View>
            </View>
            {firstName.trim().length >= 1 && lastName.trim().length >= 1 && (
              <View style={s.previewPill}>
                <View style={[s.previewAvatar, { backgroundColor: avatarColor(firstName).bg }]}>
                  <Text style={[s.previewInitials, { color: avatarColor(firstName).text, fontFamily: C.font.serif }]}>
                    {firstName[0].toUpperCase()}{lastName[0]?.toUpperCase() ?? ""}
                  </Text>
                </View>
                <Text style={[s.previewName, { fontFamily: C.font.sans }]}>{firstName.trim()} {lastName.trim()}</Text>
                <Ionicons name="checkmark-circle" size={15} color={C.green} />
              </View>
            )}
          </View>

          {/* Localisation */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: progress[1] ? C.green : C.inkSoft }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>LOCALISATION</Text>
          </View>
          <View style={s.card}>
            <SelectBtn label="Pays de résidence" value={addressCountry.name} icon={addressCountry.flag} onPress={() => setShowCountryModal(true)} required />
            <SelectBtn label="Ville"              value={city}               onPress={() => setShowCityModal(true)} required />
          </View>

          {/* Téléphone */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: progress[2] ? C.green : C.inkSoft }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>TÉLÉPHONE <Text style={{ color: C.inkSoft, fontSize: 8 }}>(optionnel)</Text></Text>
          </View>
          <View style={s.card}>
            <Text style={[f.lbl, { fontFamily: C.font.sans }]}>Mobile Money</Text>
            <View style={s.phoneRow}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowPhoneCodeModal(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 16 }}>{phoneCountry.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{phoneCountry.dialCode}</Text>
                <Ionicons name="caret-down" size={9} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput
                  style={[
                    f.input,
                    { fontFamily: C.font.sans },
                    // ✅ v6.2 : même reset de contour de focus web que dans `Field`
                    // (ce champ n'utilise pas le composant Field car il partage sa
                    // ligne avec le sélecteur d'indicatif — même structure, même bug)
                    Platform.OS === "web" && ({
                      outlineStyle: "none",
                      outlineWidth: 0,
                      borderWidth: 0,
                      boxShadow: "none",
                    } as any),
                  ]}
                  value={phoneNumber} onChangeText={setPhoneNumber}
                  placeholder="620 000 000" placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad" editable={!submitting}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>
            <Text style={[s.phoneTip, { fontFamily: C.font.sans }]}>Utilisé pour les transferts Mobile Money directs.</Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || submitting) && { opacity: 0.4 }]}
            onPress={handleCreate} disabled={!canSubmit || submitting} activeOpacity={0.88}
          >
            <View style={s.ctaInner}>
              {submitting ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Ionicons name="person-add-outline" size={16} color={C.white} />
                  <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>AJOUTER LE CONTACT</Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={submitting}>
            <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Contacts */}
      <Modal visible={showContactsModal} animationType="slide" transparent onRequestClose={() => { setShowContactsModal(false); setContactSearch(""); }}>
        <View style={pm.overlay}>
          <View style={[pm.sheet, { maxHeight: "85%" }]}>
            <View style={pm.handle} />
            <View style={pm.head}>
              <View>
                <Text style={[pm.title, { fontFamily: C.font.serif }]}>Mes contacts</Text>
                <Text style={[{ fontSize: 10, color: C.inkSoft, fontWeight: "600", marginTop: 2, fontFamily: C.font.sans }]}>
                  {filteredContacts.length} contact{filteredContacts.length > 1 ? "s" : ""} avec numéro
                </Text>
              </View>
              <TouchableOpacity style={pm.closeBtn} onPress={() => { setShowContactsModal(false); setContactSearch(""); }}>
                <Ionicons name="close" size={16} color={C.inkSoft} />
              </TouchableOpacity>
            </View>
            <View style={pm.search}>
              <Ionicons name="search" size={13} color={C.inkSoft} />
              <TextInput style={[pm.searchInput, { fontFamily: C.font.sans }]} value={contactSearch} onChangeText={setContactSearch} placeholder="Rechercher un contact…" placeholderTextColor={C.inkSoft} underlineColorAndroid="transparent" />
              {!!contactSearch && <TouchableOpacity onPress={() => setContactSearch("")}><Ionicons name="close" size={13} color={C.inkSoft} /></TouchableOpacity>}
            </View>
            <FlatList
              data={filteredContacts} keyExtractor={(item) => item.id ?? item.name ?? Math.random().toString()}
              showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => <PhoneContactCard contact={item} onSelect={() => handleSelectContact(item)} />}
              ListEmptyComponent={
                <View style={{ alignItems: "center", padding: 24 }}>
                  <Ionicons name="people-outline" size={28} color={C.inkSoft} style={{ marginBottom: 6 }} />
                  <Text style={[{ color: C.inkSoft, fontFamily: C.font.sans, fontWeight: "600", fontSize: 13 }]}>
                    {contactSearch ? "Aucun contact trouvé" : "Aucun contact avec numéro"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <PickerModal
        visible={showCountryModal} onClose={() => setShowCountryModal(false)} title="Pays de résidence"
        data={countriesList}
        renderItem={({ item: c }: { item: CountryData }) => (
          <TouchableOpacity style={pmItem.row} onPress={() => { setAddressCountry(c); setPhoneCountry(c); setCity(""); setShowCountryModal(false); }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>{c.flag}</Text>
            <Text style={[pmItem.txt, { fontFamily: C.font.sans }]}>{c.name}</Text>
            {addressCountry.code === c.code && <Ionicons name="checkmark" size={16} color={C.green} />}
          </TouchableOpacity>
        )}
      />
      <PickerModal
        visible={showCityModal} onClose={() => setShowCityModal(false)} title={`Villes · ${addressCountry.name}`}
        data={availableCities.length > 0 ? availableCities : ["Autre"]}
        renderItem={({ item: cityName }: { item: string }) => (
          <TouchableOpacity style={pmItem.row} onPress={() => { setCity(cityName); setShowCityModal(false); }}>
            <Text style={[pmItem.txt, { fontFamily: C.font.sans }]}>{cityName}</Text>
            {city === cityName && <Ionicons name="checkmark" size={16} color={C.green} />}
          </TouchableOpacity>
        )}
      />
      <PickerModal
        visible={showPhoneCodeModal} onClose={() => setShowPhoneCodeModal(false)} title="Indicatif téléphonique"
        data={countriesList}
        renderItem={({ item: c }: { item: CountryData }) => (
          <TouchableOpacity style={pmItem.row} onPress={() => { setPhoneCountry(c); setShowPhoneCodeModal(false); }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>{c.flag}</Text>
            <Text style={[pmItem.txt, { fontFamily: C.font.sans }]}>{c.name}</Text>
            <Text style={[pmItem.dial, { fontFamily: C.font.mono }]}>{c.dialCode}</Text>
            {phoneCountry.code === c.code && <Ionicons name="checkmark" size={16} color={C.green} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: { backgroundColor: C.green, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 14, paddingBottom: 20, overflow: "hidden" },
  glow:       { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: C.heroGlow, top: -50, right: -30 },
  heroRow:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn:    { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle:  { color: C.white, fontSize: 20, fontWeight: "700" },
  heroSub:    { color: C.heroDim, fontSize: 10, fontWeight: "600", marginTop: 2 },
  progressRow:{ flexDirection: "row", gap: 8 },
  progressSeg:{ flex: 1, height: 3, borderRadius: C.r.pill },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // ← ombre neutre (était shadowColor: C.green)
  importBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.greenBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  importIconBox:{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.greenPale, justifyContent: "center", alignItems: "center" },
  importTitle:  { fontSize: 13, fontWeight: "800", color: C.ink, marginBottom: 1 },
  importSub:    { fontSize: 10, fontWeight: "600", color: C.inkSoft },

  orRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: "#EEEEEE" },
  orTxt:  { fontSize: 10, fontWeight: "700", color: C.inkSoft },

  secRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  secDot: { width: 4, height: 4, borderRadius: C.r.pill },
  secLbl: { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 1.2 },

  // ← ombre neutre (était shadowColor: C.green)
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  previewPill:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.greenPale, borderRadius: C.r.md, padding: 8, borderWidth: 1, borderColor: C.greenBorder },
  previewAvatar:   { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  previewInitials: { fontSize: 12, fontWeight: "900" },
  previewName:     { flex: 1, fontSize: 13, fontWeight: "700", color: C.ink },

  phoneRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  dialBtn:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 10 },
  dialCode: { color: C.ink, fontSize: 11, fontWeight: "800" },
  phoneTip: { color: C.inkSoft, fontSize: 10, fontWeight: "600" },

  cta:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 8 },
  ctaInner: {
    backgroundColor: C.green, flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 15, gap: 8, borderRadius: C.r.md,
    ...Platform.select({
      ios:     { shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },

  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 13 },
});