// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
// =========================================================
// BENEFICIARY DETAIL v5.1 — Direct Transf'air
// ✅ v5.0 : Thème clair, voir/modifier/supprimer, actions rapides
// ✅ v5.1 : fond blanc neutre #FAFAFA, ombres neutres
// =========================================================

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TextInput, ScrollView,
  Modal, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView,
  Platform, Animated, StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import type { Beneficiary, CreateBeneficiaryPayload } from "../../../services/types";
import { showAlert, showConfirm } from "../../../utils/alert";
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
  heroDim:     "rgba(255,255,255,0.70)",
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
  redBorder:   "#FECACA",
  amber:       "#D97706",
  amberBg:     "#FFFBEB",
  blue:        "#2563EB",
  blueBg:      "#EFF6FF",
  r: { xs: 8, sm: 10, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

function getIdParam(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.id;
  if (typeof raw === "string") { const v = raw.trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  if (Array.isArray(raw)) { const v = (raw[0] ?? "").trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  return null;
}

const AVATAR_COLORS = [
  { bg: "#DCFCE7", text: "#15803D" }, { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FEF3C7", text: "#B45309" }, { bg: "#F3E8FF", text: "#7E22CE" },
  { bg: "#FFE4E6", text: "#BE123C" }, { bg: "#CCFBF1", text: "#0F766E" },
];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

// ─── Field ───────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: C.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && { borderColor: C.green }, !editable && { opacity: 0.5 }]}>
        <TextInput
          style={[fS.input, { fontFamily: C.font.sans }]}
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
const fS = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  label: { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 0.8, marginBottom: 5, textTransform: "uppercase" },
  box:   { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  input: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink, fontWeight: "600" },
});

// ─── Select Button ────────────────────────────────────────
function SelectBtn({ label, value, onPress, icon }: {
  label: string; value: string; onPress: () => void; icon?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[fS.label, { fontFamily: C.font.sans }]}>{label}</Text>
      <TouchableOpacity style={sbS.btn} onPress={onPress} activeOpacity={0.8}>
        <View style={sbS.left}>
          {icon && <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>}
          <Text style={[sbS.value, { fontFamily: C.font.sans }, !value && { color: C.inkSoft }]}>{value || "Sélectionner…"}</Text>
        </View>
        <View style={sbS.chevron}>
          <Ionicons name="chevron-down" size={12} color={C.green} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
const sbS = StyleSheet.create({
  btn:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, paddingVertical: 11 },
  left:   { flexDirection: "row", alignItems: "center", flex: 1 },
  value:  { fontSize: 13, color: C.ink, fontWeight: "600" },
  chevron:{ width: 24, height: 24, borderRadius: 7, backgroundColor: C.greenPale, justifyContent: "center", alignItems: "center" },
});

// ─── Picker Modal ─────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, renderItem }: {
  visible: boolean; onClose: () => void; title: string; data: any[]; renderItem: any;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? data.filter((item: any) => (typeof item === "string" ? item : item.name ?? "").toLowerCase().includes(q.toLowerCase()))
    : data;
  const close = () => { onClose(); setQ(""); };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={pmS.overlay}>
        <View style={pmS.sheet}>
          <View style={pmS.handle} />
          <View style={pmS.headerRow}>
            <Text style={[pmS.title, { fontFamily: C.font.serif }]}>{title}</Text>
            <TouchableOpacity style={pmS.closeBtn} onPress={close}>
              <Ionicons name="close" size={16} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={pmS.search}>
            <Ionicons name="search" size={13} color={C.inkSoft} />
            <TextInput style={[pmS.searchInput, { fontFamily: C.font.sans }]} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={C.inkSoft} autoFocus underlineColorAndroid="transparent" />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={13} color={C.inkSoft} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered} keyExtractor={(item, i) => (item?.code ?? item ?? i).toString()}
            renderItem={renderItem} showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            ListEmptyComponent={<Text style={[pmS.empty, { fontFamily: C.font.sans }]}>Aucun résultat</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
const pmS = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:    { width: 32, height: 3, borderRadius: C.r.pill, backgroundColor: "#DDDDDD", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:     { color: C.ink, fontSize: 16, fontWeight: "700" },
  closeBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center" },
  search:    { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "600" },
  empty:     { color: C.inkSoft, textAlign: "center", padding: 20, fontWeight: "600" },
});

const pmItem = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  txt:  { color: C.ink, fontSize: 13, fontWeight: "600", flex: 1 },
  dial: { color: C.green, fontSize: 11, fontWeight: "900", marginRight: 8 },
});

