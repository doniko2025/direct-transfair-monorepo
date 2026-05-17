// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
// =========================================================
// CREATE COMPANY MODAL v5.0 — Direct Transf'air
// ✅ Thème 100% CLAIR — zéro dark/sombre
// ✅ Formulaire complet société + gérant + adresse
// ✅ Code 7 chars auto-généré, MDP provisoire
// ✅ Cohérent avec SuperAdminDashboard v11
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6,
} from "./SuperAdmin.utils";

// ─── Design Tokens CLAIR ─────────────────────────────────
const T = {
  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderMd: "#D1D9E6",
  borderLt: "#F1F5F9",

  ink:      "#0F172A",
  inkMid:   "#374151",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  white: "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

// ─── Props ────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin: boolean;
}

// ─── Section Header ───────────────────────────────────────
function SectionHeader({
  icon, title, color = T.blue,
}: {
  icon: string; title: string; color?: string;
}) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconBox, { backgroundColor: color + "14" }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[shS.title, { fontFamily: T.font.sans, color: T.inkSub }]}>{title}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Field ────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, secureTextEntry,
  multiline, editable = true, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; multiline?: boolean;
  editable?: boolean; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [shown,   setShown]   = useState(false);
  const isPass = secureTextEntry;

  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <View style={[
        fS.inputBox,
        !editable && fS.disabled,
        focused && { borderColor: T.blueMd, backgroundColor: T.blueLt + "40" },
      ]}>
        <TextInput
          style={[
            fS.input,
            { fontFamily: T.font.sans },
            multiline && { minHeight: 72, textAlignVertical: "top" },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={isPass && !shown}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPass && (
          <TouchableOpacity style={fS.eyeBtn} onPress={() => setShown(!shown)}>
            <Ionicons
              name={shown ? "eye-off-outline" : "eye-outline"}
              size={17}
              color={T.inkMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    {
    fontSize: 10, fontWeight: "900", color: T.inkMuted,
    letterSpacing: 1, marginBottom: 5, textTransform: "uppercase",
  },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  disabled: { backgroundColor: T.borderLt, opacity: 0.7 },
  input:    { flex: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: T.ink, fontWeight: "600" },
  eyeBtn:   { padding: 11 },
});

// ─── Readonly Row (code auto / MDP) ───────────────────────
function ReadonlyRow({
  label, value, onRegenerate, icon,
}: {
  label: string; value: string; onRegenerate: () => void; icon: string;
}) {
  return (
    <View style={rrS.wrap}>
      <Text style={[rrS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={rrS.row}>
        <View style={rrS.valueBox}>
          <Text style={[rrS.value, { fontFamily: T.font.mono }]}>{value}</Text>
        </View>
        <TouchableOpacity style={rrS.regenBtn} onPress={onRegenerate}>
          <Ionicons name={icon as any} size={16} color={T.blue} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const rrS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    {
    fontSize: 10, fontWeight: "900", color: T.inkMuted,
    letterSpacing: 1, marginBottom: 5, textTransform: "uppercase",
  },
  row:      { flexDirection: "row", gap: 10, alignItems: "center" },
  valueBox: {
    flex: 1, backgroundColor: T.blueLt,
    borderWidth: 1.5, borderColor: T.blueMd,
    borderRadius: T.radius.md, paddingHorizontal: 13, paddingVertical: 11,
  },
  value:    { color: T.blue, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  regenBtn: {
    width: 44, height: 44, borderRadius: T.radius.md,
    backgroundColor: T.blueLt,
    borderWidth: 1.5, borderColor: T.blueMd,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Pill Selector ────────────────────────────────────────
function PillSelector({
  label, options, value, onChange,
}: {
  label: string;
  options: { k: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={psS.wrap}>
      <Text style={[psS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={psS.row}>
        {options.map((o) => {
          const isActive = value === o.k;
          return (
            <TouchableOpacity
              key={o.k}
              style={[
                psS.pill,
                isActive && { backgroundColor: T.blueLt, borderColor: T.blueMd },
              ]}
              onPress={() => onChange(o.k)}
              activeOpacity={0.8}
            >
              {isActive && <View style={psS.dot} />}
              <Text style={[
                psS.txt,
                { fontFamily: T.font.sans },
                isActive && { color: T.blue, fontWeight: "900" },
              ]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const psS = StyleSheet.create({
  wrap:  { marginBottom: 13 },
  label: {
    fontSize: 10, fontWeight: "900", color: T.inkMuted,
    letterSpacing: 1, marginBottom: 7, textTransform: "uppercase",
  },
  row:   { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 11, borderRadius: T.radius.md, gap: 6,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
  },
  dot:  { width: 6, height: 6, borderRadius: 99, backgroundColor: T.blue },
  txt:  { fontSize: 13, fontWeight: "700", color: T.inkSub },
});

// ─── Main Modal ───────────────────────────────────────────
export default function CreateCompanyModal({
  visible, onClose, onSuccess, isSuperAdmin,
}: Props) {
  const [creating, setCreating] = useState(false);

  const [companyName,      setCompanyName]      = useState("");
  const [companyCode,      setCompanyCode]      = useState("");
  const [adminEmail,       setAdminEmail]       = useState("");
  const [adminPassword,    setAdminPassword]    = useState("");
  const [activitySector,   setActivitySector]   = useState("");
  const [contractType,     setContractType]     = useState<"RENTAL" | "PURCHASE">("RENTAL");
  const [ownerCountry,     setOwnerCountry]     = useState("");

  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName,  setManagerLastName]  = useState("");
  const [managerPhone,     setManagerPhone]     = useState("");
  const [gender,           setGender]           = useState<"M" | "F">("M");
  const [nationality,      setNationality]      = useState("");
  const [birthDate,        setBirthDate]        = useState("");
  const [birthCity,        setBirthCity]        = useState("");
  const [birthCountry,     setBirthCountry]     = useState("");

  const [addrNumber,       setAddrNumber]       = useState("");
  const [addrLabel,        setAddrLabel]        = useState("");
  const [addrPostalCode,   setAddrPostalCode]   = useState("");
  const [addrCity,         setAddrCity]         = useState("");
  const [addrCountry,      setAddrCountry]      = useState("");

  const resetForm = useCallback(() => {
    setCompanyName(""); setAdminEmail(""); setContractType("RENTAL");
    setActivitySector(""); setOwnerCountry("");
    setManagerFirstName(""); setManagerLastName(""); setManagerPhone("");
    setGender("M"); setNationality(""); setBirthDate(""); setBirthCity(""); setBirthCountry("");
    setAddrNumber(""); setAddrLabel(""); setAddrPostalCode(""); setAddrCity(""); setAddrCountry("");
    setCompanyCode(generateTenantCode7());
    setAdminPassword(generateTempPassword6());
  }, []);

  useEffect(() => { if (visible) resetForm(); }, [visible, resetForm]);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === "web") {
      setTimeout(() => { window.alert(`${title}\n\n${message}`); if (onOk) onOk(); }, 100);
    } else {
      Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
    }
  };

  const handleCreate = async () => {
    if (!isSuperAdmin) {
      showAlert("Accès refusé", "Seul le Super Admin peut créer une société.");
      return;
    }
    if (creating) return;

    const name  = companyName.trim();
    const code  = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();

    if (!name || !email)
      return showAlert("Champs manquants", "Nom d'entreprise et email obligatoires.");
    if (!isEmailLike(email))
      return showAlert("Email invalide", "Vérifiez l'email administrateur.");
    if (!managerFirstName.trim() || !managerLastName.trim())
      return showAlert("Champs manquants", "Prénom et nom du gérant obligatoires.");

    setCreating(true);
    try {
      const fullAddress = [
        addrNumber.trim(), addrLabel.trim(),
        addrPostalCode.trim(), addrCity.trim(), addrCountry.trim(),
      ].filter(Boolean).join(", ");

      await api.createClient({
        name, code,
        adminEmail: email,
        adminPassword,
        subscriptionType:  contractType,
        activitySector:    activitySector.trim()  || undefined,
        adminFirstName:    managerFirstName.trim(),
        adminLastName:     managerLastName.trim(),
        contactEmail:      email,
        contactPhone:      managerPhone.trim()    || undefined,
        ownerFirstName:    managerFirstName.trim(),
        ownerLastName:     managerLastName.trim(),
        ownerBirthDate:    birthDate.trim()       || undefined,
        ownerBirthPlace:   birthCity.trim()       || undefined,
        ownerCountry:      nationality.trim() || ownerCountry.trim() || undefined,
        ownerAddress:      fullAddress            || undefined,
      });

      showAlert(
        "✅ Société créée",
        `${name}\nCode: ${code}\nAdmin: ${email}\nMot de passe: ${adminPassword}`,
        () => { onSuccess(); onClose(); },
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Création impossible.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", maxHeight: "94%" }}
        >
          <View style={s.sheet}>

            {/* ── Handle ── */}
            <View style={s.handle} />

            {/* ── Header clair ── */}
            <View style={s.header}>
              <View style={[s.headerIconBox, { backgroundColor: T.blueLt }]}>
                <Ionicons name="business" size={20} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
                  Nouvelle Société
                </Text>
                <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
                  Code auto · MDP provisoire · Wallets créés automatiquement
                </Text>
              </View>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={onClose}
                disabled={creating}
              >
                <Ionicons name="close" size={18} color={T.inkSub} />
              </TouchableOpacity>
            </View>

            {/* ── Séparateur ── */}
            <View style={s.headerDivider} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >

              {/* ══ SOCIÉTÉ ══ */}
              <View style={s.card}>
                <SectionHeader icon="business-outline" title="Informations Société" color={T.blue} />

                <Field
                  label="Nom de l'entreprise"
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex: Flash Transfert International"
                  required
                  editable={!creating}
                />

                <ReadonlyRow
                  label="Code Société (auto)"
                  value={companyCode}
                  onRegenerate={() => !creating && setCompanyCode(generateTenantCode7())}
                  icon="refresh"
                />

                <Field
                  label="Email Administrateur"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@societe.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  required
                  editable={!creating}
                />

                <ReadonlyRow
                  label="Mot de passe provisoire"
                  value={adminPassword}
                  onRegenerate={() => !creating && setAdminPassword(generateTempPassword6())}
                  icon="key"
                />

                <Field
                  label="Secteur d'activité"
                  value={activitySector}
                  onChangeText={setActivitySector}
                  placeholder="Ex: Transfert d'argent, Commerce..."
                  editable={!creating}
                />

                <Field
                  label="Pays (devise par défaut)"
                  value={ownerCountry}
                  onChangeText={setOwnerCountry}
                  placeholder="Ex: FR, GN, GB, SN..."
                  autoCapitalize="characters"
                  editable={!creating}
                />

                <PillSelector
                  label="Type de contrat"
                  value={contractType}
                  onChange={(v) => setContractType(v as "RENTAL" | "PURCHASE")}
                  options={[
                    { k: "RENTAL",   label: "Location" },
                    { k: "PURCHASE", label: "Achat"    },
                  ]}
                />
              </View>

              {/* ══ GÉRANT ══ */}
              <View style={s.card}>
                <SectionHeader icon="person-outline" title="Informations Gérant" color={T.amber} />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Prénom"
                      value={managerFirstName}
                      onChangeText={setManagerFirstName}
                      placeholder="Alpha"
                      required
                      editable={!creating}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Nom"
                      value={managerLastName}
                      onChangeText={setManagerLastName}
                      placeholder="DIALLO"
                      required
                      editable={!creating}
                    />
                  </View>
                </View>

                <Field
                  label="Téléphone"
                  value={managerPhone}
                  onChangeText={(v) => setManagerPhone(onlyDigits(v))}
                  placeholder="+224 620 000 000"
                  keyboardType="phone-pad"
                  editable={!creating}
                />

                <PillSelector
                  label="Genre"
                  value={gender}
                  onChange={(v) => setGender(v as "M" | "F")}
                  options={[
                    { k: "M", label: "Homme" },
                    { k: "F", label: "Femme" },
                  ]}
                />

                <Field
                  label="Nationalité"
                  value={nationality}
                  onChangeText={setNationality}
                  placeholder="Guinéen, Français..."
                  editable={!creating}
                />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Date naissance"
                      value={birthDate}
                      onChangeText={setBirthDate}
                      placeholder="JJ/MM/AAAA"
                      editable={!creating}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Lieu naissance"
                      value={birthCity}
                      onChangeText={setBirthCity}
                      placeholder="Conakry"
                      editable={!creating}
                    />
                  </View>
                </View>

                <Field
                  label="Pays de naissance"
                  value={birthCountry}
                  onChangeText={setBirthCountry}
                  placeholder="Guinée"
                  editable={!creating}
                />
              </View>

              {/* ══ ADRESSE ══ */}
              <View style={s.card}>
                <SectionHeader icon="location-outline" title="Adresse Société" color={T.green} />

                <View style={s.row2}>
                  <View style={{ flex: 0.4 }}>
                    <Field
                      label="N°"
                      value={addrNumber}
                      onChangeText={setAddrNumber}
                      placeholder="12"
                      editable={!creating}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Libellé voie"
                      value={addrLabel}
                      onChangeText={setAddrLabel}
                      placeholder="Rue des Fleurs"
                      editable={!creating}
                    />
                  </View>
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 0.45 }}>
                    <Field
                      label="Code postal"
                      value={addrPostalCode}
                      onChangeText={(v) => setAddrPostalCode(v.trim())}
                      placeholder="75001"
                      editable={!creating}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Ville"
                      value={addrCity}
                      onChangeText={setAddrCity}
                      placeholder="Paris"
                      editable={!creating}
                    />
                  </View>
                </View>

                <Field
                  label="Pays"
                  value={addrCountry}
                  onChangeText={setAddrCountry}
                  placeholder="France"
                  editable={!creating}
                />
              </View>

              {/* ══ BOUTON CRÉER ══ */}
              <TouchableOpacity
                style={[s.primaryBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[T.blue, T.blueDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryGrad}
                >
                  {creating ? (
                    <ActivityIndicator color={T.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={T.white} />
                      <Text style={[s.primaryTxt, { fontFamily: T.font.sans }]}>
                        CRÉER LA SOCIÉTÉ
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.cancelBtn}
                onPress={onClose}
                disabled={creating}
              >
                <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.pageBg,
    borderTopLeftRadius: T.radius.xxl,
    borderTopRightRadius: T.radius.xxl,
    maxHeight: "94%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 99,
    backgroundColor: T.borderMd,
    alignSelf: "center",
    marginTop: 12, marginBottom: 0,
  },

  // ── Header clair ──
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    gap: 12,
  },
  headerIconBox: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.blueMd,
  },
  headerTitle: { color: T.ink, fontSize: 18, fontWeight: "700" },
  headerSub:   { color: T.inkSub, fontSize: 10, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.borderLt,
    borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerDivider: { height: 1, backgroundColor: T.border },

  // ── Contenu ──
  content: { padding: 18 },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: T.border,
    ...{
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
  },

  row2: { flexDirection: "row", gap: 12 },

  primaryBtn: {
    borderRadius: T.radius.md,
    overflow: "hidden",
    marginTop: 6,
  },
  primaryGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 17, gap: 10,
  },
  primaryTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },

  cancelBtn: { alignItems: "center", paddingVertical: 16, marginTop: 2 },
  cancelTxt: { color: T.inkSub, fontWeight: "800", fontSize: 14 },
});