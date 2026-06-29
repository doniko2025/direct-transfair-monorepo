// apps/direct-transfair-mobile/app/(auth)/register.tsx
// =========================================================
// REGISTER v6.1 — Direct Transf'air
// ✅ v6.0 conservé intégralement (wizard carousel 10 étapes)
// ✅ v6.1 : FIX outline bleu navigateur sur web
//   AVANT : outlineStyle passé en prop spread → ignoré par RN Web
//   APRÈS : NO_OUTLINE dans style[] → CSS inline prioritaire
//   Supprime l'outline natif sur TOUS les TextInput du fichier
// =========================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, StatusBar, Modal, Dimensions,
  FlatList, Keyboard, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { useTenant } from "../../providers/TenantProvider";

const { width: SW } = Dimensions.get("window");
const TOTAL_STEPS   = 10;

// ─── Fix outline bleu navigateur (web uniquement) ────────
// ✅ v6.1 : doit être dans style[], pas en prop spread
const NO_OUTLINE: any = Platform.OS === "web"
  ? { outlineStyle: "none", outlineWidth: 0 }
  : {};

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg:         "#FFFFFF",
  pageBg:     "#F8FAFF",
  ink:        "#0F172A",
  inkSub:     "#475569",
  inkMuted:   "#94A3B8",
  border:     "#E2E8F0",
  borderFocus:"#2563EB",
  blue:       "#2563EB",
  blueDeep:   "#1D4ED8",
  blueLt:     "#EFF6FF",
  blueMd:     "#BFDBFE",
  green:      "#059669",
  greenLt:    "#ECFDF5",
  red:        "#EF4444",
  redLt:      "#FEE2E2",
  white:      "#FFFFFF",
  r: { sm: 10, md: 14, lg: 18, xl: 24 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"     }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace"  }),
  },
};

// ─── Drapeaux ─────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  "Afghanistan":"🇦🇫","Algérie":"🇩🇿","Allemagne":"🇩🇪","Angola":"🇦🇴",
  "Arabie Saoudite":"🇸🇦","Argentine":"🇦🇷","Belgique":"🇧🇪","Bénin":"🇧🇯",
  "Brésil":"🇧🇷","Burkina Faso":"🇧🇫","Cameroun":"🇨🇲","Canada":"🇨🇦",
  "Cap-Vert":"🇨🇻","Centrafrique":"🇨🇫","Chine":"🇨🇳","Comores":"🇰🇲",
  "Congo":"🇨🇬","Côte d'Ivoire":"🇨🇮","Djibouti":"🇩🇯","Égypte":"🇪🇬",
  "Espagne":"🇪🇸","États-Unis":"🇺🇸","Éthiopie":"🇪🇹","France":"🇫🇷",
  "Gabon":"🇬🇦","Gambie":"🇬🇲","Ghana":"🇬🇭","Guinée":"🇬🇳",
  "Guinée Bissau":"🇬🇼","Guinée Équatoriale":"🇬🇶","Italie":"🇮🇹",
  "Japon":"🇯🇵","Kenya":"🇰🇪","Liberia":"🇱🇷","Libye":"🇱🇾",
  "Madagascar":"🇲🇬","Mali":"🇲🇱","Maroc":"🇲🇦","Mauritanie":"🇲🇷",
  "Mozambique":"🇲🇿","Namibie":"🇳🇦","Niger":"🇳🇪","Nigéria":"🇳🇬",
  "Oman":"🇴🇲","Pays-Bas":"🇳🇱","Portugal":"🇵🇹","Qatar":"🇶🇦",
  "République Démocratique du Congo":"🇨🇩","Royaume-Uni":"🇬🇧",
  "Rwanda":"🇷🇼","Sénégal":"🇸🇳","Sierra Leone":"🇸🇱","Somalie":"🇸🇴",
  "Soudan":"🇸🇩","Suisse":"🇨🇭","Tanzanie":"🇹🇿","Tchad":"🇹🇩",
  "Togo":"🇹🇬","Tunisie":"🇹🇳","Turquie":"🇹🇷","Uganda":"🇺🇬",
  "Zimbabwe":"🇿🇼",
};

// ─── Pays ─────────────────────────────────────────────────
const COUNTRIES = [
  "Afghanistan","Algérie","Allemagne","Angola","Arabie Saoudite","Argentine",
  "Belgique","Bénin","Brésil","Burkina Faso","Cameroun","Canada","Cap-Vert",
  "Centrafrique","Chine","Comores","Congo","Côte d'Ivoire","Djibouti","Égypte",
  "Espagne","États-Unis","Éthiopie","France","Gabon","Gambie","Ghana","Guinée",
  "Guinée Bissau","Guinée Équatoriale","Italie","Japon","Kenya","Liberia","Libye",
  "Madagascar","Mali","Maroc","Mauritanie","Mozambique","Namibie","Niger","Nigéria",
  "Oman","Pays-Bas","Portugal","Qatar","République Démocratique du Congo",
  "Royaume-Uni","Rwanda","Sénégal","Sierra Leone","Somalie","Soudan","Suisse",
  "Tanzanie","Tchad","Togo","Tunisie","Turquie","Uganda","Zimbabwe",
].sort();

