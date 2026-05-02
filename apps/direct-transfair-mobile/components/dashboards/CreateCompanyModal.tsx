// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
// =========================================================
// CREATE COMPANY MODAL v4.0 — Direct Transf'air
// Design: Obsidian Luxury — cohérent avec SuperAdminDashboard
// ✅ Formulaire complet société + gérant + adresse
// ✅ Code 7 chars auto-généré, MDP provisoire
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
  Switch, ActivityIndicator, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6,
} from "./SuperAdmin.utils";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  ink:       "#0A0A0F",
  inkMid:    "#12121A",
  inkLight:  "#1C1C28",
  inkBorder: "#2A2A3A",
  gold:      "#D4A853",
  goldSoft:  "#F0C97A",
  goldGlow:  "rgba(212,168,83,0.15)",
  cream:     "#F5EFE0",
  creamDim:  "#C4B89A",
  white:     "#FFFFFF",
  ghost:     "rgba(255,255,255,0.06)",
  ghostMid:  "rgba(255,255,255,0.10)",
  green:     "#22C55E",
  red:       "#EF4444",
  amber:     "#F59E0B",

  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Props ───────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin: boolean;
}

// ─── Section Header ──────────────────────────────────────
function SectionHeader({ icon, title, color = T.gold }: { icon: string; title: string; color?: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[shS.title, { fontFamily: T.font.sans }]}>{title}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 8 },
  iconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 11, fontWeight: "900", color: T.creamDim, letterSpacing: 1.5 },
});

// ─── Field ───────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry, multiline, editable = true, suffix,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; multiline?: boolean; editable?: boolean; suffix?: string;
}) {
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.inputWrap, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: editable ? T.font.sans : T.font.mono }, multiline && { minHeight: 72, textAlignVertical: "top" }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.creamDim + "60"}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          editable={editable}
        />
        {suffix && (
          <View style={fS.suffixBox}>
            <Text style={[fS.suffixTxt, { fontFamily: T.font.mono }]}>{suffix}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.creamDim, letterSpacing: 1, marginBottom: 6 },
  inputWrap: {
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, flexDirection: "row", alignItems: "center", overflow: "hidden",
  },
  disabled: { backgroundColor: T.ink, borderColor: T.inkBorder },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
  suffixBox: {
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: T.inkBorder,
  },
  suffixTxt: { color: T.gold, fontSize: 11, fontWeight: "800" },
});

