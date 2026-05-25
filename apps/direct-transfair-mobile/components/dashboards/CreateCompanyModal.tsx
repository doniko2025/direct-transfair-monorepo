// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
// =========================================================
// CREATE COMPANY MODAL v6.0 — Direct Transf'air
// ✅ Section BRANDING : logo, couleurs, police, tagline,
//    message d'accueil, couleur splash
// ✅ Preview live du branding
// ✅ Image picker (expo-image-picker) + fallback URL
// ✅ Tout le reste identique à v5.0
// =========================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6,
} from "./SuperAdmin.utils";

// ─── Design Tokens ────────────────────────────────────────
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
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },
  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "monospace"   }),
  },
};

// ─── Palette couleurs prédéfinies ─────────────────────────
const COLOR_PALETTE = [
  { hex: "#1956F0", name: "Bleu"         },
  { hex: "#059669", name: "Vert"         },
  { hex: "#7C3AED", name: "Violet"       },
  { hex: "#DC2626", name: "Rouge"        },
  { hex: "#D97706", name: "Ambre"        },
  { hex: "#0F766E", name: "Teal"         },
  { hex: "#0284C7", name: "Ciel"         },
  { hex: "#DB2777", name: "Rose"         },
  { hex: "#64748B", name: "Ardoise"      },
  { hex: "#B45309", name: "Brun"         },
  { hex: "#1E40AF", name: "Marine"       },
  { hex: "#166534", name: "Forêt"        },
];

// ─── Polices disponibles ──────────────────────────────────
const FONT_OPTIONS = [
  { value: "Trebuchet MS", label: "Trebuchet" },
  { value: "Georgia",      label: "Georgia"   },
  { value: "Arial",        label: "Arial"     },
  { value: "serif",        label: "Serif"     },
  { value: "sans-serif",   label: "Sans"      },
];

// ─── Props ────────────────────────────────────────────────
interface Props {
  visible:     boolean;
  onClose:     () => void;
  onSuccess:   () => void;
  isSuperAdmin: boolean;
}

// ─── SectionHeader ────────────────────────────────────────
function SectionHeader({ icon, title, color = T.blue }: {
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
  label, value, onChangeText, placeholder, keyboardType,
  autoCapitalize, secureTextEntry, multiline, editable = true, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; multiline?: boolean; editable?: boolean; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [shown,   setShown]   = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}{required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <View style={[
        fS.inputBox,
        !editable && fS.disabled,
        focused && { borderColor: T.blueMd, backgroundColor: T.blueLt + "40" },
      ]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }, multiline && { minHeight: 72, textAlignVertical: "top" }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !shown}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity style={fS.eyeBtn} onPress={() => setShown(!shown)}>
            <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={17} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, overflow: "hidden" },
  disabled: { backgroundColor: T.borderLt, opacity: 0.7 },
  input:    { flex: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: T.ink, fontWeight: "600" },
  eyeBtn:   { padding: 11 },
});

// ─── ReadonlyRow ─────────────────────────────────────────
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
          <Ionicons name={icon as any} size={16} color={T.blue} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const rrS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  row:      { flexDirection: "row", gap: 10, alignItems: "center" },
  valueBox: { flex: 1, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd, borderRadius: T.radius.md, paddingHorizontal: 13, paddingVertical: 11 },
  value:    { color: T.blue, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  regenBtn: { width: 44, height: 44, borderRadius: T.radius.md, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd, justifyContent: "center", alignItems: "center" },
});

// ─── PillSelector ────────────────────────────────────────
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
              {isActive && <View style={psS.dot} />}
              <Text style={[psS.txt, { fontFamily: T.font.sans }, isActive && { color: T.blue, fontWeight: "900" }]}>
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
  label: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" },
  row:   { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: T.radius.md, gap: 6, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, minWidth: 80 },
  dot:   { width: 6, height: 6, borderRadius: 99, backgroundColor: T.blue },
  txt:   { fontSize: 13, fontWeight: "700", color: T.inkSub },
});

