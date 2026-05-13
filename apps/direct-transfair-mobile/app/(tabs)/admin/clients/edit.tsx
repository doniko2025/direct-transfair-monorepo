// apps/direct-transfair-mobile/app/(tabs)/admin/clients/edit.tsx
// =========================================================
// CLIENT EDIT v5.0 — Direct Transf'air
// ✅ Thème CLAIR — zéro dark/sombre
// ✅ Données 100% API — aucune valeur en dur
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, SafeAreaView, Alert, ScrollView,
  Platform, KeyboardAvoidingView, StatusBar, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";

const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderMd: "#CDD5E0",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
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
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    subtitle: Platform.select({ ios: "Avenir Next", android: "sans-serif-light",  default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

// ─── Section Header ──────────────────────────────────────
function SectionHeader({ icon, title, color = T.blue }: { icon: string; title: string; color?: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconBox, { backgroundColor: `${color}12` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[shS.title, { fontFamily: T.font.sans, color: T.inkMuted }]}>{title}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Form Field ───────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, multiline, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  multiline?: boolean; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[
        fS.inputBox,
        !editable && fS.disabled,
        focused && { borderColor: T.blueMd, backgroundColor: T.blueLt + "40" },
      ]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }, multiline && { minHeight: 80, textAlignVertical: "top" }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
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
  label: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  inputBox: {
    backgroundColor: T.surface,
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  disabled: { backgroundColor: T.pageBg, opacity: 0.7 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.ink, fontWeight: "600" },
});

// ─── Row2 ─────────────────────────────────────────────────
function Row2({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;
}

// ─── Pill Selector ────────────────────────────────────────
function PillSelector({ label, options, value, onChange }: {
  label: string; options: { k: string; label: string }[];
  value: string; onChange: (v: string) => void;
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
              style={[psS.pill, isActive && { backgroundColor: T.blueLt, borderColor: T.blueMd }]}
              onPress={() => onChange(o.k)}
              activeOpacity={0.8}
            >
              {isActive && <View style={[psS.dot, { backgroundColor: T.blue }]} />}
              <Text style={[psS.txt, { fontFamily: T.font.sans, color: isActive ? T.blue : T.inkSub }]}>
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
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: T.radius.md, gap: 6,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
  },
  dot: { width: 5, height: 5, borderRadius: 99 },
  txt: { fontSize: 13, fontWeight: "700" },
});

function getParamId(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

// ─── Main Screen ──────────────────────────────────────────
export default function EditClientScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const idStr   = getParamId(params.id);
  const clientId = idStr ? Number(idStr) : NaN;

  const [loadingData, setLoadingData] = useState(true);
  const [updating,    setUpdating]    = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [name,            setName]            = useState("");
  const [activitySector,  setActivitySector]  = useState("");
  const [contactEmail,    setContactEmail]    = useState("");
  const [contactPhone,    setContactPhone]    = useState("");
  const [contractType,    setContractType]    = useState<"RENTAL"|"PURCHASE">("RENTAL");
  const [ownerFirstName,  setOwnerFirstName]  = useState("");
  const [ownerLastName,   setOwnerLastName]   = useState("");
  const [ownerBirthDate,  setOwnerBirthDate]  = useState("");
  const [ownerBirthPlace, setOwnerBirthPlace] = useState("");
  const [ownerCountry,    setOwnerCountry]    = useState("");
  const [addrNumber,      setAddrNumber]      = useState("");
  const [addrLabel,       setAddrLabel]       = useState("");
  const [addrPostalCode,  setAddrPostalCode]  = useState("");
  const [addrCity,        setAddrCity]        = useState("");
  const [addrCountry,     setAddrCountry]     = useState("");

  useEffect(() => {
    if (!Number.isFinite(clientId)) { Alert.alert("Erreur", "ID de société invalide."); router.back(); return; }
    api.getClient(clientId)
      .then((data) => {
        setName(data.name ?? "");
        setActivitySector(data.activitySector ?? "");
        setContactEmail(data.contactEmail ?? data.email ?? "");
        setContactPhone(data.contactPhone ?? data.phone ?? "");
        setContractType((data.subscriptionType as any) === "PURCHASE" ? "PURCHASE" : "RENTAL");
        setOwnerFirstName(data.ownerFirstName ?? "");
        setOwnerLastName(data.ownerLastName ?? "");
        setOwnerBirthDate(data.ownerBirthDate ?? "");
        setOwnerBirthPlace(data.ownerBirthPlace ?? "");
        setOwnerCountry(data.ownerCountry ?? "");
        const raw = data.ownerAddress ?? data.address ?? "";
        const parts = raw.split(",").map((s: string) => s.trim());
        const street = parts[0] ?? "";
        const streetM = street.match(/^(\S+)\s+(.*)/);
        setAddrNumber(streetM ? streetM[1] : "");
        setAddrLabel(streetM ? streetM[2] : street);
        const cityPart = parts[1] ?? "";
        const cityM = cityPart.match(/^(\S+)\s+(.*)/);
        setAddrPostalCode(cityM ? cityM[1] : "");
        setAddrCity(cityM ? cityM[2] : cityPart);
        setAddrCountry(parts[2] ?? data.ownerCountry ?? "");
        Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
      })
      .catch(() => { Alert.alert("Erreur", "Impossible de charger la société."); router.back(); })
      .finally(() => setLoadingData(false));
  }, [clientId]);

  const handleUpdate = async () => {
    if (!name.trim()) { Alert.alert("Erreur", "Le nom de la société est obligatoire."); return; }
    setUpdating(true);
    try {
      const fullAddress = [
        [addrNumber.trim(), addrLabel.trim()].filter(Boolean).join(" "),
        [addrPostalCode.trim(), addrCity.trim()].filter(Boolean).join(" "),
        addrCountry.trim(),
      ].filter(Boolean).join(", ");

      await api.updateClient(clientId, {
        name: name.trim(),
        activitySector:  activitySector.trim()  || undefined,
        contactEmail:    contactEmail.trim()     || undefined,
        contactPhone:    contactPhone.trim()     || undefined,
        subscriptionType: contractType,
        ownerFirstName:  ownerFirstName.trim()   || undefined,
        ownerLastName:   ownerLastName.trim()    || undefined,
        ownerBirthDate:  ownerBirthDate.trim()   || undefined,
        ownerBirthPlace: ownerBirthPlace.trim()  || undefined,
        ownerCountry:    ownerCountry.trim()     || undefined,
        ownerAddress:    fullAddress             || undefined,
      });

      if (Platform.OS === "web") alert("✅ Société mise à jour !");
      else Alert.alert("✅ Succès", "Société mise à jour avec succès !");
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Échec de la mise à jour.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
    } finally { setUpdating(false); }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={T.blue} size="large" />
        <Text style={[{ color: T.inkSub, marginTop: 16, fontFamily: T.font.sans, fontSize: 13 }]}>
          Chargement en cours…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={20} color={T.inkSub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Modifier la Société</Text>
          <Text style={[s.headerSub, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {name || "Chargement…"}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.saveQuickBtn, updating && { opacity: 0.6 }]}
          onPress={handleUpdate}
          disabled={updating}
        >
          {updating
            ? <ActivityIndicator size="small" color={T.white} />
            : <Ionicons name="checkmark" size={20} color={T.white} />
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Société */}
          <View style={s.card}>
            <SectionHeader icon="business-outline" title="Société" color={T.blue} />
            <Field label="Nom de l'entreprise *" value={name} onChangeText={setName} placeholder="Flash Transfert International" editable={!updating} />
            <Field label="Secteur d'activité" value={activitySector} onChangeText={setActivitySector} placeholder="Transfert d'argent…" editable={!updating} />
            <Field label="Email de contact" value={contactEmail} onChangeText={setContactEmail} placeholder="contact@societe.com" keyboardType="email-address" autoCapitalize="none" editable={!updating} />
            <Field label="Téléphone de contact" value={contactPhone} onChangeText={setContactPhone} placeholder="+224 620 000 000" keyboardType="phone-pad" editable={!updating} />
            <PillSelector
              label="Type de contrat"
              value={contractType}
              onChange={(v) => setContractType(v as "RENTAL"|"PURCHASE")}
              options={[{ k: "RENTAL", label: "Location" }, { k: "PURCHASE", label: "Achat" }]}
            />
          </View>

          {/* Gérant */}
          <View style={s.card}>
            <SectionHeader icon="person-outline" title="Gérant" color={T.amber} />
            <Row2>
              <View style={{ flex: 1 }}><Field label="Prénom" value={ownerFirstName} onChangeText={setOwnerFirstName} placeholder="Alpha" editable={!updating} /></View>
              <View style={{ flex: 1 }}><Field label="Nom" value={ownerLastName} onChangeText={setOwnerLastName} placeholder="DIALLO" editable={!updating} /></View>
            </Row2>
            <Row2>
              <View style={{ flex: 1 }}><Field label="Date naissance" value={ownerBirthDate} onChangeText={setOwnerBirthDate} placeholder="JJ/MM/AAAA" editable={!updating} /></View>
              <View style={{ flex: 1 }}><Field label="Lieu naissance" value={ownerBirthPlace} onChangeText={setOwnerBirthPlace} placeholder="Conakry" editable={!updating} /></View>
            </Row2>
            <Field label="Nationalité / Pays" value={ownerCountry} onChangeText={setOwnerCountry} placeholder="Guinéen, Français…" editable={!updating} />
          </View>

          {/* Adresse */}
          <View style={s.card}>
            <SectionHeader icon="location-outline" title="Adresse société" color={T.green} />
            <Row2>
              <View style={{ flex: 0.4 }}><Field label="N°" value={addrNumber} onChangeText={setAddrNumber} placeholder="12" editable={!updating} /></View>
              <View style={{ flex: 1 }}><Field label="Libellé voie" value={addrLabel} onChangeText={setAddrLabel} placeholder="Rue des Fleurs" editable={!updating} /></View>
            </Row2>
            <Row2>
              <View style={{ flex: 0.45 }}><Field label="Code postal" value={addrPostalCode} onChangeText={setAddrPostalCode} placeholder="75001" editable={!updating} /></View>
              <View style={{ flex: 1 }}><Field label="Ville" value={addrCity} onChangeText={setAddrCity} placeholder="Paris" editable={!updating} /></View>
            </Row2>
            <Field label="Pays" value={addrCountry} onChangeText={setAddrCountry} placeholder="France" editable={!updating} />
          </View>

          {/* Bouton principal */}
          <TouchableOpacity
            style={[s.primaryBtn, updating && { opacity: 0.65 }]}
            onPress={handleUpdate}
            disabled={updating}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[T.blue, T.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryGrad}>
              {updating
                ? <ActivityIndicator color={T.white} />
                : <>
                    <Ionicons name="save-outline" size={18} color={T.white} />
                    <Text style={[s.primaryTxt, { fontFamily: T.font.sans }]}>ENREGISTRER</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={updating}>
            <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#F2F4F8" },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { color: T.ink, fontSize: 18, fontWeight: "700" },
  headerSub:   { color: T.inkSub, fontSize: 11, fontWeight: "600", marginTop: 2 },
  saveQuickBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: T.blue,
    justifyContent: "center", alignItems: "center",
    shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },

  content: { padding: 16 },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  primaryBtn: { borderRadius: T.radius.lg, overflow: "hidden", marginBottom: 10 },
  primaryGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 17,
  },
  primaryTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: T.inkSub, fontWeight: "700", fontSize: 14 },
});