// apps/direct-transfair-mobile/app/(tabs)/admin/agencies/create.tsx
// =========================================================
// AGENCY CREATE v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle — dark premium
// ✅ Sélecteur pays + ville + indicatif téléphonique
// ✅ Devise auto depuis le pays sélectionné (wallets v4)
// ✅ Type agence : Filiale / Partenaire
// =========================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
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

// ─── Tokens ─────────────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", accentGlow: "rgba(212,168,83,0.15)" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", accentGlow: "rgba(52,211,153,0.15)" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", accentGlow: "rgba(245,158,11,0.15)" },
} as const;

const T = {
  inkLight:  "#1C1C28",
  inkBorder: "#2A2A3A",
  ghost:     "rgba(255,255,255,0.06)",
  ghostMid:  "rgba(255,255,255,0.10)",
  white:     "#FFFFFF",
  dim:       "#8A9BB5",
  green:     "#22C55E",
  amber:     "#F59E0B",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, required, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; required?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: "#EF4444" }}> *</Text>}
      </Text>
      <View style={[fS.box, focused && fS.boxFocused, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={isPassword && !shown}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity style={fS.eyeBtn} onPress={() => setShown(!shown)}>
            <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={18} color={T.dim} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  box: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  boxFocused: { borderColor: "rgba(255,255,255,0.25)" },
  disabled: { opacity: 0.5 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
  eyeBtn: { padding: 12 },
});

// ─── SelectButton ─────────────────────────────────────────
function SelectButton({ label, value, onPress, required, accent }: {
  label: string; value: string; onPress: () => void; required?: boolean; accent: string;
}) {
  return (
    <View style={sbS.wrap}>
      <Text style={[sbS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: "#EF4444" }}> *</Text>}
      </Text>
      <TouchableOpacity style={sbS.btn} onPress={onPress} activeOpacity={0.8}>
        <Text style={[sbS.value, { color: value ? T.white : T.dim + "80", fontFamily: T.font.sans }]}>
          {value || "Sélectionner…"}
        </Text>
        <View style={[sbS.chevron, { backgroundColor: `${accent}10` }]}>
          <Ionicons name="chevron-down" size={14} color={accent} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 13,
  },
  value: { flex: 1, fontSize: 14, fontWeight: "600" },
  chevron: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── SectionHeader ────────────────────────────────────────
function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${color}15`, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={[{ fontSize: 10, fontWeight: "900" as any, color: T.dim, letterSpacing: 1.5 }, { fontFamily: T.font.sans }]}>{title}</Text>
    </View>
  );
}

// ─── Country / City Modal ─────────────────────────────────
function PickerModal({
  visible, onClose, title, data, onSelect, renderItem,
}: {
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
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>
          <View style={pmS.searchBox}>
            <Ionicons name="search" size={16} color={T.dim} />
            <TextInput
              style={[pmS.searchInput, { fontFamily: T.font.sans }]}
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher…"
              placeholderTextColor={T.dim + "60"}
              autoFocus
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close" size={14} color={T.dim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => (typeof item === "string" ? item : item.code ?? item.name ?? i.toString())}
            renderItem={({ item }) => (
              <TouchableOpacity style={pmS.item} onPress={() => { onSelect(item); onClose(); setQ(""); }}>
                {renderItem(item)}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[pmS.empty, { fontFamily: T.font.sans }]}>Aucun résultat</Text>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}
const pmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C0C16", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "75%", borderWidth: 1, borderColor: T.inkBorder,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  title: { color: T.white, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  item: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  empty: { color: T.dim, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── Type Toggle ──────────────────────────────────────────
function TypeToggle({ isPartner, onChange, accent }: { isPartner: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <View style={ttS.card}>
      <TouchableOpacity
        style={[ttS.option, !isPartner && { backgroundColor: `${T.green}15`, borderColor: `${T.green}30` }]}
        onPress={() => onChange(false)}
        activeOpacity={0.85}
      >
        {!isPartner && <View style={[ttS.activeDot, { backgroundColor: T.green }]} />}
        <View style={{ flex: 1 }}>
          <Text style={[ttS.optTitle, { color: !isPartner ? T.green : T.dim, fontFamily: T.font.sans }]}>
            Agence Filiale
          </Text>
          <Text style={[ttS.optDesc, { fontFamily: T.font.sans }]}>
            Propriété directe · Gains à 100%
          </Text>
        </View>
        {!isPartner && <Ionicons name="checkmark-circle" size={20} color={T.green} />}
      </TouchableOpacity>

      <View style={ttS.divider} />

      <TouchableOpacity
        style={[ttS.option, isPartner && { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}
        onPress={() => onChange(true)}
        activeOpacity={0.85}
      >
        {isPartner && <View style={[ttS.activeDot, { backgroundColor: accent }]} />}
        <View style={{ flex: 1 }}>
          <Text style={[ttS.optTitle, { color: isPartner ? accent : T.dim, fontFamily: T.font.sans }]}>
            Agence Partenaire
          </Text>
          <Text style={[ttS.optDesc, { fontFamily: T.font.sans }]}>
            Société tierce indépendante · Commissionnée
          </Text>
        </View>
        {isPartner && <Ionicons name="checkmark-circle" size={20} color={accent} />}
      </TouchableOpacity>
    </View>
  );
}
const ttS = StyleSheet.create({
  card: { backgroundColor: T.ghost, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.inkBorder, marginBottom: 14, overflow: "hidden" },
  option: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
    borderWidth: 1, borderColor: "transparent",
  },
  activeDot: { width: 4, height: 36, borderRadius: 99 },
  optTitle: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  optDesc: { fontSize: 11, color: T.dim, fontWeight: "600", lineHeight: 15 },
  divider: { height: 1, backgroundColor: T.inkBorder },
});

// ─── Main Screen ──────────────────────────────────────────
export default function CreateAgencyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const [selectedCountry, setSelectedCountry] = useState<CountryData>(countriesList[0]);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState<CountryData>(countriesList[0]);
  const [selectedCity, setSelectedCity] = useState("");

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showPhoneCodeModal, setShowPhoneCodeModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setSelectedCity("");
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
  }, [selectedCountry]);

  const availableCities = (citiesByCountry as any)[selectedCountry.name] ?? [];

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !managerFirstName.trim() || !managerLastName.trim() || !selectedCity) {
      Alert.alert("Champs manquants", "Tous les champs marqués * sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      const fullPhone = `${selectedPhoneCode.dialCode}${phone.trim()}`;
      const autoCode = name.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

      // Dériver la devise depuis le pays (CountryData.currency n'est pas toujours présent)
      const COUNTRY_CURRENCY_MAP: Record<string, string> = {
        GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
        TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
        IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", AT: "EUR", FI: "EUR",
        IE: "EUR", LU: "EUR", GR: "EUR", GB: "GBP", US: "USD", SV: "USD",
        GG: "GBP", JE: "GBP",
      };
      const countryCode = (selectedCountry.code ?? "").toUpperCase().substring(0, 2);
      const agencyCurrency =
        (selectedCountry as any).currency
        ?? COUNTRY_CURRENCY_MAP[countryCode]
        ?? "XOF";

      const payload = {
        name: name.trim(),
        code: autoCode,
        // ✅ address doit être string, jamais undefined
        address: address.trim() || selectedCity,
        phone: fullPhone,
        email: email.trim(),
        adminEmail: email.trim(),
        adminFirstName: managerFirstName.trim(),
        adminLastName: managerLastName.trim(),
        adminPassword: password.trim(),
        managerName: `${managerFirstName.trim()} ${managerLastName.trim()}`,
        country: selectedCountry.code ?? selectedCountry.name,
        currency: agencyCurrency,
        primaryCurrency: agencyCurrency,
        city: selectedCity,
        subscriptionType: isPartner ? "PURCHASE" : "RENTAL",
        status: "ACTIVE",
      };

      await api.createAgency(payload as any);

      showToast(`✅ Agence "${name.trim()}" créée · ${agencyCurrency}`);
      // Fermeture automatique après 2s
      setTimeout(() => router.back(), 2800);
    } catch (error: any) {
      const rawMsg = error?.response?.data?.message ?? error?.message ?? "Erreur technique.";
      const displayMsg = Array.isArray(rawMsg) ? rawMsg[0] : String(rawMsg);
      if (Platform.OS === "web") {
        alert(`Erreur\n\n${displayMsg}`);
      } else if (error?.response?.status === 401) {
        Alert.alert("Session expirée", "Veuillez vous reconnecter.");
      } else {
        Alert.alert("Erreur", displayMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Toast succès ── */}
        <Animated.View style={{
          position: "absolute", top: Platform.OS === "android" ? 56 : 60, left: 20, right: 20, zIndex: 999,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }}>
          <View style={{ backgroundColor: "#16A34A", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13, flex: 1, fontFamily: T.font.sans }}>{toastMsg}</Text>
          </View>
        </Animated.View>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nouvelle Agence</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {(selectedCountry as any).currency ?? "XOF"} · {selectedCountry.name}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type agence */}
            <TypeToggle isPartner={isPartner} onChange={setIsPartner} accent={theme.accent} />

            {/* Identité */}
            <View style={s.card}>
              <SectionHeader icon="business-outline" title="IDENTITÉ" color={theme.accent} />
              <Field label="NOM DE L'AGENCE" value={name} onChangeText={setName} placeholder="Ex: Agence Centre-Ville" required editable={!submitting} />
              <Field label="EMAIL DE CONNEXION" value={email} onChangeText={setEmail} placeholder="contact@agence.com" keyboardType="email-address" autoCapitalize="none" required editable={!submitting} />
              <Field label="MOT DE PASSE" value={password} onChangeText={setPassword} placeholder="Définir un mot de passe…" secureTextEntry required editable={!submitting} />
            </View>

            {/* Responsable */}
            <View style={s.card}>
              <SectionHeader icon="person-outline" title="RESPONSABLE" color="#60A5FA" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="PRÉNOM" value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Moussa" required editable={!submitting} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="NOM" value={managerLastName} onChangeText={setManagerLastName} placeholder="DIOP" required editable={!submitting} />
                </View>
              </View>

              {/* Téléphone avec indicatif */}
              <Text style={[s.fieldLabel, { fontFamily: T.font.sans }]}>
                TÉLÉPHONE <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <View style={s.phoneRow}>
                <TouchableOpacity
                  style={[s.dialCodeBtn, { borderColor: T.inkBorder }]}
                  onPress={() => setShowPhoneCodeModal(true)}
                >
                  <Text style={{ fontSize: 20 }}>{selectedPhoneCode.flag}</Text>
                  <Text style={[s.dialCodeTxt, { fontFamily: T.font.mono }]}>{selectedPhoneCode.dialCode}</Text>
                  <Ionicons name="caret-down" size={10} color={T.dim} />
                </TouchableOpacity>
                <View style={[s.phoneInputBox, { borderColor: T.inkBorder }]}>
                  <TextInput
                    style={[s.phoneInput, { fontFamily: T.font.sans }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="620 000 000"
                    placeholderTextColor={T.dim + "60"}
                    keyboardType="phone-pad"
                    editable={!submitting}
                  />
                </View>
              </View>
            </View>

            {/* Localisation */}
            <View style={s.card}>
              <SectionHeader icon="location-outline" title="LOCALISATION · DEVISE" color={T.green} />

              {/* Pays */}
              <View style={s.countryPreview}>
                <TouchableOpacity
                  style={[s.countryBtn, { borderColor: `${theme.accent}25` }]}
                  onPress={() => setShowCountryModal(true)}
                >
                  <Text style={{ fontSize: 28 }}>{selectedCountry.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.countryName, { fontFamily: T.font.sans }]}>{selectedCountry.name}</Text>
                    <Text style={[s.countryCur, { color: theme.accent, fontFamily: T.font.mono }]}>
                      Devise: {(selectedCountry as any).currency ?? "XOF"}
                    </Text>
                  </View>
                  <View style={[s.chevronBox, { backgroundColor: `${theme.accent}15` }]}>
                    <Ionicons name="chevron-down" size={14} color={theme.accent} />
                  </View>
                </TouchableOpacity>
              </View>

              <SelectButton
                label="VILLE"
                value={selectedCity}
                onPress={() => setShowCityModal(true)}
                required
                accent={theme.accent}
              />

              <Field label="ADRESSE EXACTE" value={address} onChangeText={setAddress} placeholder="Quartier, Rue, N° Porte…" editable={!submitting} />
            </View>

            {/* Bouton */}
            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.65 }]}
              onPress={handleCreate}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[theme.accent, theme.accent + "CC"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.primaryGrad}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                    <Text style={[s.primaryTxt, { fontFamily: T.font.sans }]}>VALIDER LA CRÉATION</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={submitting}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        {/* Modals */}
        <PickerModal
          visible={showCountryModal}
          onClose={() => setShowCountryModal(false)}
          title="Choisir le Pays"
          data={countriesList}
          onSelect={(item: CountryData) => { setSelectedCountry(item); setSelectedPhoneCode(item); }}
          renderItem={(item: CountryData) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Text style={{ fontSize: 24 }}>{item.flag}</Text>
              <Text style={[{ flex: 1, color: T.white, fontSize: 14, fontWeight: "700" }, { fontFamily: T.font.sans }]}>
                {item.name}
              </Text>
              <Text style={[{ color: theme.accent, fontSize: 11, fontWeight: "900" }, { fontFamily: T.font.mono }]}>
                {(item as any).currency ?? ""}
              </Text>
            </View>
          )}
        />

        <PickerModal
          visible={showPhoneCodeModal}
          onClose={() => setShowPhoneCodeModal(false)}
          title="Indicatif Téléphonique"
          data={countriesList}
          onSelect={(item: CountryData) => setSelectedPhoneCode(item)}
          renderItem={(item: CountryData) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Text style={{ fontSize: 24 }}>{item.flag}</Text>
              <Text style={[{ flex: 1, color: T.white, fontSize: 14, fontWeight: "600" }, { fontFamily: T.font.sans }]}>
                {item.name}
              </Text>
              <Text style={[{ color: T.dim, fontSize: 13, fontWeight: "800" }, { fontFamily: T.font.mono }]}>
                {item.dialCode}
              </Text>
            </View>
          )}
        />

        <PickerModal
          visible={showCityModal}
          onClose={() => setShowCityModal(false)}
          title={`Villes · ${selectedCountry.name}`}
          data={availableCities}
          onSelect={(city: string) => setSelectedCity(city)}
          renderItem={(city: string) => (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[{ color: T.white, fontSize: 14, fontWeight: "600" }, { fontFamily: T.font.sans }]}>{city}</Text>
              <Ionicons name="chevron-forward" size={14} color={T.dim} />
            </View>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
    borderBottomWidth: 1, borderBottomColor: T.inkBorder,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: T.inkBorder,
  },

  fieldLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },

  phoneRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  dialCodeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.ghost, borderWidth: 1,
    borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 12,
  },
  dialCodeTxt: { color: T.white, fontSize: 13, fontWeight: "800" },
  phoneInputBox: {
    flex: 1, backgroundColor: T.ghost, borderWidth: 1,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },

  countryPreview: { marginBottom: 14 },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ghost, borderWidth: 1,
    borderRadius: T.radius.md, padding: 14,
  },
  countryName: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  countryCur: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  chevronBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },

  primaryBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 8 },
  primaryGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18, gap: 10,
  },
  primaryTxt: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});