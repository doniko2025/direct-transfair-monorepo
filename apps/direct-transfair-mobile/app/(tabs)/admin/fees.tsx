// apps/direct-transfair-mobile/app/(tabs)/admin/fees.tsx
// =========================================================
// FRAIS DE TRANSACTION v1.1 — Direct Transf'air
// ✅ v1.0 : Frais par méthode, paliers, remises partenaires
// ✅ v1.1 : 3 bugs critiques corrigés
//
//  BUG 1 — sourceType: "FEE" invalide → backend rejette → reset au refresh
//    FIX  → sourceType: "WALLET" (valeur d'enum valide), + payoutMethod + feeRate
//
//  BUG 2 — Stale closure dans load()
//    FIX  → setMethods(prev => ...) au lieu de [...methods] (élimine la dépendance)
//
//  BUG 3 — rule.platformCommission inexistant → fixedFee toujours 0
//    FIX  → rule.feeRate (nouveau champ DB) avec fallback sur rule.senderShare
//           rule.fixedFee (nouveau champ DB)
//
//  BUG 4 — FeeMethodRow fixedInput ne se synchronise pas après chargement DB
//    FIX  → useEffect sur method.fixedFee dans FeeMethodRow
// =========================================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Platform, Animated, TextInput,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Tokens ──────────────────────────────────────────────
const T = {
  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  borderMd: "#D1D9E6",

  ink:      "#0F172A",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",

  indigo:   "#4F46E5",
  indigoLt: "#EEF2FF",
  indigoMd: "#C7D5FF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  greenMd:  "#A7F3D0",

  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",

  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  amberMd:  "#FDE68A",

  red:      "#DC2626",
  redLt:    "#FEE2E2",

  violet:   "#7C3AED",
  violetLt: "#EDE9FE",
  violetMd: "#C4B5FD",

  sky:      "#0284C7",
  skyLt:    "#E0F2FE",
  skyMd:    "#7DD3FC",

  white:    "#FFFFFF",

  radius:   { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, full: 999 },

  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sub:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "monospace" }),
  },

  shadow: {
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
    card: { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  },
};

// ─── Types ───────────────────────────────────────────────
interface FeeMethod {
  key:      string;
  label:    string;
  icon:     string;
  color:    string;
  bg:       string;
  rate:     number;    // % (ex: 1.5 = 1.5%)
  fixedFee: number;    // Montant fixe additionnel
  isFree:   boolean;
}

interface FeeTier {
  id:        string;
  minAmount: number;
  maxAmount: number | null;
  rate:      number;
  fixedFee:  number;
}

interface FeeOverride {
  id:         string;
  label:      string;
  phone:      string;
  rate:       number;
  validUntil: string;
  note:       string;
}

const STORAGE_KEY_TIERS    = "fee_tiers_v1";
const STORAGE_KEY_OVERRIDES = "fee_overrides_v1";

const FEE_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

function fmtCurrency(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(n); }
  catch { return String(n); }
}

// ─── Section Header ───────────────────────────────────────
function SH({ icon, title, color, desc }: {
  icon: string; title: string; color: string; desc?: string;
}) {
  return (
    <View style={shS.row}>
      <View style={[shS.box, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[shS.title, { color, fontFamily: T.font.sans }]}>{title}</Text>
        {desc && <Text style={[shS.desc, { fontFamily: T.font.sub }]}>{desc}</Text>}
      </View>
    </View>
  );
}
const shS = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  box:   { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  desc:  { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginTop: 2 },
});