const COUNTRY_CODES: Record<string, string> = {
  "Guinée":"+224","France":"+33","Sénégal":"+221","Mali":"+223",
  "Côte d'Ivoire":"+225","Cameroun":"+237","Bénin":"+229",
  "Burkina Faso":"+226","Togo":"+228","Niger":"+227","Nigéria":"+234",
  "Ghana":"+233","Sierra Leone":"+232","Liberia":"+231","Gambie":"+220",
  "Guinée Bissau":"+245","Cap-Vert":"+238","États-Unis":"+1","Canada":"+1",
  "Belgique":"+32","Royaume-Uni":"+44","Espagne":"+34","Italie":"+39",
  "Portugal":"+351","Allemagne":"+49","Maroc":"+212","Algérie":"+213",
  "Tunisie":"+216","Pays-Bas":"+31","Suisse":"+41","Brésil":"+55",
};

// ─── Config étapes ────────────────────────────────────────
const STEPS = [
  { icon: "person-outline",           question: "Comment vous\nappellez-vous ?",  hint: "Votre prénom, tel que vous souhaitez être appelé(e)"        },
  { icon: "person-circle-outline",    question: "Et votre nom\nde famille ?",      hint: "Tel qu'il apparaît sur vos documents officiels"              },
  { icon: "mail-outline",             question: "Votre adresse\nemail ?",          hint: "Pour vous connecter et recevoir vos confirmations"           },
  { icon: "lock-closed-outline",      question: "Créez votre\nmot de passe",       hint: "Minimum 6 caractères — plus c'est long, plus c'est sûr"     },
  { icon: "phone-portrait-outline",   question: "Votre numéro\nde téléphone ?",    hint: "Pour sécuriser votre compte avec la vérification en 2 étapes"},
  { icon: "location-outline",         question: "Où habitez-vous ?",               hint: "Votre pays de résidence actuel"                              },
  { icon: "business-outline",         question: "Dans quelle\nville ?",            hint: "Votre ville de résidence principale"                         },
  { icon: "calendar-outline",         question: "Votre date de\nnaissance ?",      hint: "Utilisée pour vérifier votre identité selon la réglementation"},
  { icon: "flag-outline",             question: "Votre\nnationalité ?",            hint: "Telle qu'indiquée sur votre passeport ou carte d'identité"   },
  { icon: "checkmark-circle-outline", question: "Presque prêt !",                  hint: "Acceptez nos conditions pour finaliser votre inscription"    },
] as const;

const REAL_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 500]);

// =========================================================
// ── COMPOSANTS ────────────────────────────────────────────
// =========================================================

