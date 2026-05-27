// apps/direct-transfair-mobile/components/dashboards/CreateCompanyModal.tsx
// =========================================================
// CREATE COMPANY MODAL v7.0 — Direct Transf'air
// ✅ Code société ÉDITABLE manuellement + générateur
// ✅ Mot de passe ÉDITABLE manuellement + générateur
// ✅ Devise — liste déroulante (GNF, EUR, USD, GBP, XOF)
// ✅ Secteur d'activité — liste complète intégrée
// ✅ Pays — liste déroulante (countriesList)
// ✅ Villes — liste déroulante selon pays (citiesByCountry)
// ✅ Correction erreur TS: import api supprimé du login.tsx
// ✅ Design premium refonte complète
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image, Animated, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import {
  normalizeUpperAlnum, isEmailLike, onlyDigits,
  generateTenantCode7, generateTempPassword6,
} from "./SuperAdmin.utils";
import { countriesList } from "../../data/countries";
import { citiesByCountry } from "../../data/cities";

const { height: SH } = Dimensions.get("window");

// ─── Devises disponibles ──────────────────────────────────
const CURRENCIES = [
  { code: "GNF", label: "Franc Guinéen",    symbol: "GF",  flag: "🇬🇳" },
  { code: "EUR", label: "Euro",             symbol: "€",   flag: "🇪🇺" },
  { code: "USD", label: "Dollar Américain", symbol: "$",   flag: "🇺🇸" },
  { code: "GBP", label: "Livre Sterling",   symbol: "£",   flag: "🇬🇧" },
  { code: "XOF", label: "Franc CFA BCEAO",  symbol: "CFA", flag: "🌍" },
];

// ─── Secteurs d'activité ──────────────────────────────────
const ACTIVITY_SECTORS = [
  // Finance & Transferts
  "Transfert d'argent international",
  "Transfert d'argent domestique",
  "Services de paiement mobile",
  "Change de devises",
  "Microfinance & Épargne",
  "Assurance vie & prévoyance",
  "Courtage financier",
  "Investissement & Bourse",
  "Fintech & Paiements numériques",
  "Banque & Services bancaires",
  // Commerce & Distribution
  "Commerce général",
  "Import / Export",
  "Grande distribution",
  "Commerce de gros",
  "Commerce de détail",
  "Supermarchés & Épiceries",
  "Électronique & High-Tech",
  "Mode & Textile",
  "Matériaux de construction",
  "Automobiles & Pièces détachées",
  "Pharmacie & Parapharmacie",
  // Services
  "Agence de voyage",
  "Transport & Logistique",
  "Hôtellerie & Restauration",
  "Télécommunications",
  "Éducation & Formation",
  "Santé & Médical",
  "Immobilier & Gestion locative",
  "Conseil & Audit",
  "Juridique & Notarial",
  "Publicité & Communication",
  "Informatique & Développement",
  "Sécurité privée",
  // Industrie & Production
  "Agriculture & Agro-alimentaire",
  "BTP & Génie civil",
  "Industrie minière",
  "Industrie pétrolière & gazière",
  "Énergie & Électricité",
  "Transformation alimentaire",
  "Textile & Confection",
  "Artisanat & Arts",
  // ONG / Institutionnel
  "ONG & Association humanitaire",
  "Organisme gouvernemental",
  "Coopérative",
  "Fondation",
  "Diaspora & Tontine",
  "Autre",
];