// ─── Fee Method Row ───────────────────────────────────────
function FeeMethodRow({ method, onChange }: {
  method: FeeMethod;
  onChange: (key: string, rate: number, fixedFee: number) => void;
}) {
  const [fixedInput, setFixedInput] = useState(String(method.fixedFee));

  // ✅ FIX BUG 4 : synchronise l'input quand le parent recharge depuis la DB
  useEffect(() => {
    setFixedInput(String(method.fixedFee));
  }, [method.fixedFee]);

  if (method.isFree) {
    return (
      <View style={fmS.row}>
        <View style={[fmS.iconBox, { backgroundColor: method.bg }]}>
          <Ionicons name={method.icon as any} size={15} color={method.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fmS.label, { fontFamily: T.font.sans }]}>{method.label}</Text>
          <Text style={[fmS.sub, { fontFamily: T.font.sub }]}>Non modifiable</Text>
        </View>
        <View style={[fmS.freeBadge, { backgroundColor: T.greenLt, borderColor: T.greenMd }]}>
          <Ionicons name="checkmark-circle" size={12} color={T.green} />
          <Text style={[fmS.freeTxt, { color: T.green, fontFamily: T.font.sans }]}>GRATUIT</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={fmS.card}>
      <View style={fmS.cardHeader}>
        <View style={[fmS.iconBox, { backgroundColor: method.bg }]}>
          <Ionicons name={method.icon as any} size={15} color={method.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fmS.label, { fontFamily: T.font.sans }]}>{method.label}</Text>
        </View>
        <View style={[fmS.ratePill, { backgroundColor: method.bg, borderColor: method.color + "40" }]}>
          <Text style={[fmS.ratePillTxt, { color: method.color, fontFamily: T.font.mono }]}>
            {method.rate}%
          </Text>
        </View>
      </View>

      <Text style={[fmS.stepsLabel, { fontFamily: T.font.sans }]}>TAUX EN %</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fmS.stepsRow}
      >
        {FEE_STEPS.map((step) => {
          const active = method.rate === step;
          return (
            <TouchableOpacity
              key={step}
              style={[fmS.step, active && { backgroundColor: method.color, borderColor: method.color }]}
              onPress={() => onChange(method.key, step, method.fixedFee)}
            >
              <Text style={[
                fmS.stepTxt,
                { color: active ? T.white : T.inkSub, fontFamily: T.font.mono },
              ]}>
                {step}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[fmS.stepsLabel, { fontFamily: T.font.sans, marginTop: 10 }]}>
        FRAIS FIXE ADDITIONNEL (en devise locale)
      </Text>
      <View style={fmS.fixedRow}>
        <TextInput
          style={[fmS.fixedInput, { fontFamily: T.font.mono }]}
          value={fixedInput}
          onChangeText={(v) => {
            setFixedInput(v);
            const n = Number(v.replace(",", "."));
            if (isFinite(n) && n >= 0) onChange(method.key, method.rate, n);
          }}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={T.inkMuted}
        />
        <Text style={[fmS.fixedSuffix, { fontFamily: T.font.sub }]}>XOF / EUR / GNF…</Text>
      </View>

      <View style={[fmS.summary, { backgroundColor: method.bg + "80", borderColor: method.color + "25" }]}>
        <Ionicons name="information-circle-outline" size={12} color={method.color} />
        <Text style={[fmS.summaryTxt, { color: method.color, fontFamily: T.font.sub }]}>
          Pour un envoi de 100 000 XOF : frais = {fmtCurrency(100000 * method.rate / 100 + method.fixedFee)} XOF
        </Text>
      </View>
    </View>
  );
}
const fmS = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  iconBox:    { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:      { fontSize: 13, fontWeight: "700", color: T.ink },
  sub:        { fontSize: 10, color: T.inkMuted, marginTop: 1 },
  freeBadge:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.radius.full, borderWidth: 1 },
  freeTxt:    { fontSize: 9, fontWeight: "900" },
  card:       { borderWidth: 1, borderColor: T.borderMd, borderRadius: T.radius.md, padding: 12, marginBottom: 12, ...T.shadow.soft },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  ratePill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: T.radius.full, borderWidth: 1 },
  ratePillTxt:{ fontSize: 13, fontWeight: "900" },
  stepsLabel: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8 },
  stepsRow:   { gap: 6, paddingBottom: 4 },
  step:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: T.radius.sm, borderWidth: 1.5, borderColor: T.borderMd, backgroundColor: T.surface },
  stepTxt:    { fontSize: 12, fontWeight: "800" },
  fixedRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  fixedInput: { flex: 1, backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.borderMd, borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: "700", color: T.ink },
  fixedSuffix:{ fontSize: 10, color: T.inkMuted },
  summary:    { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: T.radius.sm, borderWidth: 1 },
  summaryTxt: { fontSize: 10, fontWeight: "600", flex: 1 },
});