// ─── StepInput ────────────────────────────────────────────
function StepInput({
  value, onChangeText, placeholder, label, icon,
  secureTextEntry, keyboardType, autoCapitalize, autoFocus,
  onSubmitEditing, returnKeyType, inputRef,
}: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  label?: string; icon?: string; secureTextEntry?: boolean; keyboardType?: any;
  autoCapitalize?: any; autoFocus?: boolean; onSubmitEditing?: () => void;
  returnKeyType?: any; inputRef?: React.RefObject<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);

  return (
    <View style={si.wrap}>
      {label && (
        <Text style={[si.label, { fontFamily: T.font.sans }]}>{label}</Text>
      )}
      <View style={[si.card, focused && si.cardFocused]}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={20}
            color={focused ? T.blue : T.inkMuted}
            style={{ marginRight: 12 }}
          />
        )}
        <TextInput
          ref={inputRef}
          style={[si.input, { fontFamily: T.font.sans }, NO_OUTLINE]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "words"}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType ?? "done"}
          underlineColorAndroid="transparent"
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow(!show)} hitSlop={8}>
            <Ionicons
              name={show ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={T.inkMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const si = StyleSheet.create({
  wrap:        { marginBottom: 8 },
  label:       { fontSize: 11, fontWeight: "700", color: T.inkSub, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  card:        { flexDirection: "row", alignItems: "center", backgroundColor: T.white, borderRadius: T.r.md, borderWidth: 1.5, borderColor: T.border, paddingHorizontal: 16, paddingVertical: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardFocused: { borderColor: T.borderFocus, shadowColor: T.blue, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 },
  input:       { flex: 1, fontSize: 17, color: T.ink, fontWeight: "600" },
});

// ─── PasswordStep ─────────────────────────────────────────
function PasswordStep({ password, confirmPassword, onChangePassword, onChangeConfirm }: {
  password: string; confirmPassword: string;
  onChangePassword: (v: string) => void; onChangeConfirm: (v: string) => void;
}) {
  const strength = password.length === 0 ? null
    : password.length < 6  ? "weak"
    : password.length < 10 ? "medium"
    : "strong";
  const strColor = strength === "weak" ? T.red : strength === "medium" ? "#F59E0B" : T.green;
  const strLabel = strength === "weak" ? "Trop court" : strength === "medium" ? "Acceptable" : "Fort ✓";
  const match    = confirmPassword.length > 0 && password === confirmPassword;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <View>
      <StepInput
        value={password}
        onChangeText={onChangePassword}
        placeholder="••••••••"
        label="MOT DE PASSE"
        icon="lock-closed-outline"
        secureTextEntry
        autoFocus
        returnKeyType="next"
      />
      {strength && (
        <View style={pw.strengthRow}>
          <View style={pw.track}>
            <View style={[pw.fill, {
              width: strength === "weak" ? "30%" : strength === "medium" ? "65%" : "100%",
              backgroundColor: strColor,
            }]} />
          </View>
          <Text style={[pw.label, { color: strColor, fontFamily: T.font.sans }]}>
            {strLabel}
          </Text>
        </View>
      )}
      <StepInput
        value={confirmPassword}
        onChangeText={onChangeConfirm}
        placeholder="Répétez votre mot de passe"
        label="CONFIRMER LE MOT DE PASSE"
        icon={match ? "checkmark-circle-outline" : "lock-closed-outline"}
        secureTextEntry
        returnKeyType="done"
      />
      {mismatch && (
        <View style={pw.errorRow}>
          <Ionicons name="alert-circle" size={14} color={T.red} />
          <Text style={[pw.errorTxt, { fontFamily: T.font.sans }]}>
            Les mots de passe ne correspondent pas
          </Text>
        </View>
      )}
    </View>
  );
}
const pw = StyleSheet.create({
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 6 },
  track:       { flex: 1, height: 4, backgroundColor: T.border, borderRadius: 99, overflow: "hidden" },
  fill:        { height: 4, borderRadius: 99 },
  label:       { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, minWidth: 60 },
  errorRow:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.redLt, borderRadius: 10, padding: 10, marginTop: 6 },
  errorTxt:    { fontSize: 12, color: T.red, fontWeight: "600" },
});

// ─── PhoneStep ────────────────────────────────────────────
function PhoneStep({
  phone, phoneCode, onChangePhone, onPressCode,
}: {
  phone: string; phoneCode: string; onChangePhone: (v: string) => void; onPressCode: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={[{ fontSize: 11, fontWeight: "700", color: T.inkSub, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" as const, fontFamily: T.font.sans }]}>
        NUMÉRO DE TÉLÉPHONE
      </Text>
      <View style={[ph.card, focused && ph.cardFocused]}>
        <TouchableOpacity style={ph.codeBtn} onPress={onPressCode}>
          <Text style={[ph.codeFlag, { fontFamily: T.font.mono }]}>{phoneCode}</Text>
          <Ionicons name="chevron-down" size={14} color={T.inkMuted} />
        </TouchableOpacity>
        <View style={ph.sep} />
        <TextInput
          style={[ph.input, { fontFamily: T.font.sans }, NO_OUTLINE]}
          value={phone}
          onChangeText={onChangePhone}
          placeholder="6 12 34 56 78"
          placeholderTextColor={T.inkMuted}
          keyboardType="phone-pad"
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
        />
      </View>
    </View>
  );
}
const ph = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", backgroundColor: T.white, borderRadius: T.r.md, borderWidth: 1.5, borderColor: T.border, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardFocused:{ borderColor: T.borderFocus, shadowColor: T.blue, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 },
  codeBtn:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: T.pageBg, paddingHorizontal: 14, paddingVertical: 17, borderRightWidth: 1.5, borderRightColor: T.border },
  codeFlag:   { fontSize: 15, fontWeight: "700", color: T.ink },
  sep:        { width: 0 },
  input:      { flex: 1, fontSize: 17, color: T.ink, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 16 },
});

// ─── CountryCard (style Image 2) ─────────────────────────
function CountryCard({ label, country, onPress }: {
  label: string; country: string; onPress: () => void;
}) {
  const flag = FLAG_MAP[country] ?? "🌍";
  return (
    <TouchableOpacity style={cc.card} onPress={onPress} activeOpacity={0.7}>
      <View style={cc.flagCircle}>
        <Text style={{ fontSize: 26 }}>{flag}</Text>
      </View>
      <View style={cc.info}>
        <Text style={[cc.cardLabel, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[cc.cardValue, { fontFamily: T.font.sans }]}>
          {country || "Sélectionner…"}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={20} color={T.inkMuted} />
    </TouchableOpacity>
  );
}
const cc = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: T.r.md, padding: 16, gap: 14 },
  flagCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  info:       { flex: 1 },
  cardLabel:  { fontSize: 11, fontWeight: "700", color: T.inkMuted, letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" },
  cardValue:  { fontSize: 17, fontWeight: "700", color: T.ink },
});