// ─── Pill Selector ────────────────────────────────────────
function PillSelector({ label, options, value, onChange }: {
  label: string; options: { k: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={psS.wrap}>
      <Text style={[psS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={psS.row}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.k}
            style={[psS.pill, value === o.k && psS.pillActive]}
            onPress={() => onChange(o.k)}
          >
            {value === o.k && <View style={psS.pillDot} />}
            <Text style={[psS.pillTxt, { fontFamily: T.font.sans }, value === o.k && psS.pillTxtActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const psS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.creamDim, letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: T.radius.md,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, gap: 6,
  },
  pillActive: { backgroundColor: T.goldGlow, borderColor: `${T.gold}40` },
  pillDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: T.gold },
  pillTxt: { color: T.creamDim, fontSize: 13, fontWeight: "700" },
  pillTxtActive: { color: T.gold, fontWeight: "900" },
});

// ─── Readonly Row ─────────────────────────────────────────
function ReadonlyRow({ label, value, onRegenerate, icon }: {
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
          <Ionicons name={icon as any} size={16} color={T.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const rrS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.creamDim, letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  valueBox: {
    flex: 1, backgroundColor: T.ink, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  value: { color: T.gold, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  regenBtn: {
    width: 44, height: 44, borderRadius: T.radius.md,
    backgroundColor: T.goldGlow, borderWidth: 1, borderColor: `${T.gold}30`,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Main Modal ───────────────────────────────────────────
export default function CreateCompanyModal({ visible, onClose, onSuccess, isSuperAdmin }: Props) {
  const [creating, setCreating] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [activitySector, setActivitySector] = useState("");
  const [contractType, setContractType] = useState<"RENTAL" | "PURCHASE">("RENTAL");
  const [ownerCountry, setOwnerCountry] = useState("");

  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthCity, setBirthCity] = useState("");
  const [birthCountry, setBirthCountry] = useState("");

  const [addrNumber, setAddrNumber] = useState("");
  const [addrLabel, setAddrLabel] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrCountry, setAddrCountry] = useState("");

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
    if (!isSuperAdmin) { showAlert("Accès refusé", "Seul le Super Admin peut créer une société."); return; }
    if (creating) return;

    const name = companyName.trim();
    const code = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();

    if (!name || !email) return showAlert("Champs manquants", "Nom d'entreprise et email obligatoires.");
    if (!isEmailLike(email)) return showAlert("Email invalide", "Vérifiez l'email administrateur.");
    if (!managerFirstName.trim() || !managerLastName.trim()) return showAlert("Champs manquants", "Prénom et nom du gérant obligatoires.");

    setCreating(true);
    try {
      const fullAddress = [
        addrNumber.trim(), addrLabel.trim(), addrPostalCode.trim(), addrCity.trim(), addrCountry.trim(),
      ].filter(Boolean).join(", ");

      await api.createClient({
        name, code, adminEmail: email, adminPassword,
        subscriptionType: contractType,
        activitySector: activitySector.trim() || undefined,
        adminFirstName: managerFirstName.trim(),
        adminLastName: managerLastName.trim(),
        contactEmail: email,
        contactPhone: managerPhone.trim() || undefined,
        ownerFirstName: managerFirstName.trim(),
        ownerLastName: managerLastName.trim(),
        ownerBirthDate: birthDate.trim() || undefined,
        ownerBirthPlace: birthCity.trim() || undefined,
        ownerCountry: nationality.trim() || ownerCountry.trim() || undefined,
        ownerAddress: fullAddress || undefined,
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
            {/* Handle */}
            <View style={s.handle} />

            {/* Header */}
            <LinearGradient
              colors={["#0A0A0F", "#12121A"]}
              style={s.header}
            >
              <View style={s.headerGoldLine} />
              <View style={s.headerContent}>
                <View style={s.headerIconBox}>
                  <Ionicons name="business" size={22} color={T.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nouvelle Société</Text>
                  <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
                    Code auto · MDP provisoire · Wallets créés automatiquement
                  </Text>
                </View>
                <TouchableOpacity style={s.closeBtn} onPress={onClose} disabled={creating}>
                  <Ionicons name="close" size={20} color={T.creamDim} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Société ── */}
              <View style={s.card}>
                <SectionHeader icon="business-outline" title="INFORMATIONS SOCIÉTÉ" />

                <Field
                  label="NOM DE L'ENTREPRISE *"
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex: Flash Transfert International"
                  editable={!creating}
                />

                <ReadonlyRow
                  label="CODE SOCIÉTÉ (AUTO)"
                  value={companyCode}
                  onRegenerate={() => !creating && setCompanyCode(generateTenantCode7())}
                  icon="refresh"
                />

                <Field
                  label="EMAIL ADMINISTRATEUR *"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@societe.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!creating}
                />

                <ReadonlyRow
                  label="MOT DE PASSE PROVISOIRE"
                  value={adminPassword}
                  onRegenerate={() => !creating && setAdminPassword(generateTempPassword6())}
                  icon="key"
                />

                <Field
                  label="SECTEUR D'ACTIVITÉ"
                  value={activitySector}
                  onChangeText={setActivitySector}
                  placeholder="Ex: Transfert d'argent, Commerce..."
                  editable={!creating}
                />

                <Field
                  label="PAYS (définit la devise par défaut)"
                  value={ownerCountry}
                  onChangeText={setOwnerCountry}
                  placeholder="Ex: FR, GN, GB, SN..."
                  autoCapitalize="characters"
                  editable={!creating}
                />

                <PillSelector
                  label="TYPE DE CONTRAT"
                  value={contractType}
                  onChange={(v) => setContractType(v as "RENTAL" | "PURCHASE")}
                  options={[
                    { k: "RENTAL", label: "Location" },
                    { k: "PURCHASE", label: "Achat" },
                  ]}
                />
              </View>

              {/* ── Gérant ── */}
              <View style={s.card}>
                <SectionHeader icon="person-outline" title="INFORMATIONS GÉRANT" color="#60A5FA" />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="PRÉNOM *" value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Alpha" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="NOM *" value={managerLastName} onChangeText={setManagerLastName} placeholder="DIALLO" editable={!creating} />
                  </View>
                </View>

                <Field
                  label="TÉLÉPHONE"
                  value={managerPhone}
                  onChangeText={(v) => setManagerPhone(onlyDigits(v))}
                  placeholder="+224 620 000 000"
                  keyboardType="phone-pad"
                  editable={!creating}
                />

                <PillSelector
                  label="GENRE"
                  value={gender}
                  onChange={(v) => setGender(v as "M" | "F")}
                  options={[
                    { k: "M", label: "Homme" },
                    { k: "F", label: "Femme" },
                  ]}
                />

                <Field label="NATIONALITÉ" value={nationality} onChangeText={setNationality} placeholder="Guinéen, Français..." editable={!creating} />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="DATE NAISSANCE" value={birthDate} onChangeText={setBirthDate} placeholder="JJ/MM/AAAA" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="LIEU NAISSANCE" value={birthCity} onChangeText={setBirthCity} placeholder="Conakry" editable={!creating} />
                  </View>
                </View>

                <Field label="PAYS DE NAISSANCE" value={birthCountry} onChangeText={setBirthCountry} placeholder="Guinée" editable={!creating} />
              </View>

              {/* ── Adresse ── */}
              <View style={s.card}>
                <SectionHeader icon="location-outline" title="ADRESSE SOCIÉTÉ" color={T.green} />

                <View style={s.row2}>
                  <View style={{ flex: 0.4 }}>
                    <Field label="N°" value={addrNumber} onChangeText={setAddrNumber} placeholder="12" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="LIBELLÉ VOIE" value={addrLabel} onChangeText={setAddrLabel} placeholder="Rue des Fleurs" editable={!creating} />
                  </View>
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 0.45 }}>
                    <Field label="CODE POSTAL *" value={addrPostalCode} onChangeText={(v) => setAddrPostalCode(v.trim())} placeholder="75001" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="VILLE" value={addrCity} onChangeText={setAddrCity} placeholder="Paris" editable={!creating} />
                  </View>
                </View>

                <Field label="PAYS" value={addrCountry} onChangeText={setAddrCountry} placeholder="France" editable={!creating} />
              </View>

              {/* ── Actions ── */}
              <TouchableOpacity
                style={[s.primaryBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[T.gold, T.goldSoft]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.primaryGrad}
                >
                  {creating
                    ? <ActivityIndicator color={T.ink} />
                    : <>
                        <Ionicons name="checkmark-circle" size={20} color={T.ink} />
                        <Text style={[s.primaryTxt, { fontFamily: T.font.sans }]}>CRÉER LA SOCIÉTÉ</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={creating}>
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
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.9)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: T.inkMid,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: "94%", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 99, backgroundColor: T.inkBorder,
    alignSelf: "center", marginTop: 12, marginBottom: 0,
  },
  header: { paddingBottom: 16 },
  headerGoldLine: { height: 1, backgroundColor: T.gold, opacity: 0.25 },
  headerContent: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 16, gap: 12,
  },
  headerIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: T.goldGlow, borderWidth: 1, borderColor: `${T.gold}30`,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerSub: { color: T.creamDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    justifyContent: "center", alignItems: "center",
  },

  content: { padding: 20 },

  card: {
    backgroundColor: T.inkLight, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.inkBorder,
  },

  row2: { flexDirection: "row", gap: 12 },

  primaryBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 8 },
  primaryGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18, gap: 10,
  },
  primaryTxt: { color: T.ink, fontWeight: "900", fontSize: 14, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  cancelTxt: { color: T.creamDim, fontWeight: "800", fontSize: 14 },
});