// ─── Fee Tier Row ─────────────────────────────────────────
function FeeTierRow({ tier, index, onDelete }: {
  tier: FeeTier; index: number; onDelete: (id: string) => void;
}) {
  const minStr = tier.minAmount > 0 ? `≥ ${fmtCurrency(tier.minAmount)}` : "Tout montant";
  const maxStr = tier.maxAmount ? `< ${fmtCurrency(tier.maxAmount)}` : "(illimité)";

  return (
    <View style={ftS.row}>
      <View style={[ftS.indexBox, { backgroundColor: T.indigoLt }]}>
        <Text style={[ftS.indexTxt, { color: T.indigo, fontFamily: T.font.mono }]}>
          {index + 1}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ftS.range, { fontFamily: T.font.mono }]}>{minStr} — {maxStr}</Text>
        <Text style={[ftS.fee, { fontFamily: T.font.sans }]}>
          {tier.rate}%
          {tier.fixedFee > 0 ? ` + ${fmtCurrency(tier.fixedFee)} fixe` : ""}
        </Text>
      </View>
      <TouchableOpacity
        style={ftS.deleteBtn}
        onPress={() => onDelete(tier.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={16} color={T.red} />
      </TouchableOpacity>
    </View>
  );
}
const ftS = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  indexBox: { width: 28, height: 28, borderRadius: T.radius.xs, justifyContent: "center", alignItems: "center" },
  indexTxt: { fontSize: 11, fontWeight: "900" },
  range:    { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  fee:      { fontSize: 11, color: T.inkSub, fontWeight: "600" },
  deleteBtn:{ padding: 4 },
});