// ─── DateStep ─────────────────────────────────────────────
function DateStep({ birthDay, birthMonth, birthYear, onDay, onMonth, onYear }: {
  birthDay: string; birthMonth: string; birthYear: string;
  onDay: (v: string) => void; onMonth: (v: string) => void; onYear: (v: string) => void;
}) {
  const monthRef = useRef<TextInput>(null);
  const yearRef  = useRef<TextInput>(null);

  const handleDay = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    onDay(clean);
    if (clean.length === 2) monthRef.current?.focus();
  };
  const handleMonth = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    onMonth(clean);
    if (clean.length === 2) yearRef.current?.focus();
  };
  const handleYear = (v: string) => {
    onYear(v.replace(/\D/g, "").slice(0, 4));
  };

  return (
    <View>
      <Text style={[{
        fontSize: 11, fontWeight: "700", color: T.inkSub, marginBottom: 12,
        letterSpacing: 0.5, textTransform: "uppercase" as const, fontFamily: T.font.sans,
      }]}>
        DATE DE NAISSANCE
      </Text>
      <View style={dt.row}>
        <View style={dt.boxWrap}>
          <Text style={[dt.boxLabel, { fontFamily: T.font.sans }]}>Jour</Text>
          <TextInput
            style={[dt.box, { fontFamily: T.font.mono }, birthDay.length > 0 && dt.boxFilled, NO_OUTLINE]}
            value={birthDay}
            onChangeText={handleDay}
            placeholder="JJ"
            placeholderTextColor={T.inkMuted}
            keyboardType="numeric"
            maxLength={2}
            textAlign="center"
            autoFocus
            underlineColorAndroid="transparent"
          />
        </View>
        <Text style={dt.sep}>/</Text>
        <View style={dt.boxWrap}>
          <Text style={[dt.boxLabel, { fontFamily: T.font.sans }]}>Mois</Text>
          <TextInput
            ref={monthRef}
            style={[dt.box, { fontFamily: T.font.mono }, birthMonth.length > 0 && dt.boxFilled, NO_OUTLINE]}
            value={birthMonth}
            onChangeText={handleMonth}
            placeholder="MM"
            placeholderTextColor={T.inkMuted}
            keyboardType="numeric"
            maxLength={2}
            textAlign="center"
            underlineColorAndroid="transparent"
          />
        </View>
        <Text style={dt.sep}>/</Text>
        <View style={[dt.boxWrap, { flex: 1.6 }]}>
          <Text style={[dt.boxLabel, { fontFamily: T.font.sans }]}>Année</Text>
          <TextInput
            ref={yearRef}
            style={[dt.box, { fontFamily: T.font.mono }, birthYear.length > 0 && dt.boxFilled, NO_OUTLINE]}
            value={birthYear}
            onChangeText={handleYear}
            placeholder="AAAA"
            placeholderTextColor={T.inkMuted}
            keyboardType="numeric"
            maxLength={4}
            textAlign="center"
            underlineColorAndroid="transparent"
          />
        </View>
      </View>
    </View>
  );
}
const dt = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  boxWrap:  { flex: 1, alignItems: "center" },
  boxLabel: { fontSize: 9, fontWeight: "700", color: T.inkMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  box:      { width: "100%", backgroundColor: T.white, borderRadius: T.r.md, borderWidth: 1.5, borderColor: T.border, paddingVertical: 16, fontSize: 20, fontWeight: "700", color: T.ink },
  boxFilled:{ borderColor: T.blue, backgroundColor: T.blueLt },
  sep:      { fontSize: 22, color: T.inkMuted, fontWeight: "600", paddingBottom: 14 },
});

