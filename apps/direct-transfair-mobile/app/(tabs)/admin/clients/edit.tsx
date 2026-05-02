// apps/direct-transfair-mobile/app/(tabs)/admin/clients/edit.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/clients/edit.tsx
// =========================================================
// CLIENT EDIT v4.0 — Direct Transf'air
// Design: Obsidian Luxury — cohérent avec clients/details
// ✅ Formulaire pré-rempli société + gérant + adresse
// ✅ PATCH vers backend, retour auto sur details
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, SafeAreaView, Alert, ScrollView,
  Switch, Platform, KeyboardAvoidingView, StatusBar, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";

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
  blue:      "#60A5FA",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Section Header ──────────────────────────────────────
function SectionHeader({ icon, title, color = T.gold }: { icon: string; title: string; color?: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[shS.title, { fontFamily: T.font.sans }]}>{title}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 10, fontWeight: "900", color: T.creamDim, letterSpacing: 1.5 },
});

// ─── Form Field ───────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, secureTextEntry,
  multiline, editable = true, info,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; multiline?: boolean; editable?: boolean; info?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {info && <Text style={[fS.info, { fontFamily: T.font.sans }]}>{info}</Text>}
      <View style={[
        fS.inputBox,
        !editable && fS.disabled,
        focused && { borderColor: `${T.gold}50` },
      ]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }, multiline && { minHeight: 80, textAlignVertical: "top" }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.creamDim + "50"}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
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
  label: { fontSize: 10, fontWeight: "900", color: T.creamDim, letterSpacing: 1, marginBottom: 4 },
  info: { fontSize: 10, color: T.creamDim + "80", fontWeight: "600", marginBottom: 6, fontStyle: "italic" },
  inputBox: {
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  disabled: { backgroundColor: T.ink, opacity: 0.6 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
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
        {options.map((o) => (
          <TouchableOpacity
            key={o.k}
            style={[psS.pill, value === o.k && psS.pillActive]}
            onPress={() => onChange(o.k)}
            activeOpacity={0.8}
          >
            {value === o.k && <View style={psS.dot} />}
            <Text style={[psS.txt, { fontFamily: T.font.sans }, value === o.k && psS.txtActive]}>
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
    paddingVertical: 12, borderRadius: T.radius.md, gap: 6,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
  },
  pillActive: { backgroundColor: T.goldGlow, borderColor: `${T.gold}40` },
  dot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.gold },
  txt: { color: T.creamDim, fontSize: 13, fontWeight: "700" },
  txtActive: { color: T.gold, fontWeight: "900" },
});

// ─── Helpers ──────────────────────────────────────────────
function getParamId(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

// ─── Main Screen ──────────────────────────────────────────
export default function EditClientScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();

  const idStr = getParamId(params.id);
  const clientId = idStr ? Number(idStr) : NaN;

  const [loadingData, setLoadingData] = useState(true);
  const [updating, setUpdating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Formulaire ──
  const [name, setName] = useState("");
  const [activitySector, setActivitySector] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contractType, setContractType] = useState<"RENTAL" | "PURCHASE">("RENTAL");

  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerBirthPlace, setOwnerBirthPlace] = useState("");
  const [ownerCountry, setOwnerCountry] = useState("");

  const [addrNumber, setAddrNumber] = useState("");
  const [addrLabel, setAddrLabel] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrCountry, setAddrCountry] = useState("");

  // ── Chargement ──
  useEffect(() => {
    if (!Number.isFinite(clientId)) {
      Alert.alert("Erreur", "ID de société invalide.");
      router.back();
      return;
    }
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

        // Tenter de parser l'adresse existante
        const raw = data.ownerAddress ?? data.address ?? "";
        const parts = raw.split(",").map((s: string) => s.trim());
        const streetPart = parts[0] ?? "";
        const streetMatch = streetPart.match(/^(\S+)\s+(.*)/);
        setAddrNumber(streetMatch ? streetMatch[1] : "");
        setAddrLabel(streetMatch ? streetMatch[2] : streetPart);
        const cityPart = parts[1] ?? "";
        const cityMatch = cityPart.match(/^(\S+)\s+(.*)/);
        setAddrPostalCode(cityMatch ? cityMatch[1] : "");
        setAddrCity(cityMatch ? cityMatch[2] : cityPart);
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

      const payload: Record<string, any> = {
        name: name.trim(),
        activitySector: activitySector.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        subscriptionType: contractType,
        ownerFirstName: ownerFirstName.trim() || undefined,
        ownerLastName: ownerLastName.trim() || undefined,
        ownerBirthDate: ownerBirthDate.trim() || undefined,
        ownerBirthPlace: ownerBirthPlace.trim() || undefined,
        ownerCountry: ownerCountry.trim() || undefined,
        ownerAddress: fullAddress || undefined,
      };

      await api.updateClient(clientId, payload);

      if (Platform.OS === "web") {
        alert("✅ Société mise à jour !");
      } else {
        Alert.alert("✅ Succès", "Société mise à jour avec succès !");
      }
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Échec de la mise à jour.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : JSON.stringify(msg));
    } finally {
      setUpdating(false);
    }
  };

  if (loadingData) {
    return (
      <LinearGradient colors={[T.ink, T.inkMid]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={T.gold} size="large" />
        <Text style={[{ color: T.creamDim, marginTop: 16, fontFamily: T.font.sans, fontSize: 13, fontWeight: "600" }]}>
          Chargement en cours…
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[T.ink, T.inkMid]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={20} color={T.creamDim} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Modifier la Société</Text>
            <Text style={[s.headerSub, { fontFamily: T.font.sans }]} numberOfLines={1}>
              {name || "Chargement…"}
            </Text>
          </View>
          {/* Bouton Sauvegarder rapide */}
          <TouchableOpacity
            style={[s.saveQuickBtn, updating && { opacity: 0.6 }]}
            onPress={handleUpdate}
            disabled={updating}
          >
            {updating
              ? <ActivityIndicator size="small" color={T.ink} />
              : <Ionicons name="checkmark" size={20} color={T.ink} />
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
            {/* ── Section Société ── */}
            <View style={s.card}>
              <SectionHeader icon="business-outline" title="SOCIÉTÉ" color={T.gold} />

              <Field
                label="NOM DE L'ENTREPRISE *"
                value={name}
                onChangeText={setName}
                placeholder="Flash Transfert International"
                editable={!updating}
              />
              <Field
                label="SECTEUR D'ACTIVITÉ"
                value={activitySector}
                onChangeText={setActivitySector}
                placeholder="Transfert d'argent, Commerce…"
                editable={!updating}
              />
              <Field
                label="EMAIL DE CONTACT"
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="contact@societe.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!updating}
              />
              <Field
                label="TÉLÉPHONE DE CONTACT"
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+224 620 000 000"
                keyboardType="phone-pad"
                editable={!updating}
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

            {/* ── Section Gérant ── */}
            <View style={s.card}>
              <SectionHeader icon="person-outline" title="GÉRANT" color={T.blue} />

              <Row2>
                <View style={{ flex: 1 }}>
                  <Field label="PRÉNOM" value={ownerFirstName} onChangeText={setOwnerFirstName} placeholder="Alpha" editable={!updating} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="NOM" value={ownerLastName} onChangeText={setOwnerLastName} placeholder="DIALLO" editable={!updating} />
                </View>
              </Row2>

              <Row2>
                <View style={{ flex: 1 }}>
                  <Field
                    label="DATE NAISSANCE"
                    value={ownerBirthDate}
                    onChangeText={setOwnerBirthDate}
                    placeholder="JJ/MM/AAAA"
                    editable={!updating}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="LIEU NAISSANCE"
                    value={ownerBirthPlace}
                    onChangeText={setOwnerBirthPlace}
                    placeholder="Conakry"
                    editable={!updating}
                  />
                </View>
              </Row2>

              <Field
                label="NATIONALITÉ / PAYS"
                value={ownerCountry}
                onChangeText={setOwnerCountry}
                placeholder="Guinéen, Français…"
                editable={!updating}
              />
            </View>

            {/* ── Section Adresse ── */}
            <View style={s.card}>
              <SectionHeader icon="location-outline" title="ADRESSE SOCIÉTÉ" color={T.green} />

              <Row2>
                <View style={{ flex: 0.4 }}>
                  <Field label="N°" value={addrNumber} onChangeText={setAddrNumber} placeholder="12" editable={!updating} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="LIBELLÉ VOIE" value={addrLabel} onChangeText={setAddrLabel} placeholder="Rue des Fleurs" editable={!updating} />
                </View>
              </Row2>

              <Row2>
                <View style={{ flex: 0.45 }}>
                  <Field label="CODE POSTAL" value={addrPostalCode} onChangeText={setAddrPostalCode} placeholder="75001" editable={!updating} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="VILLE" value={addrCity} onChangeText={setAddrCity} placeholder="Paris" editable={!updating} />
                </View>
              </Row2>

              <Field label="PAYS" value={addrCountry} onChangeText={setAddrCountry} placeholder="France" editable={!updating} />
            </View>

            {/* ── Bouton principal ── */}
            <TouchableOpacity
              style={[s.primaryBtn, updating && { opacity: 0.65 }]}
              onPress={handleUpdate}
              disabled={updating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.gold, T.goldSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryGrad}
              >
                {updating ? (
                  <ActivityIndicator color={T.ink} />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={19} color={T.ink} />
                    <Text style={[s.primaryTxt, { fontFamily: T.font.sans }]}>
                      ENREGISTRER LES MODIFICATIONS
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={updating}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>
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
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  headerSub: { color: T.creamDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  saveQuickBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.gold, justifyContent: "center", alignItems: "center",
    shadowColor: T.gold, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  card: {
    backgroundColor: T.inkLight, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.inkBorder,
  },

  primaryBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 8 },
  primaryGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18, gap: 10,
  },
  primaryTxt: { color: T.ink, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  cancelTxt: { color: T.creamDim, fontWeight: "800", fontSize: 14 },
});