// ─── ColorPicker ─────────────────────────────────────────
function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (hex: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);
  const [focused,  setFocused]  = useState(false);

  useEffect(() => { setHexInput(value); }, [value]);

  const applyHex = (raw: string) => {
    const cleaned = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) onChange(cleaned);
  };

  return (
    <View style={cpS.wrap}>
      <Text style={[cpS.label, { fontFamily: T.font.sans }]}>{label}</Text>

      {/* Palette prédéfinie */}
      <View style={cpS.palette}>
        {COLOR_PALETTE.map((c) => (
          <TouchableOpacity
            key={c.hex}
            style={[
              cpS.swatch,
              { backgroundColor: c.hex },
              value === c.hex && cpS.swatchActive,
            ]}
            onPress={() => { onChange(c.hex); setHexInput(c.hex); }}
            activeOpacity={0.85}
          >
            {value === c.hex && (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Saisie hex libre */}
      <View style={[cpS.hexRow, focused && { borderColor: value }]}>
        <View style={[cpS.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : "#E2E8F0" }]} />
        <TextInput
          style={[cpS.hexInput, { fontFamily: T.font.mono }]}
          value={hexInput}
          onChangeText={(v) => setHexInput(v)}
          onBlur={() => { applyHex(hexInput); setFocused(false); }}
          onFocus={() => setFocused(true)}
          placeholder="#1956F0"
          placeholderTextColor={T.inkMuted}
          autoCapitalize="characters"
          maxLength={7}
        />
        <Text style={[cpS.hexHint, { fontFamily: T.font.sans }]}>HEX</Text>
      </View>
    </View>
  );
}
const cpS = StyleSheet.create({
  wrap:        { marginBottom: 13 },
  label:       { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  palette:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  swatch:      { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "transparent" },
  swatchActive:{ borderColor: T.ink, borderWidth: 2.5, transform: [{ scale: 1.1 }] },
  hexRow:      { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, overflow: "hidden" },
  hexPreview:  { width: 40, height: 44, borderRightWidth: 1, borderRightColor: T.border },
  hexInput:    { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: T.ink, fontWeight: "700" },
  hexHint:     { paddingRight: 12, fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1 },
});

// ─── FontPicker ───────────────────────────────────────────
function FontPicker({ value, onChange }: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={fpS.wrap}>
      <Text style={[fpS.label, { fontFamily: T.font.sans }]}>POLICE D'ÉCRITURE</Text>
      <View style={fpS.row}>
        {FONT_OPTIONS.map((f) => {
          const isActive = value === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[fpS.pill, isActive && { backgroundColor: T.purpleLt, borderColor: T.purple + "50" }]}
              onPress={() => onChange(f.value)}
              activeOpacity={0.8}
            >
              <Text style={[fpS.txt, { fontFamily: f.value }, isActive && { color: T.purple }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const fpS = StyleSheet.create({
  wrap:  { marginBottom: 13 },
  label: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  row:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill:  { paddingHorizontal: 14, paddingVertical: 10, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
  txt:   { fontSize: 14, fontWeight: "700", color: T.inkSub },
});

// ─── LogoPicker ───────────────────────────────────────────
function LogoPicker({ value, onChange, disabled }: {
  value: string; onChange: (uri: string) => void; disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);

  const pickFromGallery = async () => {
    setPicking(true);
    try {
      // Import dynamique — pas d'erreur si non installé
      const ImagePicker = await import("expo-image-picker" as any);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les réglages.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          onChange(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          onChange(asset.uri);
        }
      }
    } catch {
      Alert.alert(
        "Image picker non disponible",
        "Saisissez l'URL du logo dans le champ ci-dessous.",
      );
    } finally {
      setPicking(false);
    }
  };

  const hasValidUrl = value.startsWith("http") || value.startsWith("data:");

  return (
    <View style={lpS.wrap}>
      <Text style={[lpS.label, { fontFamily: T.font.sans }]}>LOGO SOCIÉTÉ</Text>

      <View style={lpS.row}>
        {/* Prévisualisation */}
        <View style={lpS.preview}>
          {hasValidUrl ? (
            <Image source={{ uri: value }} style={lpS.previewImg} resizeMode="contain" />
          ) : (
            <Ionicons name="business-outline" size={28} color={T.inkMuted} />
          )}
        </View>

        {/* Bouton galerie */}
        <TouchableOpacity
          style={[lpS.pickBtn, disabled && { opacity: 0.5 }]}
          onPress={pickFromGallery}
          disabled={disabled || picking}
        >
          {picking
            ? <ActivityIndicator size="small" color={T.blue} />
            : <Ionicons name="image-outline" size={18} color={T.blue} />
          }
          <Text style={[lpS.pickTxt, { fontFamily: T.font.sans }]}>
            {picking ? "Chargement…" : "Galerie"}
          </Text>
        </TouchableOpacity>

        {/* Bouton vider */}
        {!!value && (
          <TouchableOpacity
            style={lpS.clearBtn}
            onPress={() => onChange("")}
            disabled={disabled}
          >
            <Ionicons name="trash-outline" size={16} color={T.red} />
          </TouchableOpacity>
        )}
      </View>

      {/* URL manuelle */}
      <View style={lpS.urlRow}>
        <TextInput
          style={[lpS.urlInput, { fontFamily: T.font.sans }]}
          value={value.startsWith("data:") ? "(image depuis galerie)" : value}
          onChangeText={(v) => {
            if (!v.startsWith("data:")) onChange(v);
          }}
          placeholder="https://exemple.com/logo.png"
          placeholderTextColor={T.inkMuted}
          keyboardType="url"
          autoCapitalize="none"
          editable={!disabled && !value.startsWith("data:")}
        />
      </View>
    </View>
  );
}
const lpS = StyleSheet.create({
  wrap:       { marginBottom: 13 },
  label:      { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  row:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  preview:    { width: 56, height: 56, borderRadius: 14, backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.border, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  previewImg: { width: 56, height: 56, borderRadius: 12 },
  pickBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd, borderRadius: T.radius.md, paddingVertical: 12 },
  pickTxt:    { color: T.blue, fontSize: 13, fontWeight: "800" },
  clearBtn:   { width: 42, height: 42, borderRadius: T.radius.md, backgroundColor: T.redLt, borderWidth: 1.5, borderColor: T.red + "30", justifyContent: "center", alignItems: "center" },
  urlRow:     { backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md },
  urlInput:   { paddingHorizontal: 13, paddingVertical: 11, fontSize: 12, color: T.inkSub, fontWeight: "600" },
});

// ─── BrandingPreview ─────────────────────────────────────
function BrandingPreview({
  companyName, logoUrl, primaryColor, tagline, fontFamily: ff,
}: {
  companyName: string; logoUrl: string; primaryColor: string;
  tagline: string; fontFamily: string;
}) {
  const name   = companyName || "Nom de la société";
  const hasImg = logoUrl.startsWith("http") || logoUrl.startsWith("data:");
  const safePrimary = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : T.blue;

  return (
    <View style={bpS.wrap}>
      <Text style={[bpS.previewLabel, { fontFamily: T.font.sans }]}>APERÇU LOGIN</Text>
      <View style={[bpS.card, { borderTopColor: safePrimary }]}>
        {/* Mini hero */}
        <View style={[bpS.hero, { backgroundColor: safePrimary }]}>
          <View style={bpS.heroContent}>
            <View style={bpS.logoOuter}>
              {hasImg ? (
                <Image source={{ uri: logoUrl }} style={bpS.logoImg} resizeMode="contain" />
              ) : (
                <Ionicons name="swap-horizontal" size={18} color={safePrimary} />
              )}
            </View>
            <Text style={[bpS.heroName, { fontFamily: ff || T.font.display }]} numberOfLines={1}>
              {name}
            </Text>
            {!!tagline && (
              <Text style={[bpS.heroTagline, { fontFamily: T.font.sans }]} numberOfLines={1}>
                {tagline}
              </Text>
            )}
          </View>
        </View>
        {/* Mini card login */}
        <View style={bpS.loginCard}>
          <View style={[bpS.loginAccent, { backgroundColor: safePrimary }]} />
          <Text style={[bpS.loginTitle, { fontFamily: ff || T.font.display }]}>Connectez-vous</Text>
          <View style={bpS.loginField} />
          <View style={bpS.loginField} />
          <View style={[bpS.loginBtn, { backgroundColor: safePrimary }]}>
            <Text style={[bpS.loginBtnTxt, { fontFamily: T.font.sans }]}>Se connecter →</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const bpS = StyleSheet.create({
  wrap:         { marginBottom: 13 },
  previewLabel: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  card:         { backgroundColor: T.surface, borderRadius: T.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: T.border, borderTopWidth: 3 },
  hero:         { paddingVertical: 14, paddingHorizontal: 12, alignItems: "center" },
  heroContent:  { alignItems: "center", gap: 4 },
  logoOuter:    { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  logoImg:      { width: 32, height: 32, borderRadius: 8 },
  heroName:     { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  heroTagline:  { color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "500" },
  loginCard:    { padding: 12 },
  loginAccent:  { height: 3, borderRadius: 99, marginBottom: 8 },
  loginTitle:   { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 8 },
  loginField:   { height: 10, backgroundColor: T.borderLt, borderRadius: 6, marginBottom: 6 },
  loginBtn:     { borderRadius: 8, paddingVertical: 7, alignItems: "center", marginTop: 4 },
  loginBtnTxt:  { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
});

// ─── Main Modal ───────────────────────────────────────────
export default function CreateCompanyModal({
  visible, onClose, onSuccess, isSuperAdmin,
}: Props) {
  const [creating, setCreating] = useState(false);

  // ── Société ──
  const [companyName,      setCompanyName]      = useState("");
  const [companyCode,      setCompanyCode]      = useState("");
  const [adminEmail,       setAdminEmail]       = useState("");
  const [adminPassword,    setAdminPassword]    = useState("");
  const [activitySector,   setActivitySector]   = useState("");
  const [contractType,     setContractType]     = useState<"RENTAL" | "PURCHASE">("RENTAL");
  const [ownerCountry,     setOwnerCountry]     = useState("");

  // ── Branding ── ✅ NOUVEAU
  const [logoUrl,          setLogoUrl]          = useState("");
  const [primaryColor,     setPrimaryColor]     = useState("#1956F0");
  const [secondaryColor,   setSecondaryColor]   = useState("#EEF2FF");
  const [tagline,          setTagline]          = useState("");
  const [welcomeMessage,   setWelcomeMessage]   = useState("");
  const [splashBgColor,    setSplashBgColor]    = useState("#064E3B");
  const [fontFamily,       setFontFamily]       = useState("Trebuchet MS");

  // ── Gérant ──
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName,  setManagerLastName]  = useState("");
  const [managerPhone,     setManagerPhone]     = useState("");
  const [gender,           setGender]           = useState<"M" | "F">("M");
  const [nationality,      setNationality]      = useState("");
  const [birthDate,        setBirthDate]        = useState("");
  const [birthCity,        setBirthCity]        = useState("");
  const [birthCountry,     setBirthCountry]     = useState("");

  // ── Adresse ──
  const [addrNumber,       setAddrNumber]       = useState("");
  const [addrLabel,        setAddrLabel]        = useState("");
  const [addrPostalCode,   setAddrPostalCode]   = useState("");
  const [addrCity,         setAddrCity]         = useState("");
  const [addrCountry,      setAddrCountry]      = useState("");

  const resetForm = useCallback(() => {
    setCompanyName(""); setAdminEmail(""); setContractType("RENTAL");
    setActivitySector(""); setOwnerCountry("");
    // Branding reset
    setLogoUrl(""); setPrimaryColor("#1956F0"); setSecondaryColor("#EEF2FF");
    setTagline(""); setWelcomeMessage(""); setSplashBgColor("#064E3B");
    setFontFamily("Trebuchet MS");
    // Gérant reset
    setManagerFirstName(""); setManagerLastName(""); setManagerPhone("");
    setGender("M"); setNationality(""); setBirthDate(""); setBirthCity(""); setBirthCountry("");
    // Adresse reset
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
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor))
      return showAlert("Couleur invalide", "La couleur primaire doit être au format #RRGGBB.");

    setCreating(true);
    try {
      const fullAddress = [
        addrNumber.trim(), addrLabel.trim(),
        addrPostalCode.trim(), addrCity.trim(), addrCountry.trim(),
      ].filter(Boolean).join(", ");

      await api.createClient({
        name,
        code,
        adminEmail:      email,
        adminPassword,
        subscriptionType: contractType,
        activitySector:  activitySector.trim()  || undefined,
        adminFirstName:  managerFirstName.trim(),
        adminLastName:   managerLastName.trim(),
        contactEmail:    email,
        contactPhone:    managerPhone.trim()     || undefined,
        ownerFirstName:  managerFirstName.trim(),
        ownerLastName:   managerLastName.trim(),
        ownerBirthDate:  birthDate.trim()        || undefined,
        ownerBirthPlace: birthCity.trim()        || undefined,
        ownerCountry:    nationality.trim() || ownerCountry.trim() || undefined,
        ownerAddress:    fullAddress             || undefined,
        // ✅ Champs branding
        logoUrl:         logoUrl.trim()          || undefined,
        primaryColor:    primaryColor            || undefined,
        secondaryColor:  secondaryColor          || undefined,
        tagline:         tagline.trim()          || undefined,
        welcomeMessage:  welcomeMessage.trim()   || undefined,
        splashBgColor:   splashBgColor           || undefined,
        fontFamily:      fontFamily              || undefined,
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

            <View style={s.handle} />

            {/* ── Header ── */}
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
              <TouchableOpacity style={s.closeBtn} onPress={onClose} disabled={creating}>
                <Ionicons name="close" size={18} color={T.inkSub} />
              </TouchableOpacity>
            </View>

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
                  label="Nom de l'entreprise" value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex: Flash Transfert International"
                  required editable={!creating}
                />
                <ReadonlyRow
                  label="Code Société (auto)" value={companyCode}
                  onRegenerate={() => !creating && setCompanyCode(generateTenantCode7())}
                  icon="refresh"
                />
                <Field
                  label="Email Administrateur" value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@societe.com"
                  keyboardType="email-address" autoCapitalize="none"
                  required editable={!creating}
                />
                <ReadonlyRow
                  label="Mot de passe provisoire" value={adminPassword}
                  onRegenerate={() => !creating && setAdminPassword(generateTempPassword6())}
                  icon="key"
                />
                <Field
                  label="Secteur d'activité" value={activitySector}
                  onChangeText={setActivitySector}
                  placeholder="Ex: Transfert d'argent, Commerce..."
                  editable={!creating}
                />
                <Field
                  label="Pays (devise par défaut)" value={ownerCountry}
                  onChangeText={setOwnerCountry}
                  placeholder="Ex: FR, GN, GB, SN..."
                  autoCapitalize="characters" editable={!creating}
                />
                <PillSelector
                  label="Type de contrat" value={contractType}
                  onChange={(v) => setContractType(v as "RENTAL" | "PURCHASE")}
                  options={[
                    { k: "RENTAL",   label: "Location" },
                    { k: "PURCHASE", label: "Achat"    },
                  ]}
                />
              </View>

              {/* ══ BRANDING ══ ✅ NOUVEAU */}
              <View style={s.card}>
                <SectionHeader icon="color-palette-outline" title="Branding & Identité Visuelle" color={T.purple} />

                {/* Preview live */}
                <BrandingPreview
                  companyName={companyName}
                  logoUrl={logoUrl}
                  primaryColor={primaryColor}
                  tagline={tagline}
                  fontFamily={fontFamily}
                />

                {/* Logo */}
                <LogoPicker
                  value={logoUrl}
                  onChange={setLogoUrl}
                  disabled={creating}
                />

                {/* Couleur primaire */}
                <ColorPicker
                  label="Couleur Primaire (thème principal)"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />

                {/* Couleur fond splash */}
                <ColorPicker
                  label="Couleur Fond Login (splash)"
                  value={splashBgColor}
                  onChange={setSplashBgColor}
                />

                {/* Police */}
                <FontPicker value={fontFamily} onChange={setFontFamily} />

                {/* Tagline */}
                <Field
                  label="Tagline (sous le nom)" value={tagline}
                  onChangeText={setTagline}
                  placeholder="Ex: Transferts rapides et sécurisés"
                  editable={!creating}
                />

                {/* Message d'accueil */}
                <Field
                  label="Message d'accueil (page login)" value={welcomeMessage}
                  onChangeText={setWelcomeMessage}
                  placeholder="Ex: Bienvenue sur votre espace de transfert"
                  multiline editable={!creating}
                />
              </View>

              {/* ══ GÉRANT ══ */}
              <View style={s.card}>
                <SectionHeader icon="person-outline" title="Informations Gérant" color={T.amber} />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="Prénom" value={managerFirstName} onChangeText={setManagerFirstName} placeholder="Alpha" required editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Nom" value={managerLastName} onChangeText={setManagerLastName} placeholder="DIALLO" required editable={!creating} />
                  </View>
                </View>
                <Field
                  label="Téléphone" value={managerPhone}
                  onChangeText={(v) => setManagerPhone(onlyDigits(v))}
                  placeholder="+224 620 000 000" keyboardType="phone-pad" editable={!creating}
                />
                <PillSelector
                  label="Genre" value={gender}
                  onChange={(v) => setGender(v as "M" | "F")}
                  options={[{ k: "M", label: "Homme" }, { k: "F", label: "Femme" }]}
                />
                <Field label="Nationalité" value={nationality} onChangeText={setNationality} placeholder="Guinéen, Français..." editable={!creating} />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="Date naissance" value={birthDate} onChangeText={setBirthDate} placeholder="JJ/MM/AAAA" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Lieu naissance" value={birthCity} onChangeText={setBirthCity} placeholder="Conakry" editable={!creating} />
                  </View>
                </View>
                <Field label="Pays de naissance" value={birthCountry} onChangeText={setBirthCountry} placeholder="Guinée" editable={!creating} />
              </View>

              {/* ══ ADRESSE ══ */}
              <View style={s.card}>
                <SectionHeader icon="location-outline" title="Adresse Société" color={T.green} />
                <View style={s.row2}>
                  <View style={{ flex: 0.4 }}>
                    <Field label="N°" value={addrNumber} onChangeText={setAddrNumber} placeholder="12" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Libellé voie" value={addrLabel} onChangeText={setAddrLabel} placeholder="Rue des Fleurs" editable={!creating} />
                  </View>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 0.45 }}>
                    <Field label="Code postal" value={addrPostalCode} onChangeText={(v) => setAddrPostalCode(v.trim())} placeholder="75001" editable={!creating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Ville" value={addrCity} onChangeText={setAddrCity} placeholder="Paris" editable={!creating} />
                  </View>
                </View>
                <Field label="Pays" value={addrCountry} onChangeText={setAddrCountry} placeholder="France" editable={!creating} />
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
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: T.pageBg, borderTopLeftRadius: T.radius.xxl, borderTopRightRadius: T.radius.xxl, maxHeight: "94%", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 16 },
  handle:  { width: 40, height: 4, borderRadius: 99, backgroundColor: T.borderMd, alignSelf: "center", marginTop: 12 },
  header:  { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 12 },
  headerIconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: T.blueMd, backgroundColor: T.blueLt },
  headerTitle:   { color: T.ink, fontSize: 18, fontWeight: "700" },
  headerSub:     { color: T.inkSub, fontSize: 10, fontWeight: "600", marginTop: 2 },
  closeBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: T.borderLt, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerDivider: { height: 1, backgroundColor: T.border },
  content:       { padding: 18 },
  card:          { backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: T.border, shadowColor: "#1240D6", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  row2:          { flexDirection: "row", gap: 12 },
  primaryBtn:    { borderRadius: T.radius.md, overflow: "hidden", marginTop: 6 },
  primaryGrad:   { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 10 },
  primaryTxt:    { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },
  cancelBtn:     { alignItems: "center", paddingVertical: 16, marginTop: 2 },
  cancelTxt:     { color: T.inkSub, fontWeight: "800", fontSize: 14 },
});