// ─── TermsStep ────────────────────────────────────────────
function TermsStep({
  accepted, onToggle, onTerms, onPrivacy,
}: {
  accepted: boolean; onToggle: () => void; onTerms: () => void; onPrivacy: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ts.card, accepted && ts.cardActive]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={[ts.checkbox, accepted && ts.checkboxActive]}>
        {accepted && <Ionicons name="checkmark" size={14} color={T.white} />}
      </View>
      <Text style={[ts.txt, { fontFamily: T.font.sans }]}>
        {"J'ai lu et j'accepte les "}
        <Text style={ts.link} onPress={onTerms}>
          Conditions générales d'utilisation
        </Text>
        {" et la "}
        <Text style={ts.link} onPress={onPrivacy}>
          Politique de confidentialité
        </Text>
        {" de Direct Transf'air."}
      </Text>
    </TouchableOpacity>
  );
}
const ts = StyleSheet.create({
  card:          { flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: T.white, borderRadius: T.r.md, borderWidth: 1.5, borderColor: T.border, padding: 16 },
  cardActive:    { borderColor: T.blue, backgroundColor: T.blueLt },
  checkbox:      { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1 },
  checkboxActive:{ backgroundColor: T.blue, borderColor: T.blue },
  txt:           { flex: 1, fontSize: 14, color: T.inkSub, lineHeight: 22, fontWeight: "500" },
  link:          { color: T.blue, fontWeight: "700", textDecorationLine: "underline" },
});

// ─── CountryPickerModal ───────────────────────────────────
function CountryPickerModal({
  visible, onClose, onSelect, title,
}: {
  visible: boolean; onClose: () => void; onSelect: (c: string) => void; title: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  const handleSelect = (c: string) => {
    onSelect(c);
    setSearch("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={cpm.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={T.white} />

        <View style={cpm.headerRow}>
          <TouchableOpacity
            style={cpm.closeBtn}
            onPress={() => { setSearch(""); onClose(); }}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color={T.ink} />
          </TouchableOpacity>
        </View>

        <Text style={[cpm.title, { fontFamily: T.font.serif }]}>{title}</Text>

        <View style={cpm.searchBar}>
          <Ionicons name="search" size={18} color={T.inkMuted} />
          <TextInput
            style={[cpm.searchInput, { fontFamily: T.font.sans }, NO_OUTLINE]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un pays…"
            placeholderTextColor={T.inkMuted}
            autoCorrect={false}
            autoCapitalize="none"
            underlineColorAndroid="transparent"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={T.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={cpm.item}
              onPress={() => handleSelect(item)}
              activeOpacity={0.65}
            >
              <View style={cpm.flagCircle}>
                <Text style={{ fontSize: 24 }}>{FLAG_MAP[item] ?? "🌍"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cpm.itemName, { fontFamily: T.font.sans }]}>{item}</Text>
                {COUNTRY_CODES[item] && (
                  <Text style={[cpm.itemCode, { fontFamily: T.font.mono }]}>
                    {COUNTRY_CODES[item]}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.inkMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={cpm.empty}>
              <Ionicons name="search-outline" size={32} color={T.inkMuted} />
              <Text style={[cpm.emptyTxt, { fontFamily: T.font.sans }]}>
                Aucun pays trouvé
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </SafeAreaView>
    </Modal>
  );
}
const cpm = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: T.white },
  headerRow:  { paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 16 : 12 },
  closeBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 26, fontWeight: "700", color: T.ink, paddingHorizontal: 20, marginTop: 16, marginBottom: 20 },
  searchBar:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F1F5F9", borderRadius: T.r.md, paddingHorizontal: 16, height: 52, marginHorizontal: 20, marginBottom: 8 },
  searchInput:{ flex: 1, fontSize: 16, color: T.ink, fontWeight: "500" },
  item:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 14 },
  flagCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F8FAFF", borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  itemName:   { fontSize: 15, fontWeight: "600", color: T.ink },
  itemCode:   { fontSize: 12, color: T.inkMuted, marginTop: 2 },
  empty:      { alignItems: "center", paddingTop: 48, gap: 12 },
  emptyTxt:   { fontSize: 14, color: T.inkMuted, fontWeight: "600" },
});

// ─── SuccessModal ─────────────────────────────────────────
function SuccessModal({
  visible, onContinue, hasPhone,
}: {
  visible: boolean; onContinue: () => void; hasPhone: boolean;
}) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.8);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={sm.overlay}>
        <Animated.View style={[sm.card, { opacity, transform: [{ scale }] }]}>
          <View style={sm.iconOuter}>
            <View style={sm.iconInner}>
              <Ionicons name="checkmark" size={36} color={T.white} />
            </View>
          </View>
          <Text style={[sm.title, { fontFamily: T.font.serif }]}>Compte créé !</Text>
          <Text style={[sm.sub, { fontFamily: T.font.sans }]}>
            Bienvenue sur Direct Transf'air.{"\n"}
            Un code de vérification a été envoyé à votre adresse email.
            {hasPhone ? "\nVérifiez aussi votre téléphone." : ""}
          </Text>
          <View style={sm.badge}>
            <Ionicons name="mail-outline" size={14} color={T.green} />
            <Text style={[sm.badgeTxt, { fontFamily: T.font.sans }]}>
              Vérification requise avant de vous connecter
            </Text>
          </View>
          <View style={sm.divider} />
          <TouchableOpacity style={sm.btn} onPress={onContinue} activeOpacity={0.88}>
            <Ionicons name="mail-outline" size={16} color={T.white} />
            <Text style={[sm.btnTxt, { fontFamily: T.font.sans }]}>Vérifier mon email</Text>
            <Ionicons name="arrow-forward" size={16} color={T.white} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
