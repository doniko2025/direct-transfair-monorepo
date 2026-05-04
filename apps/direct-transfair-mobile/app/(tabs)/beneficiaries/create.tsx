// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/create.tsx
// =========================================================
// BENEFICIARY CREATE v4.0 — Direct Transf'air
// Design: Émeraude Profond (thème CLIENT)
// ✅ Formulaire complet nom / pays / ville / tel
// ✅ Indicatif auto depuis pays, PickerModal avec recherche
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView,
  Modal, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView,
  Platform, Animated, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "../../../services/api";
import { showAlert } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";
import { citiesByCountry } from "../../../data/cities";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  g1: "#0B1F14",
  g2: "#0F2A1C",
  accent: "#10B981",
  accentSoft: "#34D399",
  accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#1C2820",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  dimSoft: "#7B9E8A",
  red: "#EF4444",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, required, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; required?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <View style={[fS.box, focused && fS.boxFocused, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dimSoft, letterSpacing: 1, marginBottom: 6 },
  box: {
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  boxFocused: { borderColor: `${T.accent}45` },
  disabled: { opacity: 0.5 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
});

// ─── Select Button ────────────────────────────────────────
function SelectBtn({ label, value, onPress, icon, required }: {
  label: string; value: string; onPress: () => void; icon?: string; required?: boolean;
}) {
  return (
    <View style={sbS.wrap}>
      <Text style={[sbS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <TouchableOpacity style={sbS.btn} onPress={onPress} activeOpacity={0.8}>
        <View style={sbS.left}>
          {icon && <Text style={{ fontSize: 20, marginRight: 10 }}>{icon}</Text>}
          <Text style={[sbS.value, { fontFamily: T.font.sans }, !value && sbS.placeholder]}>
            {value || "Sélectionner…"}
          </Text>
        </View>
        <View style={sbS.chevron}>
          <Ionicons name="chevron-down" size={13} color={T.accent} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dimSoft, letterSpacing: 1, marginBottom: 6 },
  btn: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 13,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  value: { fontSize: 14, color: T.white, fontWeight: "600" },
  placeholder: { color: T.dim + "80" },
  chevron: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.accentGlow, justifyContent: "center", alignItems: "center",
  },
});

// ─── Picker Modal ─────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, renderItem }: any) {
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
            <Text style={[pmS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <TouchableOpacity style={pmS.closeBtn} onPress={close}>
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>
          <View style={pmS.searchBox}>
            <Ionicons name="search" size={15} color={T.dim} />
            <TextInput
              style={[pmS.searchInput, { fontFamily: T.font.sans }]}
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher…"
              placeholderTextColor={T.dim + "55"}
              autoFocus
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close" size={13} color={T.dim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => (item?.code ?? item ?? i).toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            ListEmptyComponent={
              <Text style={[pmS.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}
const pmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C1810", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "78%", borderWidth: 1, borderColor: T.inkBorder,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  title: { color: T.white, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  empty: { color: T.dim, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── Modal Item ───────────────────────────────────────────
const pmItem = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  txt: { color: T.white, fontSize: 14, fontWeight: "600", flex: 1 },
  dialCode: { color: T.accent, fontSize: 12, fontWeight: "900", marginRight: 8 },
});

// ─── Step Indicator ───────────────────────────────────────
function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <View style={[
      stS.dot,
      done && { backgroundColor: T.accent },
      active && { backgroundColor: T.accent, width: 24 },
      !active && !done && { backgroundColor: T.ghost },
    ]} />
  );
}
const stS = StyleSheet.create({
  dot: { height: 5, width: 5, borderRadius: 99 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function BeneficiaryCreateScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    city.trim().length >= 2;

  const availableCities: string[] = (citiesByCountry as any)[addressCountry.name] ?? (addressCountry as any).cities ?? [];

  const progress = [
    firstName.trim().length >= 2 && lastName.trim().length >= 2,
    city.trim().length >= 2,
    phoneNumber.trim().length > 0,
  ];
  const completedSteps = progress.filter(Boolean).length;

  const handleCreate = async () => {
    if (!canSubmit) { showAlert("Validation", "Veuillez remplir le nom, le prénom et la ville."); return; }
    try {
      setSubmitting(true);
      let fullPhone: string | null = null;
      if (phoneNumber.trim().length > 0) {
        const dial = phoneCountry.dialCode.replace("+", "");
        const num = phoneNumber.trim().replace(/^0+/, "");
        fullPhone = `+${dial}${num}`;
      }
      await api.createBeneficiary({
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        country: addressCountry.name,
        city: city.trim(),
        phone: fullPhone,
      });
      showAlert("✅ Ajouté", "Bénéficiaire ajouté avec succès.", () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de la création.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nouveau Bénéficiaire</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              {completedSteps}/3 étapes complétées
            </Text>
          </View>
        </View>

        {/* ── Progress ── */}
        <View style={s.progressRow}>
          {progress.map((done, i) => (
            <View key={i} style={[s.progressSegment, { backgroundColor: done ? T.accent : T.ghost }]} />
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Section Identité ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: progress[0] ? T.accent : T.dim }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>IDENTITÉ</Text>
            </View>

            <View style={s.card}>
              <View style={s.rowTwo}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="PRÉNOM"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Mamadou"
                    required
                    editable={!submitting}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="NOM"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Diallo"
                    required
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Preview nom complet */}
              {firstName.trim().length >= 1 && lastName.trim().length >= 1 && (
                <View style={s.previewPill}>
                  <View style={s.previewAvatar}>
                    <Text style={[s.previewInitials, { fontFamily: T.font.display }]}>
                      {firstName[0].toUpperCase()}{lastName[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[s.previewName, { fontFamily: T.font.sans }]}>
                    {firstName.trim()} {lastName.trim()}
                  </Text>
                  <Ionicons name="checkmark-circle" size={16} color={T.accent} />
                </View>
              )}
            </View>

            {/* ── Section Localisation ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: progress[1] ? T.accent : T.dim }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>LOCALISATION</Text>
            </View>

            <View style={s.card}>
              <SelectBtn
                label="PAYS DE RÉSIDENCE"
                value={addressCountry.name}
                icon={addressCountry.flag}
                onPress={() => setShowCountryModal(true)}
                required
              />

              <SelectBtn
                label="VILLE"
                value={city}
                onPress={() => setShowCityModal(true)}
                required
              />
            </View>

            {/* ── Section Téléphone ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: progress[2] ? T.accent : T.dim }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TÉLÉPHONE <Text style={{ color: T.dim, fontSize: 9 }}>(optionnel)</Text></Text>
            </View>

            <View style={s.card}>
              <Text style={[fS.label, { fontFamily: T.font.sans }]}>MOBILE MONEY</Text>
              <View style={s.phoneRow}>
                <TouchableOpacity
                  style={s.dialBtn}
                  onPress={() => setShowPhoneCodeModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 20 }}>{phoneCountry.flag}</Text>
                  <Text style={[s.dialCode, { fontFamily: T.font.mono }]}>{phoneCountry.dialCode}</Text>
                  <Ionicons name="caret-down" size={10} color={T.dim} />
                </TouchableOpacity>
                <View style={[fS.box, { flex: 1 }]}>
                  <TextInput
                    style={[fS.input, { fontFamily: T.font.sans }]}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="620 000 000"
                    placeholderTextColor={T.dim + "55"}
                    keyboardType="phone-pad"
                    editable={!submitting}
                  />
                </View>
              </View>
              <Text style={[s.phoneTip, { fontFamily: T.font.sans }]}>
                Utilisé pour les transferts Mobile Money directs.
              </Text>
            </View>

            {/* ── Boutons ── */}
            <TouchableOpacity
              style={[s.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!canSubmit || submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.accent, T.accentSoft]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.submitGrad}
              >
                {submitting
                  ? <ActivityIndicator color={T.g1} />
                  : <>
                      <Ionicons name="person-add-outline" size={18} color={T.g1} />
                      <Text style={[s.submitTxt, { fontFamily: T.font.sans }]}>AJOUTER LE BÉNÉFICIAIRE</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={submitting}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        {/* ── Modals ── */}
        <PickerModal
          visible={showCountryModal}
          onClose={() => setShowCountryModal(false)}
          title="Pays de résidence"
          data={countriesList}
          renderItem={({ item: c }: { item: CountryData }) => (
            <TouchableOpacity
              style={pmItem.row}
              onPress={() => { setAddressCountry(c); setPhoneCountry(c); setCity(""); setShowCountryModal(false); }}
            >
              <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
              <Text style={[pmItem.txt, { fontFamily: T.font.sans }]}>{c.name}</Text>
              {addressCountry.code === c.code && <Ionicons name="checkmark" size={18} color={T.accent} />}
            </TouchableOpacity>
          )}
        />

        <PickerModal
          visible={showCityModal}
          onClose={() => setShowCityModal(false)}
          title={`Villes · ${addressCountry.name}`}
          data={availableCities}
          renderItem={({ item: cityName }: { item: string }) => (
            <TouchableOpacity
              style={pmItem.row}
              onPress={() => { setCity(cityName); setShowCityModal(false); }}
            >
              <Text style={[pmItem.txt, { fontFamily: T.font.sans }]}>{cityName}</Text>
              {city === cityName && <Ionicons name="checkmark" size={18} color={T.accent} />}
            </TouchableOpacity>
          )}
        />

        <PickerModal
          visible={showPhoneCodeModal}
          onClose={() => setShowPhoneCodeModal(false)}
          title="Indicatif téléphonique"
          data={countriesList}
          renderItem={({ item: c }: { item: CountryData }) => (
            <TouchableOpacity
              style={pmItem.row}
              onPress={() => { setPhoneCountry(c); setShowPhoneCodeModal(false); }}
            >
              <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
              <Text style={[pmItem.txt, { fontFamily: T.font.sans }]}>{c.name}</Text>
              <Text style={[pmItem.dialCode, { fontFamily: T.font.mono }]}>{c.dialCode}</Text>
              {phoneCountry.code === c.code && <Ionicons name="checkmark" size={18} color={T.accent} />}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  progressRow: { flexDirection: "row", paddingHorizontal: 20, gap: 6, marginBottom: 16 },
  progressSegment: { flex: 1, height: 3, borderRadius: 99 },

  scroll: { paddingHorizontal: 20 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  rowTwo: { flexDirection: "row", gap: 12 },

  previewPill: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.accentGlow, borderRadius: T.radius.md,
    padding: 12, borderWidth: 1, borderColor: `${T.accent}20`,
    marginTop: 4,
  },
  previewAvatar: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${T.accent}20`, justifyContent: "center", alignItems: "center",
  },
  previewInitials: { color: T.accent, fontSize: 14, fontWeight: "900" },
  previewName: { flex: 1, color: T.white, fontSize: 14, fontWeight: "700" },

  phoneRow: { flexDirection: "row", gap: 10 },
  dialBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 12,
  },
  dialCode: { color: T.white, fontSize: 12, fontWeight: "800" },
  phoneTip: { color: T.dim, fontSize: 10, fontWeight: "600", marginTop: 8, lineHeight: 15 },

  submitBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  submitTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});