// ─── Override Row ─────────────────────────────────────────
function OverrideRow({ override, onDelete }: {
  override: FeeOverride; onDelete: (id: string) => void;
}) {
  const isExpired = override.validUntil && new Date(override.validUntil) < new Date();

  return (
    <View style={ovS.row}>
      <View style={[ovS.avatar, { backgroundColor: T.violetLt }]}>
        <Ionicons name="person-outline" size={14} color={T.violet} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ovS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {override.label || override.phone}
        </Text>
        <Text style={[ovS.phone, { fontFamily: T.font.mono }]}>{override.phone}</Text>
        {override.note ? (
          <Text style={[ovS.note, { fontFamily: T.font.sub }]} numberOfLines={1}>
            {override.note}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View style={[ovS.rateBadge, { backgroundColor: T.violetLt, borderColor: T.violetMd }]}>
          <Text style={[ovS.rate, { color: T.violet, fontFamily: T.font.mono }]}>
            {override.rate}%
          </Text>
        </View>
        {override.validUntil && (
          <Text style={[ovS.expiry, { color: isExpired ? T.red : T.inkMuted, fontFamily: T.font.sub }]}>
            {isExpired ? "EXPIRÉ" : `jusqu'au ${new Date(override.validUntil).toLocaleDateString("fr-FR")}`}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={ovS.deleteBtn}
        onPress={() => onDelete(override.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle-outline" size={20} color={T.red} />
      </TouchableOpacity>
    </View>
  );
}
const ovS = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  avatar:   { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  name:     { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 1 },
  phone:    { fontSize: 10, fontWeight: "700", color: T.inkSub },
  note:     { fontSize: 9, color: T.inkMuted, marginTop: 1 },
  rateBadge:{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: T.radius.full, borderWidth: 1 },
  rate:     { fontSize: 12, fontWeight: "900" },
  expiry:   { fontSize: 8, fontWeight: "700" },
  deleteBtn:{ padding: 2 },
});

// ─── Modal Add Tier ───────────────────────────────────────
function AddTierModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (tier: Omit<FeeTier, "id">) => void;
}) {
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [rate,      setRate]      = useState("1.5");
  const [fixedFee,  setFixedFee]  = useState("0");

  const handleSave = () => {
    const min = Number(minAmount.replace(/\s/g, "")) || 0;
    const max = maxAmount.trim() ? (Number(maxAmount.replace(/\s/g, "")) || null) : null;
    const r   = Number(rate.replace(",", ".")) || 0;
    const ff  = Number(fixedFee.replace(",", ".")) || 0;

    if (max !== null && max <= min) {
      Alert.alert("Erreur", "Le montant max doit être supérieur au montant min.");
      return;
    }

    onSave({ minAmount: min, maxAmount: max, rate: r, fixedFee: ff });
    setMinAmount(""); setMaxAmount(""); setRate("1.5"); setFixedFee("0");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={mdS.overlay}>
          <View style={mdS.sheet}>
            <View style={mdS.handle} />
            <Text style={[mdS.title, { fontFamily: T.font.sans }]}>Ajouter un palier</Text>
            <Text style={[mdS.sub, { fontFamily: T.font.sub }]}>
              Définissez une plage de montant et un taux spécifique
            </Text>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>MONTANT MINIMUM (0 = pas de min)</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={minAmount} onChangeText={setMinAmount}
                keyboardType="numeric" placeholder="0" placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>MONTANT MAXIMUM (vide = illimité)</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={maxAmount} onChangeText={setMaxAmount}
                keyboardType="numeric" placeholder="illimité" placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.row2}>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>TAUX (%)</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={rate} onChangeText={setRate}
                  keyboardType="numeric" placeholder="1.5" placeholderTextColor={T.inkMuted}
                />
              </View>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>FRAIS FIXE</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={fixedFee} onChangeText={setFixedFee}
                  keyboardType="numeric" placeholder="0" placeholderTextColor={T.inkMuted}
                />
              </View>
            </View>

            <View style={mdS.btns}>
              <TouchableOpacity style={mdS.cancelBtn} onPress={onClose}>
                <Text style={[mdS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mdS.saveBtn} onPress={handleSave}>
                <Text style={[mdS.saveTxt, { fontFamily: T.font.sans }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Modal Add Override ───────────────────────────────────
function AddOverrideModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (o: Omit<FeeOverride, "id">) => void;
}) {
  const [label,      setLabel]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [rate,       setRate]       = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [note,       setNote]       = useState("");

  const handleSave = () => {
    if (!phone.trim()) {
      Alert.alert("Erreur", "Le numéro de téléphone est requis.");
      return;
    }
    const r = Number(rate.replace(",", "."));
    if (!isFinite(r) || r < 0 || r > 100) {
      Alert.alert("Erreur", "Le taux doit être entre 0 et 100.");
      return;
    }
    onSave({ label, phone, rate: r, validUntil, note });
    setLabel(""); setPhone(""); setRate("0"); setValidUntil(""); setNote("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={mdS.overlay}>
          <View style={mdS.sheet}>
            <View style={mdS.handle} />
            <Text style={[mdS.title, { fontFamily: T.font.sans }]}>Remise négociée</Text>
            <Text style={[mdS.sub, { fontFamily: T.font.sub }]}>
              Applique un taux réduit à un partenaire ou client spécifique
            </Text>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>NOM OU RAISON SOCIALE</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.sans }]}
                value={label} onChangeText={setLabel}
                placeholder="Partenaire Sénégal SAS" placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>TÉLÉPHONE *</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={phone} onChangeText={setPhone}
                placeholder="+221 77 000 0000" placeholderTextColor={T.inkMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={mdS.row2}>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>TAUX RÉDUIT (%)</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={rate} onChangeText={setRate}
                  keyboardType="numeric" placeholder="0" placeholderTextColor={T.inkMuted}
                />
              </View>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>VALIDE JUSQU'AU</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={validUntil} onChangeText={setValidUntil}
                  placeholder="JJ/MM/AAAA" placeholderTextColor={T.inkMuted}
                />
              </View>
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>NOTE (optionnel)</Text>
              <TextInput
                style={[mdS.input, mdS.inputMulti, { fontFamily: T.font.sub }]}
                value={note} onChangeText={setNote}
                placeholder="Contexte de la négociation…" placeholderTextColor={T.inkMuted}
                multiline numberOfLines={2}
              />
            </View>

            <View style={mdS.btns}>
              <TouchableOpacity style={mdS.cancelBtn} onPress={onClose}>
                <Text style={[mdS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mdS.saveBtn, { backgroundColor: T.violet }]} onPress={handleSave}>
                <Text style={[mdS.saveTxt, { fontFamily: T.font.sans }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mdS = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20 },
  handle:    { width: 40, height: 4, borderRadius: T.radius.full, backgroundColor: T.borderMd, alignSelf: "center", marginBottom: 16 },
  title:     { fontSize: 16, fontWeight: "900", color: T.ink, marginBottom: 4 },
  sub:       { fontSize: 11, color: T.inkSub, marginBottom: 16 },
  field:     { marginBottom: 12 },
  label:     { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6 },
  input:     { backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.borderMd, borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: "700", color: T.ink },
  inputMulti:{ height: 60, textAlignVertical: "top" },
  row2:      { flexDirection: "row", gap: 10 },
  btns:      { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: T.radius.md, backgroundColor: T.borderLt, alignItems: "center", borderWidth: 1, borderColor: T.borderMd },
  cancelTxt: { fontSize: 13, fontWeight: "800", color: T.inkSub },
  saveBtn:   { flex: 2, paddingVertical: 14, borderRadius: T.radius.md, backgroundColor: T.indigo, alignItems: "center" },
  saveTxt:   { fontSize: 13, fontWeight: "900", color: T.white },
});

// ─── Main Screen ──────────────────────────────────────────
export default function FeesScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [methods, setMethods] = useState<FeeMethod[]>([
    { key: "CASH_PICKUP",   label: "Retrait Cash",           icon: "cash-outline",            color: T.amber,  bg: T.amberLt,  rate: 1.5, fixedFee: 0, isFree: false },
    { key: "BANK_DEPOSIT",  label: "Virement Bancaire",      icon: "business-outline",        color: T.sky,    bg: T.skyLt,    rate: 1.5, fixedFee: 0, isFree: false },
    { key: "MOBILE_MONEY",  label: "Mobile Money",           icon: "phone-portrait-outline",  color: T.teal,   bg: T.tealLt,   rate: 1.0, fixedFee: 0, isFree: false },
    { key: "IBAN_TRANSFER", label: "Virement IBAN (Europe)", icon: "globe-outline",           color: T.indigo, bg: T.indigoLt, rate: 1.5, fixedFee: 0, isFree: false },
    { key: "WALLET",        label: "Wallet → Wallet",         icon: "swap-horizontal-outline", color: T.green,  bg: T.greenLt,  rate: 0,   fixedFee: 0, isFree: true  },
  ]);

  const [tiers,       setTiers]       = useState<FeeTier[]>([]);
  const [overrides,   setOverrides]   = useState<FeeOverride[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showAddTier, setShowAddTier] = useState(false);
  const [showAddOv,   setShowAddOv]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ✅ FIX BUG 2 : useCallback sans `methods` dans les dépendances
  //    → setMethods(prev => ...) évite le stale closure
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // AsyncStorage : paliers et remises (données locales mobile)
      const [tiersJson, ovJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TIERS),
        AsyncStorage.getItem(STORAGE_KEY_OVERRIDES),
      ]);
      if (tiersJson) setTiers(JSON.parse(tiersJson));
      if (ovJson)    setOverrides(JSON.parse(ovJson));

      // Backend : taux de frais par méthode
      try {
        const rules = await api.getCommissionRules() as any[];
        if (Array.isArray(rules)) {
          // ✅ FIX BUG 2 : setMethods(prev => ...) — pas de stale closure
          setMethods(prev => {
            const updated = [...prev];
            for (const rule of rules) {
              // ✅ FIX BUG 1 + 3 : identifier les fee configs par payoutMethod
              //    (sourceType === "WALLET" ET payoutMethod présent)
              if (rule.payoutMethod && rule.sourceType === "WALLET") {
                const idx = updated.findIndex((m) => m.key === rule.payoutMethod);
                if (idx !== -1) {
                  updated[idx] = {
                    ...updated[idx],
                    // ✅ FIX BUG 3 : utiliser feeRate (nouveau champ DB)
                    //    avec fallback sur senderShare (rétrocompatibilité)
                    rate:     rule.feeRate    ?? rule.senderShare ?? updated[idx].rate,
                    fixedFee: rule.fixedFee   ?? updated[idx].fixedFee,
                  };
                }
              }
            }
            return updated;
          });
        }
      } catch { /* Taux par défaut utilisés si backend inaccessible */ }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [fadeAnim]); // ✅ FIX : `methods` retiré des dépendances

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void load();
  }, [load]));

  const handleMethodChange = (key: string, rate: number, fixedFee: number) => {
    setMethods(prev => prev.map((m) => m.key === key ? { ...m, rate, fixedFee } : m));
  };

  const handleAddTier = (tier: Omit<FeeTier, "id">) => {
    const newTier: FeeTier = { ...tier, id: Date.now().toString() };
    const sorted = [...tiers, newTier].sort((a, b) => a.minAmount - b.minAmount);
    setTiers(sorted);
  };

  const handleDeleteTier = (id: string) => {
    Alert.alert("Supprimer le palier", "Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => setTiers((p) => p.filter((t) => t.id !== id)) },
    ]);
  };

  const handleAddOverride = (o: Omit<FeeOverride, "id">) => {
    const newOv: FeeOverride = { ...o, id: Date.now().toString() };
    setOverrides((p) => [...p, newOv]);
  };

  const handleDeleteOverride = (id: string) => {
    Alert.alert("Supprimer la remise", "Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => setOverrides((p) => p.filter((o) => o.id !== id)) },
    ]);
  };

  // ✅ FIX BUG 1 : sourceType "WALLET" (valeur d'enum valide)
  //    + payoutMethod + feeRate → backend accepte et persiste en DB
  const handleSave = async () => {
    setSaving(true);
    try {
      // Paliers et remises → AsyncStorage (mobile uniquement)
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TIERS,     JSON.stringify(tiers)),
        AsyncStorage.setItem(STORAGE_KEY_OVERRIDES,  JSON.stringify(overrides)),
      ]);

      // Taux par méthode → backend (CommissionConfig en DB)
      const results = await Promise.allSettled(
        methods
          .filter((m) => !m.isFree)
          .map((method) =>
            api.saveCommissionRule({
              sourceType:   "WALLET" as any,     // ✅ FIX : WALLET est un enum valide
              destType:     "SUBSIDIARY" as any,
              payoutMethod: method.key,           // ✅ FIX : champ requis côté backend
              feeRate:      method.rate,          // ✅ FIX : nouveau champ DB (% réel)
              fixedFee:     method.fixedFee,      // ✅ FIX : nouveau champ DB (montant fixe)
              senderShare:  method.rate,          // rétrocompatibilité
              payerShare:   0,
              platformShare: Math.max(0, 100 - method.rate),
            } as any)
          )
      );

      const failed = results.filter((r) => r.status === "rejected").length;

      Alert.alert(
        failed === 0 ? "✅ Frais sauvegardés" : "⚠️ Partiellement sauvegardé",
        failed === 0
          ? `${methods.filter((m) => !m.isFree).length} méthodes · ${tiers.length} palier(s) · ${overrides.length} remise(s)`
          : `${results.length - failed}/${results.length} méthodes sauvegardées. Vérifiez la connexion.`,
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loader}>
          <ActivityIndicator color={T.indigo} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const activeOverrides  = overrides.filter((o) => !o.validUntil || new Date(o.validUntil) >= new Date());
  const expiredOverrides = overrides.filter((o) => o.validUntil && new Date(o.validUntil) < new Date());

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.pageBg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Frais de Transaction</Text>
          <Text style={[s.headerSub, { color: T.indigo, fontFamily: T.font.sub }]}>
            Tarification · Admin société uniquement
          </Text>
        </View>
        <View style={[s.roleBadge, { backgroundColor: T.indigoLt, borderColor: T.indigoMd }]}>
          <View style={s.roleDot} />
          <Text style={[s.roleTxt, { color: T.indigo, fontFamily: T.font.sans }]}>ADMIN</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bannière info */}
        <View style={[s.infoBanner, { backgroundColor: T.indigoLt, borderColor: T.indigoMd }]}>
          <Ionicons name="information-circle-outline" size={16} color={T.indigo} />
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: T.indigo, fontFamily: T.font.sans }]}>
              Principes de tarification
            </Text>
            <Text style={[s.infoText, { color: T.indigo, fontFamily: T.font.sub }]}>
              Les frais sont prélevés sur le montant envoyé. Le virement Wallet → Wallet est
              toujours gratuit. Les taux configurés ici s'appliquent immédiatement à toutes
              les nouvelles transactions.
            </Text>
          </View>
        </View>

        {/* Section 1 : Frais par méthode */}
        <View style={s.card}>
          <SH
            icon="pricetag-outline"
            title="Frais par méthode de paiement"
            color={T.indigo}
            desc="Taux appliqué lors de la création d'une transaction"
          />
          {methods.filter((m) => m.isFree).map((m) => (
            <FeeMethodRow key={m.key} method={m} onChange={handleMethodChange} />
          ))}
          <View style={{ height: 8 }} />
          {methods.filter((m) => !m.isFree).map((m) => (
            <FeeMethodRow key={m.key} method={m} onChange={handleMethodChange} />
          ))}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: T.indigo }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={T.white} size="small" />
              : <>
                  <Ionicons name="cloud-upload-outline" size={18} color={T.white} />
                  <Text style={[s.saveBtnTxt, { fontFamily: T.font.sans }]}>
                    SAUVEGARDER LES FRAIS
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Section 2 : Paliers */}
        <View style={s.card}>
          <SH
            icon="layers-outline"
            title="Paliers de frais"
            color={T.teal}
            desc="Appliquer des taux différents selon le montant envoyé"
          />
          {tiers.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="layers-outline" size={18} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sub }]}>
                Aucun palier défini · Le taux standard s'applique à tous les montants
              </Text>
            </View>
          ) : (
            tiers.map((tier, i) => (
              <FeeTierRow key={tier.id} tier={tier} index={i} onDelete={handleDeleteTier} />
            ))
          )}
          <TouchableOpacity
            style={[s.addBtn, { borderColor: T.teal + "60", backgroundColor: T.tealLt }]}
            onPress={() => setShowAddTier(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={T.teal} />
            <Text style={[s.addBtnTxt, { color: T.teal, fontFamily: T.font.sans }]}>
              Ajouter un palier
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 3 : Remises partenaires */}
        <View style={s.card}>
          <SH
            icon="handshake-outline"
            title="Remises négociées"
            color={T.violet}
            desc="Taux réduit accordé suite à une négociation partenaire"
          />
          {overrides.length > 0 && (
            <View style={[s.summaryStrip, { backgroundColor: T.violetLt, borderColor: T.violetMd }]}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: T.violet, fontFamily: T.font.mono }]}>
                  {activeOverrides.length}
                </Text>
                <Text style={[s.summaryLbl, { fontFamily: T.font.sans }]}>actives</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: T.violetMd }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: T.inkMuted, fontFamily: T.font.mono }]}>
                  {expiredOverrides.length}
                </Text>
                <Text style={[s.summaryLbl, { fontFamily: T.font.sans }]}>expirées</Text>
              </View>
            </View>
          )}
          {overrides.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="people-outline" size={18} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sub }]}>
                Aucune remise négociée · Tous les partenaires paient le taux standard
              </Text>
            </View>
          ) : (
            overrides.map((ov) => (
              <OverrideRow key={ov.id} override={ov} onDelete={handleDeleteOverride} />
            ))
          )}
          <TouchableOpacity
            style={[s.addBtn, { borderColor: T.violet + "60", backgroundColor: T.violetLt }]}
            onPress={() => setShowAddOv(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={T.violet} />
            <Text style={[s.addBtnTxt, { color: T.violet, fontFamily: T.font.sans }]}>
              Ajouter une remise partenaire
            </Text>
          </TouchableOpacity>
        </View>

        {/* Note intégration backend */}
        <View style={[s.infoNote, { backgroundColor: T.amberLt, borderColor: T.amberMd }]}>
          <Ionicons name="checkmark-done-outline" size={14} color={T.amber} />
          <Text style={[s.infoNoteTxt, { fontFamily: T.font.sub }]}>
            Les taux sont lus en temps réel depuis{" "}
            <Text style={{ fontWeight: "700" }}>CommissionConfig</Text>
            {" "}à chaque création de transaction via{" "}
            <Text style={{ fontWeight: "700" }}>transactions.service.ts</Text>.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      <AddTierModal visible={showAddTier} onClose={() => setShowAddTier(false)} onSave={handleAddTier} />
      <AddOverrideModal visible={showAddOv} onClose={() => setShowAddOv(false)} onSave={handleAddOverride} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  header:      { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.surface, paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn:     { width: 38, height: 38, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  headerSub:   { fontSize: 11, fontWeight: "600", marginTop: 2 },
  roleBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.sm, borderWidth: 1 },
  roleDot:     { width: 6, height: 6, borderRadius: T.radius.full, backgroundColor: T.indigo },
  roleTxt:     { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },

  scroll:      { padding: 16 },

  infoBanner:  { flexDirection: "row", gap: 10, padding: 14, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 16, alignItems: "flex-start" },
  infoTitle:   { fontSize: 12, fontWeight: "800", marginBottom: 4 },
  infoText:    { fontSize: 11, lineHeight: 16 },

  card: {
    backgroundColor: T.surface, borderRadius: T.radius.xl,
    padding: 18, marginBottom: 16, borderWidth: 1, borderColor: T.border,
    ...T.shadow.card,
  },

  saveBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: T.radius.lg, paddingVertical: 16, marginTop: 16 },
  saveBtnTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },

  addBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1.5, borderStyle: "dashed", marginTop: 8 },
  addBtnTxt: { fontSize: 13, fontWeight: "800" },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: T.borderLt, borderRadius: T.radius.sm, marginBottom: 12 },
  emptyTxt: { fontSize: 11, color: T.inkMuted, fontWeight: "600", flex: 1 },

  summaryStrip:   { flexDirection: "row", borderRadius: T.radius.sm, borderWidth: 1, padding: 12, marginBottom: 14, alignItems: "center" },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryVal:     { fontSize: 22, fontWeight: "900" },
  summaryLbl:     { fontSize: 9, fontWeight: "800", color: T.inkSub, letterSpacing: 0.5 },
  summaryDivider: { width: 1, height: 30 },

  infoNote:    { flexDirection: "row", gap: 10, padding: 12, borderRadius: T.radius.sm, borderWidth: 1, marginBottom: 8, alignItems: "flex-start" },
  infoNoteTxt: { fontSize: 10, color: T.inkSub, flex: 1, lineHeight: 15 },
});