const sm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(15,23,42,0.7)", justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  card:      { backgroundColor: T.white, borderRadius: 28, padding: 32, width: "100%", maxWidth: 380, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, elevation: 16 },
  iconOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: T.greenLt, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  iconInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.green, justifyContent: "center", alignItems: "center" },
  title:     { fontSize: 26, color: T.ink, marginBottom: 10, textAlign: "center" },
  sub:       { fontSize: 14, color: T.inkMuted, textAlign: "center", lineHeight: 22, fontWeight: "500", marginBottom: 16 },
  badge:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.greenLt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#A7F3D0", marginBottom: 20 },
  badgeTxt:  { fontSize: 12, color: T.green, fontWeight: "600" },
  divider:   { width: "100%", height: 1, backgroundColor: "#F1F5F9", marginBottom: 20 },
  btn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: T.blue, borderRadius: 16, paddingVertical: 16, width: "100%" },
  btnTxt:    { color: T.white, fontSize: 15, fontWeight: "700" },
});

// =========================================================
// ── ÉCRAN PRINCIPAL ───────────────────────────────────────
// =========================================================
export default function RegisterScreen() {
  const { register: registerUser } = useAuth();
  const { branding }              = useTenant();
  const router                    = useRouter();

  // ── Step state ──────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [picker, setPicker] = useState<null | "country" | "nationality">(null);
  const [registeredUser, setRegisteredUser] = useState<{ id: string; phone: string | null } | null>(null);

  // ── Champs formulaire ───────────────────────────────────
  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone,           setPhone]           = useState("");
  const [phoneCode,       setPhoneCode]       = useState("+224");
  const [country,         setCountry]         = useState("Guinée");
  const [city,            setCity]            = useState("");
  const [birthDay,        setBirthDay]        = useState("");
  const [birthMonth,      setBirthMonth]      = useState("");
  const [birthYear,       setBirthYear]       = useState("");
  const [nationality,     setNationality]     = useState("Guinée");
  const [termsAccepted,   setTermsAccepted]   = useState(false);

  // ── Animations ──────────────────────────────────────────
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // ── Validation par étape ────────────────────────────────
  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 0:  return firstName.trim().length > 0;
      case 1:  return lastName.trim().length > 0;
      case 2:  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      case 3:  return password.length >= 6 && password === confirmPassword;
      case 4:  return phone.trim().length >= 6;
      case 5:  return country.length > 0;
      case 6:  return city.trim().length > 0;
      case 7:  return birthDay.length === 2 && birthMonth.length === 2 && birthYear.length === 4;
      case 8:  return nationality.length > 0;
      case 9:  return termsAccepted;
      default: return false;
    }
  };

  // ── Navigation ──────────────────────────────────────────
  const animateToStep = (nextStep: number, direction: 1 | -1) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -direction * SW * 0.35,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(direction * SW * 0.35);
      Animated.spring(progressAnim, {
        toValue: (nextStep + 1) / TOTAL_STEPS,
        useNativeDriver: false,
        speed: 14,
        bounciness: 2,
      }).start();
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 16,
          bounciness: 2,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    if (currentStep < TOTAL_STEPS - 1) {
      animateToStep(currentStep + 1, 1);
    } else {
      void handleRegister();
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.back();
    } else {
      animateToStep(currentStep - 1, -1);
    }
  };

  // ── Inscription ─────────────────────────────────────────
  const handleRegister = async () => {
    setSubmitting(true);
    try {
      const birthDate = `${birthDay.padStart(2, "0")}/${birthMonth.padStart(2, "0")}/${birthYear}`;
      const payload = {
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        email:        email.trim().toLowerCase(),
        password,
        phone:        `${phoneCode}${phone.trim()}`,
        country,
        city:         city.trim(),
        nationality,
        birthDate,
        birthPlace:   "",
        birthCity:    "",
        birthCountry: "",
        addressStreet:"",
        postalCode:   "",
        addressCity:  city.trim(),
      };

      const result = await registerUser(payload as any);
      if (result) {
        const u = result as any;
        setRegisteredUser({ id: u.id, phone: u.phone ?? null });
      }
      setShowSuccess(true);

    } catch (e: any) {
      const status = e?.response?.status;
      if (status && REAL_ERROR_STATUSES.has(status)) {
        const raw = e?.response?.data?.message || e?.message || "Erreur inconnue.";
        Alert.alert("Inscription échouée", Array.isArray(raw) ? raw[0] : String(raw));
        return;
      }
      const isNetwork = !status || e?.message?.toLowerCase().includes("network");
      Alert.alert(
        isNetwork ? "Erreur de connexion" : "Erreur inattendue",
        isNetwork
          ? "Impossible de créer le compte. Vérifiez votre connexion internet."
          : (e?.message ?? "Une erreur est survenue. Réessayez."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    if (registeredUser) {
      router.replace({
        pathname: "/(auth)/verify-contact",
        params: {
          userId:        registeredUser.id,
          emailVerified: "0",
          phoneVerified: registeredUser.phone ? "0" : "1",
          hasPhone:      registeredUser.phone ? "1" : "0",
        },
      } as any);
    } else {
      router.replace("/(tabs)/home" as any);
    }
  };

  // ── Rendu de l'étape ────────────────────────────────────
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="ex : Alpha"
            label="PRÉNOM"
            icon="person-outline"
            autoFocus
            onSubmitEditing={isStepValid() ? handleNext : undefined}
            returnKeyType="done"
          />
        );

      case 1:
        return (
          <StepInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="ex : DIALLO"
            label="NOM DE FAMILLE"
            icon="person-circle-outline"
            autoCapitalize="characters"
            autoFocus
            onSubmitEditing={isStepValid() ? handleNext : undefined}
            returnKeyType="done"
          />
        );

      case 2:
        return (
          <StepInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            label="ADRESSE EMAIL"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            onSubmitEditing={isStepValid() ? handleNext : undefined}
            returnKeyType="done"
          />
        );

      case 3:
        return (
          <PasswordStep
            password={password}
            confirmPassword={confirmPassword}
            onChangePassword={setPassword}
            onChangeConfirm={setConfirmPassword}
          />
        );

      case 4:
        return (
          <PhoneStep
            phone={phone}
            phoneCode={phoneCode}
            onChangePhone={setPhone}
            onPressCode={() => setPicker("country")}
          />
        );

      case 5:
        return (
          <>
            <CountryCard
              label="PAYS DE RÉSIDENCE"
              country={country}
              onPress={() => setPicker("country")}
            />
            {country && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                marginTop: 14, backgroundColor: T.blueLt,
                borderRadius: T.r.sm, padding: 10,
              }}>
                <Ionicons name="information-circle-outline" size={14} color={T.blue} />
                <Text style={[{ fontSize: 12, color: T.blue, fontWeight: "600", flex: 1, fontFamily: T.font.sans }]}>
                  Indicatif téléphonique : {COUNTRY_CODES[country] ?? "+?"}
                </Text>
              </View>
            )}
          </>
        );

      case 6:
        return (
          <StepInput
            value={city}
            onChangeText={setCity}
            placeholder="ex : Conakry, Paris, Dakar…"
            label="VILLE"
            icon="business-outline"
            autoFocus
            onSubmitEditing={isStepValid() ? handleNext : undefined}
            returnKeyType="done"
          />
        );

      case 7:
        return (
          <DateStep
            birthDay={birthDay}
            birthMonth={birthMonth}
            birthYear={birthYear}
            onDay={setBirthDay}
            onMonth={setBirthMonth}
            onYear={setBirthYear}
          />
        );

      case 8:
        return (
          <CountryCard
            label="NATIONALITÉ"
            country={nationality}
            onPress={() => setPicker("nationality")}
          />
        );

      case 9:
        return (
          <>
            <View style={s.summary}>
              <View style={s.summaryRow}>
                <Ionicons name="person-outline" size={15} color={T.inkMuted} />
                <Text style={[s.summaryTxt, { fontFamily: T.font.sans }]}>
                  {firstName} {lastName}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Ionicons name="mail-outline" size={15} color={T.inkMuted} />
                <Text style={[s.summaryTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>
                  {email}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Ionicons name="location-outline" size={15} color={T.inkMuted} />
                <Text style={[s.summaryTxt, { fontFamily: T.font.sans }]}>
                  {FLAG_MAP[country] ?? "🌍"} {city}, {country}
                </Text>
              </View>
            </View>
            <View style={{ height: 16 }} />
            <TermsStep
              accepted={termsAccepted}
              onToggle={() => setTermsAccepted(!termsAccepted)}
              onTerms={() => router.push("/(auth)/terms")}
              onPrivacy={() => router.push("/(auth)/privacy-policy")}
            />
          </>
        );

      default:
        return null;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  const isLast  = currentStep === TOTAL_STEPS - 1;
  const canNext = isStepValid();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.white} />

      {/* ── Header : back + barre de progression ── */}
      <SafeAreaView style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={handleBack} hitSlop={14}>
            <Ionicons name="arrow-back" size={22} color={T.ink} />
          </TouchableOpacity>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={[s.stepCount, { fontFamily: T.font.mono }]}>
            {currentStep + 1}/{TOTAL_STEPS}
          </Text>
        </View>
      </SafeAreaView>

      {/* ── Contenu animé ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View style={[
          s.content,
          { transform: [{ translateX: slideAnim }], opacity: opacityAnim },
        ]}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Icône de l'étape */}
            <View style={s.iconCircle}>
              <Ionicons
                name={STEPS[currentStep].icon as any}
                size={36}
                color={T.blue}
              />
            </View>

            {/* Question */}
            <Text style={[s.question, { fontFamily: T.font.serif }]}>
              {STEPS[currentStep].question}
            </Text>

            {/* Sous-texte */}
            <Text style={[s.hint, { fontFamily: T.font.sans }]}>
              {STEPS[currentStep].hint}
            </Text>

            {/* Contenu */}
            {renderStepContent()}

            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>

        {/* ── Bouton bas de page ── */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.continueBtn, !canNext && s.continueBtnOff]}
            onPress={handleNext}
            disabled={!canNext || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={T.white} />
            ) : (
              <>
                <Text style={[s.continueTxt, { fontFamily: T.font.sans }]}>
                  {isLast ? "Créer mon compte" : "Continuer"}
                </Text>
                {!isLast && (
                  <View style={s.arrowCircle}>
                    <Ionicons name="arrow-forward" size={16} color={T.blue} />
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>

          {currentStep === 0 && (
            <TouchableOpacity
              style={s.loginLink}
              onPress={() => router.replace("/(auth)/login-v2" as any)}
            >
              <Text style={[s.loginLinkTxt, { fontFamily: T.font.sans }]}>
                Déjà un compte ?{" "}
                <Text style={{ color: T.blue, fontWeight: "700" }}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Country Picker ── */}
      <CountryPickerModal
        visible={picker === "country" || picker === "nationality"}
        title={picker === "country" ? "Pays de résidence" : "Nationalité"}
        onClose={() => setPicker(null)}
        onSelect={(c) => {
          if (picker === "country") {
            setCountry(c);
            setPhoneCode(COUNTRY_CODES[c] ?? "+");
          } else if (picker === "nationality") {
            setNationality(c);
          }
          setPicker(null);
        }}
      />

      {/* ── Success Modal ── */}
      <SuccessModal
        visible={showSuccess}
        onContinue={handleSuccessContinue}
        hasPhone={!!phone.trim()}
      />
    </View>
  );
}

// ─── Styles principaux ────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.white },

  headerSafe: { backgroundColor: T.white },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 12 : 4,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.r.sm,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  progressTrack: {
    flex: 1, height: 5, backgroundColor: T.border,
    borderRadius: 99, overflow: "hidden",
  },
  progressFill: { height: 5, backgroundColor: T.blue, borderRadius: 99 },
  stepCount:    { fontSize: 12, fontWeight: "700", color: T.inkMuted, flexShrink: 0 },

  content: { flex: 1 },
  scroll:  { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    alignSelf: "center",
    marginBottom: 28, marginTop: 8,
    borderWidth: 1.5, borderColor: T.blueMd,
  },

  question: {
    fontSize: 30, fontWeight: "700", color: T.ink,
    marginBottom: 10, lineHeight: 38,
  },
  hint: {
    fontSize: 14, color: T.inkMuted, fontWeight: "500",
    lineHeight: 21, marginBottom: 28,
  },

  summary: {
    backgroundColor: "#F8FAFF", borderRadius: T.r.md,
    borderWidth: 1, borderColor: T.border, padding: 16, gap: 10,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryTxt: { fontSize: 14, fontWeight: "600", color: T.ink, flex: 1 },

  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
    backgroundColor: T.white,
    borderTopWidth: 1, borderTopColor: T.border,
    gap: 12,
  },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: T.blue, borderRadius: T.r.lg,
    paddingVertical: 18, gap: 10,
    shadowColor: T.blue, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  continueBtnOff: { backgroundColor: T.inkMuted, shadowOpacity: 0 },
  continueTxt:    { color: T.white, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  arrowCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  loginLink:    { alignItems: "center" },
  loginLinkTxt: { fontSize: 14, color: T.inkMuted, fontWeight: "500" },
});