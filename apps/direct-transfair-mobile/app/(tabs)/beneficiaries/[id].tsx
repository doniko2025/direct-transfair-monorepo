// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/[id].tsx
// =========================================================
// BENEFICIARY DETAIL v4.0 — Direct Transf'air
// Design: Émeraude Profond (thème CLIENT)
// ✅ Voir / Modifier / Supprimer un bénéficiaire
// ✅ Actions rapides Wallet + Cash
// =========================================================

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TextInput, ScrollView,
  Modal, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView,
  Platform, Alert, Animated, StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "../../../services/api";
import type { Beneficiary, CreateBeneficiaryPayload } from "../../../services/types";
import { showAlert, showConfirm } from "../../../utils/alert";
import { countriesList, CountryData } from "../../../data/countries";

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
  amber: "#F59E0B",
  blue: "#60A5FA",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Helpers ─────────────────────────────────────────────
function getIdParam(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.id;
  if (typeof raw === "string") { const v = raw.trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  if (Array.isArray(raw)) { const v = (raw[0] ?? "").trim(); return v.length > 0 && v !== "undefined" ? v : null; }
  return null;
}

// ─── Field Component ─────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
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
function SelectBtn({ label, value, onPress, icon }: { label: string; value: string; onPress: () => void; icon?: string }) {
  return (
    <View style={sbS.wrap}>
      <Text style={[sbS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <TouchableOpacity style={sbS.btn} onPress={onPress} activeOpacity={0.8}>
        <View style={sbS.left}>
          {icon && <Text style={{ fontSize: 20, marginRight: 8 }}>{icon}</Text>}
          <Text style={[sbS.value, { fontFamily: T.font.sans }, !value && sbS.placeholder]}>
            {value || "Sélectionner…"}
          </Text>
        </View>
        <View style={[sbS.chevron, { backgroundColor: T.accentGlow }]}>
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
  chevron: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Picker Modal ─────────────────────────────────────────
function PickerModal({
  visible, onClose, title, data, renderItem,
}: {
  visible: boolean; onClose: () => void; title: string;
  data: any[]; renderItem: any;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? data.filter((item: any) => (typeof item === "string" ? item : item.name ?? "").toLowerCase().includes(q.toLowerCase()))
    : data;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { onClose(); setQ(""); }}>
      <View style={pmS.overlay}>
        <View style={pmS.sheet}>
          <View style={pmS.handle} />
          <View style={pmS.headerRow}>
            <Text style={[pmS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <TouchableOpacity style={pmS.closeBtn} onPress={() => { onClose(); setQ(""); }}>
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>
          <View style={pmS.searchBox}>
            <Ionicons name="search" size={15} color={T.dim} />
            <TextInput
              style={[pmS.searchInput, { fontFamily: T.font.sans }]}
              value={q} onChangeText={setQ}
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
    maxHeight: "75%", borderWidth: 1, borderColor: T.inkBorder,
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

// ─── Action Card ──────────────────────────────────────────
function ActionCard({
  icon, iconBg, iconColor, title, subtitle, onPress,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; subtitle: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={aS.card}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[aS.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[aS.title, { fontFamily: T.font.sans }]}>{title}</Text>
          <Text style={[aS.sub, { fontFamily: T.font.sans }]}>{subtitle}</Text>
        </View>
        <View style={aS.chevronBox}>
          <Ionicons name="chevron-forward" size={14} color={T.accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const aS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10, gap: 14,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  iconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  title: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  sub: { color: T.dim, fontSize: 11, fontWeight: "600" },
  chevronBox: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.accentGlow, justifyContent: "center", alignItems: "center",
  },
});

// ─── Main Screen ──────────────────────────────────────────
export default function BeneficiaireDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = useMemo(() => getIdParam(params as any), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [item, setItem] = useState<Beneficiary | null>(null);
  const [editing, setEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressCountry, setAddressCountry] = useState<CountryData>(countriesList[0]);
  const [phoneCountry, setPhoneCountry] = useState<CountryData>(countriesList[0]);
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hydrateForm = (b: Beneficiary) => {
    const parts = (b.fullName || "").split(" ");
    if (parts.length > 1) {
      setFirstName(parts.slice(0, -1).join(" "));
      setLastName(parts[parts.length - 1]);
    } else {
      setFirstName(b.fullName || "");
      setLastName("");
    }
    const found = countriesList.find((c) => c.name === b.country);
    if (found) { setAddressCountry(found); if (!b.phone) setPhoneCountry(found); }
    setCity(b.city || "");

    if (b.phone) {
      const sorted = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);
      const match = sorted.find((c) => b.phone?.startsWith(c.dialCode));
      if (match) { setPhoneCountry(match); setPhoneNumber(b.phone.replace(match.dialCode, "")); }
      else setPhoneNumber(b.phone);
    } else {
      setPhoneNumber("");
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await api.getBeneficiary(id);
      setItem(b);
      hydrateForm(b);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      showAlert("Erreur", "Impossible de charger le bénéficiaire.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setEditing(false);
    fadeAnim.setValue(0);
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
      const num = phoneNumber.trim().replace(/^0+/, "");
      fullPhone = `+${dial}${num}`;
    }
    const payload: Partial<CreateBeneficiaryPayload> = {
      fullName, country: addressCountry.name, city: city.trim(), phone: fullPhone,
    };
    try {
      setSaving(true);
      const updated = await api.updateBeneficiary(id, payload);
      setItem(updated);
      hydrateForm(updated);
      setEditing(false);
    } catch {
      showAlert("Erreur", "Impossible de mettre à jour.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    showConfirm(
      "Supprimer le bénéficiaire",
      "Cette action est irréversible. Confirmer ?",
      async () => {
        try {
          setDeleting(true);
          await api.deleteBeneficiary(id);
          showAlert("Supprimé", "Bénéficiaire supprimé.", () => router.back());
        } catch {
          showAlert("Erreur", "Impossible de supprimer (lié à une transaction ?).");
        } finally {
          setDeleting(false);
        }
      }
    );
  };

  const onCancelEdit = () => { if (item) hydrateForm(item); setEditing(false); };

  const goSendWallet = () => {
    if (!item?.phone) { showAlert("Info", "Ce bénéficiaire n'a pas de numéro enregistré."); return; }
    router.push({ pathname: "/(tabs)/send", params: { mode: "WALLET", phone: item.phone } });
  };

  const goSendCash = () => {
    router.push({ pathname: "/(tabs)/send", params: { mode: "CASH", beneficiaryId: item?.id } });
  };

  const initials = item ? item.fullName.split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase() : "–";

  if (loading) {
    return (
      <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={T.accent} size="large" />
      </LinearGradient>
    );
  }

  if (!item) {
    return (
      <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Ionicons name="person-outline" size={40} color={T.dim} />
        <Text style={[{ color: T.dim, marginTop: 12, fontFamily: T.font.sans, fontWeight: "700" }]}>
          Bénéficiaire introuvable.
        </Text>
        <TouchableOpacity style={[{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: T.radius.md, backgroundColor: T.accentGlow, borderWidth: 1, borderColor: `${T.accent}30` }]} onPress={() => router.back()}>
          <Text style={[{ color: T.accent, fontWeight: "800", fontFamily: T.font.sans }]}>Retour</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const availableCities: string[] = (addressCountry as any).cities ?? [];

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Bénéficiaire</Text>
          {!editing ? (
            <TouchableOpacity
              style={[s.editBtn, { backgroundColor: T.accentGlow, borderColor: `${T.accent}30` }]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="pencil" size={17} color={T.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.cancelBtnHeader]} onPress={onCancelEdit}>
              <Ionicons name="close" size={17} color={T.dim} />
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
            <View style={s.heroRow}>
              <LinearGradient
                colors={[`${T.accent}25`, `${T.accent}10`]}
                style={s.avatarBox}
              >
                <Text style={[s.avatarInitials, { fontFamily: T.font.display }]}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroName, { fontFamily: T.font.display }]}>{item.fullName}</Text>
                <Text style={[s.heroSub, { fontFamily: T.font.sans }]}>
                  {item.city}{item.country ? `, ${item.country}` : ""}
                </Text>
                {item.phone && (
                  <View style={s.phonePill}>
                    <Ionicons name="call-outline" size={11} color={T.accent} />
                    <Text style={[s.phoneTxt, { fontFamily: T.font.mono }]}>{item.phone}</Text>
                  </View>
                )}
              </View>
            </View>

            {!editing ? (
              /* ── Vue lecture ── */
              <>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ENVOYER DE L'ARGENT</Text>
                </View>

                <ActionCard
                  icon="wallet-outline"
                  iconBg="rgba(16,185,129,0.12)"
                  iconColor={T.accent}
                  title="Vers un Wallet"
                  subtitle="Transfert direct Mobile Money"
                  onPress={goSendWallet}
                />
                <ActionCard
                  icon="cash-outline"
                  iconBg="rgba(96,165,250,0.12)"
                  iconColor={T.blue}
                  title="Envoi d'argent"
                  subtitle="Retrait en agence"
                  onPress={goSendCash}
                />
              </>
            ) : (
              /* ── Formulaire édition ── */
              <>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MODIFIER LES INFORMATIONS</Text>
                </View>

                <View style={s.card}>
                  <View style={s.rowTwo}>
                    <View style={{ flex: 1 }}>
                      <Field label="PRÉNOM" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" editable={!saving} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="NOM" value={lastName} onChangeText={setLastName} placeholder="Diallo" editable={!saving} />
                    </View>
                  </View>

                  <SelectBtn
                    label="PAYS DE RÉSIDENCE"
                    value={addressCountry.name}
                    icon={addressCountry.flag}
                    onPress={() => setShowCountryModal(true)}
                  />

                  <SelectBtn
                    label="VILLE"
                    value={city}
                    onPress={() => setShowCityModal(true)}
                  />

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[fS.label, { fontFamily: T.font.sans }]}>TÉLÉPHONE (MOBILE MONEY)</Text>
                    <View style={s.phoneRow}>
                      <TouchableOpacity style={s.dialBtn} onPress={() => setShowPhoneCodeModal(true)}>
                        <Text style={{ fontSize: 18 }}>{phoneCountry.flag}</Text>
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
                          editable={!saving}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[s.saveBtn, (!canSave || saving) && { opacity: 0.55 }]}
                  onPress={onSave}
                  disabled={!canSave || saving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[T.accent, T.accentSoft]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.saveBtnGrad}
                  >
                    {saving
                      ? <ActivityIndicator color={T.g1} />
                      : <>
                          <Ionicons name="save-outline" size={18} color={T.g1} />
                          <Text style={[s.saveBtnTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ── Supprimer ── */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.red }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>ZONE DANGEREUSE</Text>
            </View>

            <TouchableOpacity
              style={[s.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={onDelete}
              disabled={deleting}
              activeOpacity={0.85}
            >
              {deleting
                ? <ActivityIndicator color={T.red} />
                : <>
                    <Ionicons name="trash-outline" size={18} color={T.red} />
                    <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer le bénéficiaire</Text>
                  </>
              }
            </TouchableOpacity>

            <View style={{ height: 80 }} />
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
              style={pmS2.item}
              onPress={() => { setAddressCountry(c); setPhoneCountry(c); setCity(""); setShowCountryModal(false); }}
            >
              <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
              <Text style={[pmS2.itemTxt, { fontFamily: T.font.sans }]}>{c.name}</Text>
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
              style={pmS2.item}
              onPress={() => { setCity(cityName); setShowCityModal(false); }}
            >
              <Text style={[pmS2.itemTxt, { fontFamily: T.font.sans }]}>{cityName}</Text>
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
              style={pmS2.item}
              onPress={() => { setPhoneCountry(c); setShowPhoneCodeModal(false); }}
            >
              <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
              <Text style={[pmS2.itemTxt, { flex: 1, fontFamily: T.font.sans }]}>{c.name}</Text>
              <Text style={[pmS2.dialCode, { fontFamily: T.font.mono }]}>{c.dialCode}</Text>
              {phoneCountry.code === c.code && <Ionicons name="checkmark" size={18} color={T.accent} />}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const pmS2 = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  itemTxt: { color: T.white, fontSize: 14, fontWeight: "600", flex: 1 },
  dialCode: { color: T.accent, fontSize: 12, fontWeight: "900", marginRight: 8 },
});

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { flex: 1, color: T.white, fontSize: 20, fontWeight: "700" },
  editBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  cancelBtnHeader: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  heroRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  avatarBox: {
    width: 58, height: 58, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: `${T.accent}25`,
  },
  avatarInitials: { color: T.accent, fontSize: 22, fontWeight: "900" },
  heroName: { color: T.white, fontSize: 20, fontWeight: "700", marginBottom: 3 },
  heroSub: { color: T.dim, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  phonePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.accentGlow, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: `${T.accent}20`, alignSelf: "flex-start",
  },
  phoneTxt: { color: T.accent, fontSize: 11, fontWeight: "800" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  rowTwo: { flexDirection: "row", gap: 12 },

  phoneRow: { flexDirection: "row", gap: 10 },
  dialBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 12,
  },
  dialCode: { color: T.white, fontSize: 12, fontWeight: "800" },

  saveBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 20 },
  saveBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8 },
  saveBtnTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.08)", borderRadius: T.radius.md,
    paddingVertical: 15, gap: 8,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.20)", marginBottom: 10,
  },
  deleteTxt: { color: T.red, fontWeight: "800", fontSize: 14 },
});