// ─── Design Tokens ─────────────────────────────────────────
const T = {
  pageBg:     "#F0F4FF",
  surface:    "#FFFFFF",
  border:     "#E2E8F0",
  borderMd:   "#D1D9E6",
  borderLt:   "#F1F5F9",
  ink:        "#0F172A",
  inkMid:     "#374151",
  inkSub:     "#6B7280",
  inkMuted:   "#9CA3AF",
  blue:       "#1956F0",
  blueDark:   "#1240D6",
  blueLt:     "#EEF2FF",
  blueMd:     "#C7D5FF",
  green:      "#16A34A",
  greenLt:    "#DCFCE7",
  red:        "#DC2626",
  redLt:      "#FEE2E2",
  amber:      "#D97706",
  amberLt:    "#FEF3C7",
  purple:     "#7C3AED",
  purpleLt:   "#EDE9FE",
  teal:       "#0F766E",
  tealLt:     "#CCFBF1",
  white:      "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 99 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Palette couleurs prédéfinies ─────────────────────────
const COLOR_PALETTE = [
  "#1956F0","#059669","#7C3AED","#DC2626","#D97706",
  "#0F766E","#0284C7","#DB2777","#64748B","#B45309",
  "#1E40AF","#166534",
];

const FONT_OPTIONS = [
  { value: "Georgia",    label: "Georgia"  },
  { value: "serif",      label: "Serif"    },
  { value: "sans-serif", label: "Sans"     },
  { value: "Arial",      label: "Arial"    },
];

interface Props {
  visible:      boolean;
  onClose:      () => void;
  onSuccess:    () => void;
  isSuperAdmin: boolean;
}

// ─────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, color = T.blue, badge }: {
  icon: string; title: string; color?: string; badge?: string;
}) {
  return (
    <View style={shS.wrap}>
      <LinearGradient
        colors={[color + "22", color + "08"]}
        style={[shS.iconBox, { borderColor: color + "30" }]}
      >
        <Ionicons name={icon as any} size={15} color={color} />
      </LinearGradient>
      <Text style={[shS.title, { color, fontFamily: T.font.sans }]}>{title}</Text>
      {badge && (
        <View style={[shS.badge, { backgroundColor: color + "14", borderColor: color + "30" }]}>
          <Text style={[shS.badgeTxt, { color, fontFamily: T.font.mono }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}
const shS = StyleSheet.create({
  wrap:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18, marginTop: 4 },
  iconBox:  { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  title:    { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, flex: 1 },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
});

// ─── Field standard ───────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType,
  autoCapitalize, secureTextEntry, multiline, editable = true,
  required, accent = T.blue,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; multiline?: boolean; editable?: boolean;
  required?: boolean; accent?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [shown,   setShown]   = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.spring(anim, { toValue: 1, useNativeDriver: false, speed: 40 }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.spring(anim, { toValue: 0, useNativeDriver: false, speed: 40 }).start();
  };

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [T.border, accent] });

  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}{required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <Animated.View style={[fS.inputBox, { borderColor }, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }, multiline && fS.multiline,
            Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !shown}
          multiline={multiline}
          editable={editable}
          onFocus={onFocus}
          onBlur={onBlur}
          underlineColorAndroid="transparent"
        />
        {secureTextEntry && (
          <TouchableOpacity style={fS.eyeBtn} onPress={() => setShown(!shown)}>
            <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={17} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderRadius: T.radius.md, overflow: "hidden" },
  disabled: { backgroundColor: T.borderLt, opacity: 0.65 },
  input:    { flex: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: T.ink, fontWeight: "600" },
  multiline:{ minHeight: 72, textAlignVertical: "top" },
  eyeBtn:   { padding: 11 },
});

// ─── EditableCodeRow — code ou mdp éditable + bouton regen ─
function EditableCodeRow({ label, value, onChange, onRegenerate, icon, accent = T.blue }: {
  label: string; value: string; onChange: (v: string) => void;
  onRegenerate: () => void; icon: string; accent?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ecS.wrap}>
      <Text style={[ecS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={ecS.row}>
        <View style={[ecS.inputBox, focused && { borderColor: accent }]}>
          <TextInput
            style={[ecS.input, { fontFamily: T.font.mono, color: accent },
              Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
        </View>
        <TouchableOpacity
          style={[ecS.regenBtn, { backgroundColor: accent + "14", borderColor: accent + "30" }]}
          onPress={onRegenerate}
          activeOpacity={0.75}
        >
          <Ionicons name={icon as any} size={17} color={accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const ecS = StyleSheet.create({
  wrap:     { marginBottom: 13 },
  label:    { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  row:      { flexDirection: "row", gap: 10, alignItems: "center" },
  inputBox: { flex: 1, backgroundColor: T.blueLt, borderWidth: 1.5, borderColor: T.blueMd, borderRadius: T.radius.md, overflow: "hidden" },
  input:    { paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontWeight: "900", letterSpacing: 2 },
  regenBtn: { width: 46, height: 46, borderRadius: T.radius.md, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
});

// ─── SelectDropdown — liste déroulante inline ─────────────
function SelectDropdown<T extends string>({ label, value, options, onChange, placeholder, accent = T.blue, required }: {
  label: string;
  value: T | "";
  options: { value: T; label: string; sub?: string; left?: React.ReactNode }[];
  onChange: (v: T) => void;
  placeholder?: string;
  accent?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find(o => o.value === value);
  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={sdS.wrap}>
      <Text style={[sdS.label, { fontFamily: T.font.sans }]}>
        {label}{required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[sdS.trigger, open && { borderColor: accent, backgroundColor: accent + "06" }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.85}
      >
        {selected?.left && <View style={sdS.leftSlot}>{selected.left}</View>}
        <View style={{ flex: 1 }}>
          {selected ? (
            <Text style={[sdS.triggerValue, { fontFamily: T.font.sans }]}>{selected.label}</Text>
          ) : (
            <Text style={[sdS.triggerPlaceholder, { fontFamily: T.font.sans }]}>{placeholder || "Sélectionner…"}</Text>
          )}
          {selected?.sub && (
            <Text style={[sdS.triggerSub, { fontFamily: T.font.sans }]}>{selected.sub}</Text>
          )}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16} color={open ? accent : T.inkMuted}
        />
      </TouchableOpacity>

      {open && (
        <View style={[sdS.dropdown, { borderColor: accent + "30" }]}>
          {options.length > 8 && (
            <View style={[sdS.searchBox, { borderBottomColor: T.border }]}>
              <Ionicons name="search-outline" size={14} color={T.inkMuted} />
              <TextInput
                style={[sdS.searchInput, { fontFamily: T.font.sans },
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher…"
                placeholderTextColor={T.inkMuted}
                autoFocus
                underlineColorAndroid="transparent"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color={T.inkMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {filtered.map((o, i) => {
              const isActive = o.value === value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[
                    sdS.option,
                    isActive && { backgroundColor: accent + "10" },
                    i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.borderLt },
                  ]}
                  onPress={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  activeOpacity={0.75}
                >
                  {o.left && <View style={sdS.leftSlot}>{o.left}</View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[sdS.optionTxt, { fontFamily: T.font.sans },
                      isActive && { color: accent, fontWeight: "800" }]}>
                      {o.label}
                    </Text>
                    {o.sub && (
                      <Text style={[sdS.optionSub, { fontFamily: T.font.sans }]}>{o.sub}</Text>
                    )}
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={16} color={accent} />}
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && (
              <View style={sdS.empty}>
                <Text style={[{ color: T.inkMuted, fontSize: 12, fontFamily: T.font.sans }]}>Aucun résultat</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
const sdS = StyleSheet.create({
  wrap:             { marginBottom: 13 },
  label:            { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" },
  trigger:          { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 13, paddingVertical: 11, gap: 8 },
  leftSlot:         { marginRight: 4 },
  triggerValue:     { fontSize: 14, color: T.ink, fontWeight: "600" },
  triggerPlaceholder:{ fontSize: 14, color: T.inkMuted, fontWeight: "400" },
  triggerSub:       { fontSize: 10, color: T.inkSub, marginTop: 1 },
  dropdown:         { backgroundColor: T.surface, borderWidth: 1.5, borderRadius: T.radius.md, marginTop: 4, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  searchBox:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1 },
  searchInput:      { flex: 1, fontSize: 13, color: T.ink, fontWeight: "600" },
  option:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  optionTxt:        { fontSize: 13, color: T.ink, fontWeight: "600" },
  optionSub:        { fontSize: 10, color: T.inkSub, marginTop: 1 },
  empty:            { padding: 20, alignItems: "center" },
});

// ─── PillSelector ─────────────────────────────────────────
function PillSelector({ label, options, value, onChange, accent = T.blue }: {
  label: string; options: { k: string; label: string }[];
  value: string; onChange: (v: string) => void; accent?: string;
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
              style={[psS.pill, isActive && { backgroundColor: accent + "14", borderColor: accent + "40" }]}
              onPress={() => onChange(o.k)}
              activeOpacity={0.8}
            >
              {isActive && <View style={[psS.dot, { backgroundColor: accent }]} />}
              <Text style={[psS.txt, { fontFamily: T.font.sans }, isActive && { color: accent, fontWeight: "900" }]}>
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
  dot:   { width: 6, height: 6, borderRadius: 99 },
  txt:   { fontSize: 13, fontWeight: "700", color: T.inkSub },
});

// ─── ColorPicker ──────────────────────────────────────────
function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (hex: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value);
  const [focused,  setFocused]  = useState(false);
  useEffect(() => { setHexInput(value); }, [value]);

  const applyHex = (raw: string) => {
    const c = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(c)) onChange(c);
  };

  return (
    <View style={cpS.wrap}>
      <Text style={[cpS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={cpS.palette}>
        {COLOR_PALETTE.map((c) => (
          <TouchableOpacity
            key={c}
            style={[cpS.swatch, { backgroundColor: c }, value === c && [cpS.swatchActive, { borderColor: c }]]}
            onPress={() => { onChange(c); setHexInput(c); }}
            activeOpacity={0.85}
          >
            {value === c && <Ionicons name="checkmark" size={11} color="#FFF" />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={[cpS.hexRow, focused && { borderColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : T.blue }]}>
        <View style={[cpS.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : "#E2E8F0" }]} />
        <TextInput
          style={[cpS.hexInput, { fontFamily: T.font.mono },
            Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
          value={hexInput}
          onChangeText={setHexInput}
          onBlur={() => { applyHex(hexInput); setFocused(false); }}
          onFocus={() => setFocused(true)}
          placeholder="#1956F0"
          placeholderTextColor={T.inkMuted}
          autoCapitalize="characters"
          maxLength={7}
          underlineColorAndroid="transparent"
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
  swatchActive:{ borderWidth: 2.5, transform: [{ scale: 1.12 }] },
  hexRow:      { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, overflow: "hidden" },
  hexPreview:  { width: 40, height: 44, borderRightWidth: 1, borderRightColor: T.border },
  hexInput:    { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: T.ink, fontWeight: "700" },
  hexHint:     { paddingRight: 12, fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1 },
});

// ─── LogoPicker ───────────────────────────────────────────
function LogoPicker({ value, onChange, disabled }: {
  value: string; onChange: (uri: string) => void; disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);

  const pickFromGallery = async () => {
    setPicking(true);
    try {
      const ImagePicker = await import("expo-image-picker" as any);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les réglages.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        onChange(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
      }
    } catch {
      Alert.alert("Non disponible", "Saisissez l'URL du logo ci-dessous.");
    } finally { setPicking(false); }
  };

  const hasValidUrl = value.startsWith("http") || value.startsWith("data:");

  return (
    <View style={lpS.wrap}>
      <Text style={[lpS.label, { fontFamily: T.font.sans }]}>LOGO SOCIÉTÉ</Text>
      <View style={lpS.row}>
        <View style={lpS.preview}>
          {hasValidUrl
            ? <Image source={{ uri: value }} style={lpS.previewImg} resizeMode="contain" />
            : <Ionicons name="business-outline" size={28} color={T.inkMuted} />
          }
        </View>
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
        {!!value && (
          <TouchableOpacity style={lpS.clearBtn} onPress={() => onChange("")} disabled={disabled}>
            <Ionicons name="trash-outline" size={16} color={T.red} />
          </TouchableOpacity>
        )}
      </View>
      <View style={lpS.urlRow}>
        <TextInput
          style={[lpS.urlInput, { fontFamily: T.font.sans },
            Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
          value={value.startsWith("data:") ? "(image depuis galerie)" : value}
          onChangeText={(v) => { if (!v.startsWith("data:")) onChange(v); }}
          placeholder="https://exemple.com/logo.png"
          placeholderTextColor={T.inkMuted}
          keyboardType="url"
          autoCapitalize="none"
          editable={!disabled && !value.startsWith("data:")}
          underlineColorAndroid="transparent"
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

// ─── BrandingPreview ──────────────────────────────────────
function BrandingPreview({ companyName, logoUrl, primaryColor, tagline, fontFamily: ff }: {
  companyName: string; logoUrl: string; primaryColor: string;
  tagline: string; fontFamily: string;
}) {
  const name      = companyName || "Nom de la société";
  const hasImg    = logoUrl.startsWith("http") || logoUrl.startsWith("data:");
  const safePrimary = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : T.blue;

  return (
    <View style={bpS.wrap}>
      <Text style={[bpS.previewLabel, { fontFamily: T.font.sans }]}>APERÇU LOGIN</Text>
      <View style={[bpS.card, { borderTopColor: safePrimary }]}>
        <View style={[bpS.hero, { backgroundColor: safePrimary }]}>
          <View style={bpS.heroContent}>
            <View style={bpS.logoOuter}>
              {hasImg
                ? <Image source={{ uri: logoUrl }} style={bpS.logoImg} resizeMode="contain" />
                : <Ionicons name="swap-horizontal" size={18} color={safePrimary} />
              }
            </View>
            <Text style={[bpS.heroName, { fontFamily: ff || T.font.display }]} numberOfLines={1}>{name}</Text>
            {!!tagline && <Text style={[bpS.heroTagline, { fontFamily: T.font.sans }]} numberOfLines={1}>{tagline}</Text>}
          </View>
        </View>
        <View style={bpS.loginCard}>
          <View style={[bpS.loginAccent, { backgroundColor: safePrimary }]} />
          <Text style={[bpS.loginTitle, { fontFamily: ff || T.font.display }]}>Connectez-vous</Text>
          <View style={bpS.loginField} /><View style={bpS.loginField} />
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
  logoOuter:    { width: 36, height: 36, borderRadius: 10, backgroundColor: T.white, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  logoImg:      { width: 32, height: 32, borderRadius: 8 },
  heroName:     { color: T.white, fontSize: 13, fontWeight: "700" },
  heroTagline:  { color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "500" },
  loginCard:    { padding: 12 },
  loginAccent:  { height: 3, borderRadius: 99, marginBottom: 8 },
  loginTitle:   { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 8 },
  loginField:   { height: 10, backgroundColor: T.borderLt, borderRadius: 6, marginBottom: 6 },
  loginBtn:     { borderRadius: 8, paddingVertical: 7, alignItems: "center", marginTop: 4 },
  loginBtnTxt:  { color: T.white, fontSize: 9, fontWeight: "900" },
});

// ─── Séparateur de section ────────────────────────────────
function Divider({ label }: { label?: string }) {
  if (!label) return <View style={{ height: 1, backgroundColor: T.borderLt, marginVertical: 14 }} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: T.borderLt }} />
      <Text style={{ fontSize: 9, color: T.inkMuted, fontWeight: "700", letterSpacing: 1 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: T.borderLt }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────
export default function CreateCompanyModal({ visible, onClose, onSuccess, isSuperAdmin }: Props) {
  const [creating, setCreating] = useState(false);

  // ── Société ──
  const [companyName,    setCompanyName]    = useState("");
  const [companyCode,    setCompanyCode]    = useState("");
  const [adminEmail,     setAdminEmail]     = useState("");
  const [adminPassword,  setAdminPassword]  = useState("");
  const [activitySector, setActivitySector] = useState("");
  const [defaultCurrency,setDefaultCurrency]= useState("XOF");
  const [contractType,   setContractType]   = useState<"RENTAL" | "PURCHASE">("RENTAL");
  const [ownerCountry,   setOwnerCountry]   = useState("");

  // ── Branding ──
  const [logoUrl,        setLogoUrl]        = useState("");
  const [primaryColor,   setPrimaryColor]   = useState("#1956F0");
  const [secondaryColor, setSecondaryColor] = useState("#EEF2FF");
  const [tagline,        setTagline]        = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [splashBgColor,  setSplashBgColor]  = useState("#064E3B");
  const [fontFamily,     setFontFamily]     = useState("Georgia");

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
  const [addrNumber,     setAddrNumber]     = useState("");
  const [addrLabel,      setAddrLabel]      = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCity,       setAddrCity]       = useState("");
  const [addrCountry,    setAddrCountry]    = useState("");

  const resetForm = useCallback(() => {
    setCompanyName(""); setAdminEmail(""); setContractType("RENTAL");
    setActivitySector(""); setOwnerCountry(""); setDefaultCurrency("XOF");
    setLogoUrl(""); setPrimaryColor("#1956F0"); setSecondaryColor("#EEF2FF");
    setTagline(""); setWelcomeMessage(""); setSplashBgColor("#064E3B"); setFontFamily("Georgia");
    setManagerFirstName(""); setManagerLastName(""); setManagerPhone("");
    setGender("M"); setNationality(""); setBirthDate(""); setBirthCity(""); setBirthCountry("");
    setAddrNumber(""); setAddrLabel(""); setAddrPostalCode(""); setAddrCity(""); setAddrCountry("");
    setCompanyCode(generateTenantCode7());
    setAdminPassword(generateTempPassword6());
  }, []);

  useEffect(() => { if (visible) resetForm(); }, [visible, resetForm]);

  // Options pour listes
  const countryOptions = countriesList.map(c => ({
    value: c.name,
    label: c.name,
    sub:   `${c.flag} ${c.currency}`,
    left:  <Text style={{ fontSize: 16 }}>{c.flag}</Text>,
  }));

  const cityOptions = (country: string) => {
    const cities = citiesByCountry[country] ?? [];
    return cities.map(city => ({ value: city, label: city }));
  };

  const currencyOptions = CURRENCIES.map(c => ({
    value: c.code,
    label: c.label,
    sub:   `${c.symbol} · ${c.code}`,
    left:  <Text style={{ fontSize: 16 }}>{c.flag}</Text>,
  }));

  const sectorOptions = ACTIVITY_SECTORS.map(s => ({ value: s, label: s }));

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

    const name  = companyName.trim();
    const code  = normalizeUpperAlnum(companyCode).slice(0, 7);
    const email = adminEmail.trim().toLowerCase();

    if (!name || !email) return showAlert("Champs manquants", "Nom d'entreprise et email obligatoires.");
    if (!isEmailLike(email)) return showAlert("Email invalide", "Vérifiez l'email administrateur.");
    if (!managerFirstName.trim() || !managerLastName.trim())
      return showAlert("Champs manquants", "Prénom et nom du gérant obligatoires.");
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor))
      return showAlert("Couleur invalide", "La couleur primaire doit être au format #RRGGBB.");

    setCreating(true);
    try {
      const fullAddress = [addrNumber, addrLabel, addrPostalCode, addrCity, addrCountry]
        .map(s => s.trim()).filter(Boolean).join(", ");

      await api.createClient({
        name,
        code,
        adminEmail:      email,
        adminPassword,
        subscriptionType: contractType,
        activitySector:  activitySector.trim() || undefined,
        defaultCurrency: defaultCurrency || undefined,
        adminFirstName:  managerFirstName.trim(),
        adminLastName:   managerLastName.trim(),
        contactEmail:    email,
        contactPhone:    managerPhone.trim() || undefined,
        ownerFirstName:  managerFirstName.trim(),
        ownerLastName:   managerLastName.trim(),
        ownerBirthDate:  birthDate.trim()    || undefined,
        ownerBirthPlace: birthCity.trim()    || undefined,
        ownerCountry:    nationality.trim() || ownerCountry.trim() || undefined,
        ownerAddress:    fullAddress         || undefined,
        logoUrl:         logoUrl.trim()      || undefined,
        primaryColor:    primaryColor        || undefined,
        secondaryColor:  secondaryColor      || undefined,
        tagline:         tagline.trim()      || undefined,
        welcomeMessage:  welcomeMessage.trim()|| undefined,
        splashBgColor:   splashBgColor       || undefined,
        fontFamily:      fontFamily          || undefined,
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
            <LinearGradient
              colors={[T.blue, T.blueDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.header}
            >
              <View style={s.headerDeco} />
              <View style={s.headerIconBox}>
                <Ionicons name="business" size={22} color={T.white} />
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nouvelle Société</Text>
                <Text style={[s.headerSub,   { fontFamily: T.font.sans   }]}>
                  Code · MDP · Wallets créés automatiquement
                </Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={onClose} disabled={creating}>
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >

              {/* ══ 1. SOCIÉTÉ ══ */}
              <View style={s.card}>
                <SectionHeader icon="business-outline" title="Informations Société" color={T.blue} badge="01" />

                <Field
                  label="Nom de l'entreprise" value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex: Flash Transfert International"
                  required editable={!creating} accent={T.blue}
                />

                <EditableCodeRow
                  label="Code Société (auto · éditable)"
                  value={companyCode}
                  onChange={(v) => setCompanyCode(normalizeUpperAlnum(v).slice(0, 7))}
                  onRegenerate={() => !creating && setCompanyCode(generateTenantCode7())}
                  icon="refresh"
                  accent={T.blue}
                />

                <Field
                  label="Email Administrateur" value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@societe.com"
                  keyboardType="email-address" autoCapitalize="none"
                  required editable={!creating} accent={T.blue}
                />

                <EditableCodeRow
                  label="Mot de passe provisoire (éditable)"
                  value={adminPassword}
                  onChange={setAdminPassword}
                  onRegenerate={() => !creating && setAdminPassword(generateTempPassword6())}
                  icon="key"
                  accent={T.teal}
                />

                <Divider label="PARAMÈTRES" />

                {/* Secteur d'activité — liste déroulante */}
                <SelectDropdown
                  label="Secteur d'activité"
                  value={activitySector as any}
                  options={sectorOptions}
                  onChange={(v) => setActivitySector(v)}
                  placeholder="Sélectionner un secteur…"
                  accent={T.blue}
                />

                {/* Devise par défaut */}
                <SelectDropdown
                  label="Devise par défaut"
                  value={defaultCurrency as any}
                  options={currencyOptions}
                  onChange={(v) => setDefaultCurrency(v)}
                  placeholder="Sélectionner une devise…"
                  accent={T.amber}
                />

                {/* Pays — liste déroulante */}
                <SelectDropdown
                  label="Pays (siège social)"
                  value={ownerCountry as any}
                  options={countryOptions}
                  onChange={(v) => setOwnerCountry(v)}
                  placeholder="Sélectionner un pays…"
                  accent={T.blue}
                />

                <PillSelector
                  label="Type de contrat"
                  value={contractType}
                  onChange={(v) => setContractType(v as "RENTAL" | "PURCHASE")}
                  options={[{ k: "RENTAL", label: "Location" }, { k: "PURCHASE", label: "Achat" }]}
                  accent={T.blue}
                />
              </View>

              {/* ══ 2. BRANDING ══ */}
              <View style={s.card}>
                <SectionHeader icon="color-palette-outline" title="Branding & Identité Visuelle" color={T.purple} badge="02" />

                <BrandingPreview
                  companyName={companyName}
                  logoUrl={logoUrl}
                  primaryColor={primaryColor}
                  tagline={tagline}
                  fontFamily={fontFamily}
                />

                <LogoPicker value={logoUrl} onChange={setLogoUrl} disabled={creating} />

                <ColorPicker label="Couleur Primaire (thème principal)" value={primaryColor} onChange={setPrimaryColor} />
                <ColorPicker label="Couleur Fond Login (splash)" value={splashBgColor} onChange={setSplashBgColor} />

                {/* Police */}
                <View style={{ marginBottom: 13 }}>
                  <Text style={[{ fontSize: 10, fontWeight: "900" as const, color: T.inkMuted, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" as const }, { fontFamily: T.font.sans }]}>
                    POLICE D'ÉCRITURE
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {FONT_OPTIONS.map((f) => {
                      const isActive = fontFamily === f.value;
                      return (
                        <TouchableOpacity
                          key={f.value}
                          style={[{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: T.radius.md, backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border },
                            isActive && { backgroundColor: T.purpleLt, borderColor: T.purple + "50" }]}
                          onPress={() => setFontFamily(f.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontFamily: f.value, fontSize: 14, fontWeight: "700" as const, color: isActive ? T.purple : T.inkSub }}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <Field label="Tagline (sous le nom)" value={tagline} onChangeText={setTagline}
                  placeholder="Ex: Transferts rapides et sécurisés" editable={!creating} accent={T.purple} />
                <Field label="Message d'accueil (page login)" value={welcomeMessage} onChangeText={setWelcomeMessage}
                  placeholder="Ex: Bienvenue sur votre espace de transfert" multiline editable={!creating} accent={T.purple} />
              </View>

              {/* ══ 3. GÉRANT ══ */}
              <View style={s.card}>
                <SectionHeader icon="person-outline" title="Informations Gérant" color={T.amber} badge="03" />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="Prénom" value={managerFirstName} onChangeText={setManagerFirstName}
                      placeholder="Alpha" required editable={!creating} accent={T.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Nom" value={managerLastName} onChangeText={setManagerLastName}
                      placeholder="DIALLO" required editable={!creating} accent={T.amber} />
                  </View>
                </View>

                <Field label="Téléphone" value={managerPhone}
                  onChangeText={(v) => setManagerPhone(onlyDigits(v))}
                  placeholder="+224 620 000 000" keyboardType="phone-pad"
                  editable={!creating} accent={T.amber} />

                <PillSelector label="Genre" value={gender} onChange={(v) => setGender(v as "M" | "F")}
                  options={[{ k: "M", label: "Homme" }, { k: "F", label: "Femme" }]} accent={T.amber} />

                {/* Nationalité — liste pays */}
                <SelectDropdown
                  label="Nationalité"
                  value={nationality as any}
                  options={countryOptions}
                  onChange={(v) => setNationality(v)}
                  placeholder="Sélectionner…"
                  accent={T.amber}
                />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Field label="Date naissance" value={birthDate} onChangeText={setBirthDate}
                      placeholder="JJ/MM/AAAA" editable={!creating} accent={T.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Lieu naissance" value={birthCity} onChangeText={setBirthCity}
                      placeholder="Conakry" editable={!creating} accent={T.amber} />
                  </View>
                </View>

                {/* Pays de naissance — liste */}
                <SelectDropdown
                  label="Pays de naissance"
                  value={birthCountry as any}
                  options={countryOptions}
                  onChange={(v) => setBirthCountry(v)}
                  placeholder="Sélectionner…"
                  accent={T.amber}
                />
              </View>

              {/* ══ 4. ADRESSE ══ */}
              <View style={s.card}>
                <SectionHeader icon="location-outline" title="Adresse Société" color={T.green} badge="04" />

                <View style={s.row2}>
                  <View style={{ flex: 0.4 }}>
                    <Field label="N°" value={addrNumber} onChangeText={setAddrNumber}
                      placeholder="12" editable={!creating} accent={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Libellé voie" value={addrLabel} onChangeText={setAddrLabel}
                      placeholder="Rue des Fleurs" editable={!creating} accent={T.green} />
                  </View>
                </View>

                {/* Pays adresse */}
                <SelectDropdown
                  label="Pays"
                  value={addrCountry as any}
                  options={countryOptions}
                  onChange={(v) => { setAddrCountry(v); setAddrCity(""); }}
                  placeholder="Sélectionner un pays…"
                  accent={T.green}
                />

                {/* Ville adresse — filtrée par pays */}
                {addrCountry ? (
                  cityOptions(addrCountry).length > 0 ? (
                    <SelectDropdown
                      label="Ville"
                      value={addrCity as any}
                      options={cityOptions(addrCountry)}
                      onChange={(v) => setAddrCity(v)}
                      placeholder="Sélectionner une ville…"
                      accent={T.green}
                    />
                  ) : (
                    <Field label="Ville" value={addrCity} onChangeText={setAddrCity}
                      placeholder="Ex: Paris" editable={!creating} accent={T.green} />
                  )
                ) : (
                  <Field label="Ville" value={addrCity} onChangeText={setAddrCity}
                    placeholder="Ex: Paris" editable={!creating} accent={T.green} />
                )}

                <View style={s.row2}>
                  <View style={{ flex: 0.45 }}>
                    <Field label="Code postal" value={addrPostalCode}
                      onChangeText={(v) => setAddrPostalCode(v.trim())}
                      placeholder="75001" editable={!creating} accent={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {/* Champ ville libre si aucune liste */}
                    <Field label="Complément" value={addrLabel}
                      onChangeText={setAddrLabel}
                      placeholder="Apt, étage…" editable={!creating} accent={T.green} />
                  </View>
                </View>
              </View>

              {/* ══ CTA ══ */}
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
                      <View style={s.primaryIconBox}>
                        <Ionicons name="checkmark" size={14} color={T.blue} />
                      </View>
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

              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(9,18,48,0.55)", justifyContent: "flex-end" },
  sheet:    {
    backgroundColor: T.pageBg,
    borderTopLeftRadius: T.radius.xxl, borderTopRightRadius: T.radius.xxl,
    maxHeight: "94%", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
  },
  handle:   { width: 40, height: 4, borderRadius: 99, backgroundColor: T.borderMd, alignSelf: "center", marginTop: 12, marginBottom: 4 },

  // Header gradient
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, overflow: "hidden" },
  headerDeco:   { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.06)", top: -80, right: -40 },
  headerIconBox:{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  headerTitle:  { color: T.white, fontSize: 18, fontWeight: "800" },
  headerSub:    { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },

  content:  { padding: 16 },
  card:     {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#1240D6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  row2:     { flexDirection: "row", gap: 12 },

  primaryBtn:     { borderRadius: T.radius.lg, overflow: "hidden", marginTop: 8 },
  primaryGrad:    { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 12 },
  primaryIconBox: { width: 26, height: 26, borderRadius: 8, backgroundColor: T.white, justifyContent: "center", alignItems: "center" },
  primaryTxt:     { color: T.white, fontWeight: "900", fontSize: 15, letterSpacing: 0.8 },

  cancelBtn: { alignItems: "center", paddingVertical: 18, marginTop: 2 },
  cancelTxt: { color: T.inkSub, fontWeight: "700", fontSize: 14 },
});