// ─── Action Card ──────────────────────────────────────────
function ActionCard({ icon, iconBg, iconColor, title, subtitle, onPress }: {
  icon: string; iconBg: string; iconColor: string; title: string; subtitle: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={aS.card} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[aS.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[aS.title, { fontFamily: C.font.sans }]}>{title}</Text>
          <Text style={[aS.sub,   { fontFamily: C.font.sans }]}>{subtitle}</Text>
        </View>
        <View style={aS.chevronBox}>
          <Ionicons name="chevron-forward" size={13} color={C.green} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const aS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 15, marginBottom: 10, gap: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  iconBox:   { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title:     { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  sub:       { color: C.inkSoft, fontSize: 11, fontWeight: "600" },
  chevronBox:{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.greenPale, justifyContent: "center", alignItems: "center" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function BeneficiaireDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = useMemo(() => getIdParam(params as any), [params]);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [item,     setItem]     = useState<Beneficiary | null>(null);
  const [editing,  setEditing]  = useState(false);

  const [firstName,      setFirstName]      = useState("");
  const [lastName,       setLastName]       = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry,   setPhoneCountry]   = useState<CountryData>(countriesList[0]);
  const [city,           setCity]           = useState("");
  const [phoneNumber,    setPhoneNumber]    = useState("");

  const [showCountryModal,   setShowCountryModal]   = useState(false);
  const [showCityModal,      setShowCityModal]      = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hydrateForm = (b: Beneficiary) => {
    const parts = (b.fullName || "").split(" ");
    if (parts.length > 1) { setFirstName(parts.slice(0, -1).join(" ")); setLastName(parts[parts.length - 1]); }
    else { setFirstName(b.fullName || ""); setLastName(""); }
    const found = countriesList.find((c) => c.name === b.country);
    if (found) { setAddressCountry(found); if (!b.phone) setPhoneCountry(found); }
    setCity(b.city || "");
    if (b.phone) {
      const sorted = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);
      const match  = sorted.find((c) => b.phone?.startsWith(c.dialCode));
      if (match) { setPhoneCountry(match); setPhoneNumber(b.phone.replace(match.dialCode, "")); }
      else setPhoneNumber(b.phone);
    } else { setPhoneNumber(""); }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await api.getBeneficiary(id);
      setItem(b); hydrateForm(b);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { showAlert("Erreur", "Impossible de charger le bénéficiaire."); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setLoading(true); setEditing(false); fadeAnim.setValue(0);
    void load();
    return () => {};
  }, [load]));

  const canSave = firstName.trim().length >= 2 && lastName.trim().length >= 2 && city.trim().length >= 2;

  const onSave = async () => {
    if (!id || !item || !canSave) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    let fullPhone: string | null = null;
    if (phoneNumber.trim().length > 0) {
      const dial = phoneCountry.dialCode.replace("+", "");
      const num  = phoneNumber.trim().replace(/^0+/, "");
      fullPhone  = `+${dial}${num}`;
    }
    try {
      setSaving(true);
      const updated = await api.updateBeneficiary(id, { fullName, country: addressCountry.name, city: city.trim(), phone: fullPhone } as Partial<CreateBeneficiaryPayload>);
      setItem(updated); hydrateForm(updated); setEditing(false);
    } catch { showAlert("Erreur", "Impossible de mettre à jour."); }
    finally { setSaving(false); }
  };

  const onDelete = () => {
    if (!id) return;
    showConfirm("Supprimer le bénéficiaire", "Cette action est irréversible. Confirmer ?", async () => {
      try {
        setDeleting(true);
        await api.deleteBeneficiary(id);
        showAlert("Supprimé", "Bénéficiaire supprimé.", () => router.back());
      } catch { showAlert("Erreur", "Impossible de supprimer (lié à une transaction ?)."); }
      finally { setDeleting(false); }
    });
  };

  const onCancelEdit = () => { if (item) hydrateForm(item); setEditing(false); };

  const goSendWallet = () => {
    if (!item?.phone) { showAlert("Info", "Ce bénéficiaire n'a pas de numéro enregistré."); return; }
    router.push({ pathname: "/(tabs)/send", params: { mode: "WALLET", phone: item.phone } });
  };
  const goSendCash = () => {
    router.push({ pathname: "/(tabs)/send", params: { mode: "CASH", beneficiaryId: item?.id } });
  };

  const colors   = item ? avatarColor(item.fullName) : AVATAR_COLORS[0];
  const initials = item ? item.fullName.split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase() : "–";

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.green} size="large" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
        <Ionicons name="person-outline" size={40} color={C.inkSoft} />
        <Text style={[{ color: C.ink, marginTop: 12, fontFamily: C.font.sans, fontWeight: "700", fontSize: 15 }]}>
          Bénéficiaire introuvable.
        </Text>
        <TouchableOpacity
          style={[{ marginTop: 20, backgroundColor: C.greenPale, paddingHorizontal: 24, paddingVertical: 12, borderRadius: C.r.md, borderWidth: 1, borderColor: C.greenBorder }]}
          onPress={() => router.back()}
        >
          <Text style={[{ color: C.green, fontWeight: "800", fontFamily: C.font.sans }]}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const availableCities: string[] = (citiesByCountry as any)[addressCountry.name] ?? (addressCountry as any).cities ?? [];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.pageBg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: C.font.serif }]}>Bénéficiaire</Text>
        {!editing ? (
          <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={C.green} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.cancelBtnHeader} onPress={onCancelEdit}>
            <Ionicons name="close" size={16} color={C.inkSoft} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero Avatar ── */}
          <View style={s.heroCard}>
            <View style={[s.avatar, { backgroundColor: colors.bg }]}>
              <Text style={[s.avatarInitials, { color: colors.text, fontFamily: C.font.serif }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroName, { fontFamily: C.font.serif }]}>{item.fullName}</Text>
              <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
                {item.city}{item.country ? `, ${item.country}` : ""}
              </Text>
              {item.phone && (
                <View style={s.phonePill}>
                  <Ionicons name="call-outline" size={11} color={C.green} />
                  <Text style={[s.phoneTxt, { fontFamily: C.font.mono }]}>{item.phone}</Text>
                </View>
              )}
            </View>
          </View>

          {!editing ? (
            <>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: C.green }]} />
                <Text style={[s.sectionLabel, { fontFamily: C.font.sans }]}>ENVOYER DE L'ARGENT</Text>
              </View>
              <ActionCard icon="wallet-outline"  iconBg={C.greenPale} iconColor={C.green} title="Vers un Wallet"   subtitle="Transfert direct Mobile Money" onPress={goSendWallet} />
              <ActionCard icon="cash-outline"    iconBg={C.blueBg}    iconColor={C.blue}  title="Envoi d'argent"  subtitle="Retrait en agence"            onPress={goSendCash} />
            </>
          ) : (
            <>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: C.green }]} />
                <Text style={[s.sectionLabel, { fontFamily: C.font.sans }]}>MODIFIER LES INFORMATIONS</Text>
              </View>
              <View style={s.card}>
                <View style={s.rowTwo}>
                  <View style={{ flex: 1 }}><Field label="PRÉNOM" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" editable={!saving} /></View>
                  <View style={{ flex: 1 }}><Field label="NOM"    value={lastName}  onChangeText={setLastName}  placeholder="Diallo"  editable={!saving} /></View>
                </View>
                <SelectBtn label="PAYS DE RÉSIDENCE" value={addressCountry.name} icon={addressCountry.flag} onPress={() => setShowCountryModal(true)} />
                <SelectBtn label="VILLE"              value={city}               onPress={() => setShowCityModal(true)} />
                <View style={{ marginBottom: 12 }}>
                  <Text style={[fS.label, { fontFamily: C.font.sans }]}>TÉLÉPHONE (MOBILE MONEY)</Text>
                  <View style={s.phoneRow}>
                    <TouchableOpacity style={s.dialBtn} onPress={() => setShowPhoneCodeModal(true)} activeOpacity={0.8}>
                      <Text style={{ fontSize: 16 }}>{phoneCountry.flag}</Text>
                      <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{phoneCountry.dialCode}</Text>
                      <Ionicons name="caret-down" size={9} color={C.inkSoft} />
                    </TouchableOpacity>
                    <View style={[fS.box, { flex: 1 }]}>
                      <TextInput
                        style={[fS.input, { fontFamily: C.font.sans }]}
                        value={phoneNumber} onChangeText={setPhoneNumber}
                        placeholder="620 000 000" placeholderTextColor={C.inkSoft}
                        keyboardType="phone-pad" editable={!saving}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={[s.saveBtn, (!canSave || saving) && { opacity: 0.4 }]} onPress={onSave} disabled={!canSave || saving} activeOpacity={0.88}>
                <View style={s.saveBtnInner}>
                  {saving
                    ? <ActivityIndicator color={C.white} />
                    : <><Ionicons name="save-outline" size={16} color={C.white} /><Text style={[s.saveBtnTxt, { fontFamily: C.font.sans }]}>ENREGISTRER</Text></>
                  }
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Zone dangereuse */}
          <View style={[s.sectionRow, { marginTop: 8 }]}>
            <View style={[s.sectionDot, { backgroundColor: C.red }]} />
            <Text style={[s.sectionLabel, { fontFamily: C.font.sans }]}>ZONE DANGEREUSE</Text>
          </View>
          <TouchableOpacity style={[s.deleteBtn, deleting && { opacity: 0.6 }]} onPress={onDelete} disabled={deleting} activeOpacity={0.85}>
            {deleting
              ? <ActivityIndicator color={C.red} />
              : <><Ionicons name="trash-outline" size={17} color={C.red} /><Text style={[s.deleteTxt, { fontFamily: C.font.sans }]}>Supprimer le bénéficiaire</Text></>
            }
          </TouchableOpacity>
          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>

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
        data={availableCities}
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

  // ← header avec ombre subtile
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 14, paddingBottom: 14,
    gap: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  // ← fond neutre (était C.pageBg vert pâle)
  backBtn:        { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center" },
  headerTitle:    { flex: 1, color: C.ink, fontSize: 18, fontWeight: "700" },
  editBtn:        { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, justifyContent: "center", alignItems: "center" },
  cancelBtnHeader:{ width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center" },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // ← ombre neutre (était shadowColor: C.green)
  heroCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 16, marginBottom: 18,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  avatar:        { width: 52, height: 52, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  avatarInitials:{ fontSize: 20, fontWeight: "900" },
  heroName:      { fontSize: 18, fontWeight: "700", color: C.ink, marginBottom: 3 },
  heroSub:       { fontSize: 12, color: C.inkSoft, fontWeight: "600", marginBottom: 6 },
  phonePill:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.greenBorder, alignSelf: "flex-start" },
  phoneTxt:      { color: C.green, fontSize: 11, fontWeight: "800" },

  sectionRow:   { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  sectionDot:   { width: 5, height: 5, borderRadius: C.r.pill },
  sectionLabel: { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, textTransform: "uppercase" },

  // ← ombre neutre
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  rowTwo:  { flexDirection: "row", gap: 10 },
  phoneRow:{ flexDirection: "row", gap: 8 },
  dialBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 10 },
  dialCode:{ color: C.ink, fontSize: 11, fontWeight: "800" },

  saveBtn:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 14 },
  saveBtnInner: {
    backgroundColor: C.green, flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 15, gap: 8, borderRadius: C.r.md,
    ...Platform.select({
      ios:     { shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  saveBtnTxt: { color: C.white, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },

  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.redBg, borderRadius: C.r.md, paddingVertical: 14, gap: 8, borderWidth: 1, borderColor: C.redBorder, marginBottom: 10 },
  deleteTxt: { color: C.red, fontWeight: "800", fontSize: 13 },
});