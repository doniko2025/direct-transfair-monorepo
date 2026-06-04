// apps/direct-transfair-mobile/app/(tabs)/admin/fees.tsx
// =========================================================
// FRAIS DE TRANSACTION v1.0 \u2014 Direct Transf'air
// \u2705 Frais par m\u00e9thode de paiement (cash, banque, mobile money)
// \u2705 Paliers de frais par montant (tiered fees)
// \u2705 Remises partenaires n\u00e9goci\u00e9es (per-beneficiary custom fee)
// \u2705 Wallet \u2192 Wallet toujours GRATUIT (non modifiable)
// \u2705 Frais appliqu\u00e9s en base via transactions.service.ts
// =========================================================

import React, { useState, useCallback, useRef } from "react";
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

// \u2500\u2500\u2500 Tokens \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Types \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
interface FeeMethod {
  key:     string;
  label:   string;
  icon:    string;
  color:   string;
  bg:      string;
  rate:    number;   // % (ex: 1.5 = 1.5%)
  fixedFee:number;   // Montant fixe additionnel (ex: 200 XOF)
  isFree:  boolean;  // Toujours gratuit (wallet)
}

interface FeeTier {
  id:       string;
  minAmount:number;
  maxAmount:number | null; // null = illimit\u00e9
  rate:     number;
  fixedFee: number;
}

interface FeeOverride {
  id:          string;
  label:       string;    // Nom partenaire / b\u00e9n\u00e9ficiaire
  phone:       string;
  rate:        number;    // Taux r\u00e9duit en %
  validUntil:  string;    // ISO date, "" = permanent
  note:        string;
}

const STORAGE_KEY_TIERS     = "fee_tiers_v1";
const STORAGE_KEY_OVERRIDES  = "fee_overrides_v1";

const FEE_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

function fmtCurrency(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(n); }
  catch { return String(n); }
}

// \u2500\u2500\u2500 Section Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Fee Method Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function FeeMethodRow({ method, onChange }: {
  method: FeeMethod;
  onChange: (key: string, rate: number, fixedFee: number) => void;
}) {
  const [fixedInput, setFixedInput] = useState(String(method.fixedFee));

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
      {/* Ligne titre */}
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

      {/* S\u00e9lecteur taux % */}
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

      {/* Frais fixe additionnel */}
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
        <Text style={[fmS.fixedSuffix, { fontFamily: T.font.sub }]}>XOF / EUR / GNF\u2026</Text>
      </View>

      {/* R\u00e9sum\u00e9 */}
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
  // Ligne simple (gratuit)
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  iconBox:   { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label:     { fontSize: 13, fontWeight: "700", color: T.ink },
  sub:       { fontSize: 10, color: T.inkMuted, marginTop: 1 },
  freeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.radius.full, borderWidth: 1 },
  freeTxt:   { fontSize: 9, fontWeight: "900" },
  // Carte \u00e9ditable
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

// \u2500\u2500\u2500 Fee Tier Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function FeeTierRow({ tier, index, onDelete }: {
  tier: FeeTier; index: number; onDelete: (id: string) => void;
}) {
  const minStr = tier.minAmount > 0 ? `\u2265 ${fmtCurrency(tier.minAmount)}` : "Tout montant";
  const maxStr = tier.maxAmount ? `< ${fmtCurrency(tier.maxAmount)}` : "(illimit\u00e9)";

  return (
    <View style={ftS.row}>
      <View style={[ftS.indexBox, { backgroundColor: T.indigoLt }]}>
        <Text style={[ftS.indexTxt, { color: T.indigo, fontFamily: T.font.mono }]}>
          {index + 1}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ftS.range, { fontFamily: T.font.mono }]}>{minStr} \u2014 {maxStr}</Text>
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
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  indexBox:  { width: 28, height: 28, borderRadius: T.radius.xs, justifyContent: "center", alignItems: "center" },
  indexTxt:  { fontSize: 11, fontWeight: "900" },
  range:     { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  fee:       { fontSize: 11, color: T.inkSub, fontWeight: "600" },
  deleteBtn: { padding: 4 },
});

// \u2500\u2500\u2500 Override Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        <View style={[ovS.rateBadge, {
          backgroundColor: T.violetLt,
          borderColor: T.violetMd,
        }]}>
          <Text style={[ovS.rate, { color: T.violet, fontFamily: T.font.mono }]}>
            {override.rate}%
          </Text>
        </View>
        {override.validUntil && (
          <Text style={[ovS.expiry, {
            color: isExpired ? T.red : T.inkMuted,
            fontFamily: T.font.sub,
          }]}>
            {isExpired ? "EXPIR\u00c9" : `jusqu'au ${new Date(override.validUntil).toLocaleDateString("fr-FR")}`}
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
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  avatar:    { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  name:      { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 1 },
  phone:     { fontSize: 10, fontWeight: "700", color: T.inkSub },
  note:      { fontSize: 9, color: T.inkMuted, marginTop: 1 },
  rateBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: T.radius.full, borderWidth: 1 },
  rate:      { fontSize: 12, fontWeight: "900" },
  expiry:    { fontSize: 8, fontWeight: "700" },
  deleteBtn: { padding: 2 },
});

// \u2500\u2500\u2500 Modal Add Tier \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      Alert.alert("Erreur", "Le montant max doit \u00eatre sup\u00e9rieur au montant min.");
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
              D\u00e9finissez une plage de montant et un taux sp\u00e9cifique
            </Text>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>MONTANT MINIMUM (0 = pas de min)</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={minAmount}
                onChangeText={setMinAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>MONTANT MAXIMUM (vide = illimit\u00e9)</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={maxAmount}
                onChangeText={setMaxAmount}
                keyboardType="numeric"
                placeholder="illimit\u00e9"
                placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.row2}>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>TAUX (%)</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                  placeholder="1.5"
                  placeholderTextColor={T.inkMuted}
                />
              </View>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>FRAIS FIXE</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={fixedFee}
                  onChangeText={setFixedFee}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={T.inkMuted}
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

// \u2500\u2500\u2500 Modal Add Override \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      Alert.alert("Erreur", "Le num\u00e9ro de t\u00e9l\u00e9phone est requis.");
      return;
    }
    const r = Number(rate.replace(",", "."));
    if (!isFinite(r) || r < 0 || r > 100) {
      Alert.alert("Erreur", "Le taux doit \u00eatre entre 0 et 100.");
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
            <Text style={[mdS.title, { fontFamily: T.font.sans }]}>Remise n\u00e9goci\u00e9e</Text>
            <Text style={[mdS.sub, { fontFamily: T.font.sub }]}>
              Applique un taux r\u00e9duit \u00e0 un partenaire ou client sp\u00e9cifique
            </Text>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>NOM OU RAISON SOCIALE</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.sans }]}
                value={label}
                onChangeText={setLabel}
                placeholder="Partenaire S\u00e9n\u00e9gal SAS"
                placeholderTextColor={T.inkMuted}
              />
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>T\u00c9L\u00c9PHONE *</Text>
              <TextInput
                style={[mdS.input, { fontFamily: T.font.mono }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+221 77 000 0000"
                placeholderTextColor={T.inkMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={mdS.row2}>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>TAUX R\u00c9DUIT (%)</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={T.inkMuted}
                />
              </View>
              <View style={[mdS.field, { flex: 1 }]}>
                <Text style={[mdS.label, { fontFamily: T.font.sans }]}>VALIDE JUSQU'AU</Text>
                <TextInput
                  style={[mdS.input, { fontFamily: T.font.mono }]}
                  value={validUntil}
                  onChangeText={setValidUntil}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={T.inkMuted}
                />
              </View>
            </View>

            <View style={mdS.field}>
              <Text style={[mdS.label, { fontFamily: T.font.sans }]}>NOTE (optionnel)</Text>
              <TextInput
                style={[mdS.input, mdS.inputMulti, { fontFamily: T.font.sub }]}
                value={note}
                onChangeText={setNote}
                placeholder="Contexte de la n\u00e9gociation\u2026"
                placeholderTextColor={T.inkMuted}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={mdS.btns}>
              <TouchableOpacity style={mdS.cancelBtn} onPress={onClose}>
                <Text style={[mdS.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mdS.saveBtn, { backgroundColor: T.violet }]}
                onPress={handleSave}
              >
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
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 20 },
  handle:     { width: 40, height: 4, borderRadius: T.radius.full, backgroundColor: T.borderMd, alignSelf: "center", marginBottom: 16 },
  title:      { fontSize: 16, fontWeight: "900", color: T.ink, marginBottom: 4 },
  sub:        { fontSize: 11, color: T.inkSub, marginBottom: 16 },
  field:      { marginBottom: 12 },
  label:      { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 6 },
  input:      { backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.borderMd, borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: "700", color: T.ink },
  inputMulti: { height: 60, textAlignVertical: "top" },
  row2:       { flexDirection: "row", gap: 10 },
  btns:       { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: T.radius.md, backgroundColor: T.borderLt, alignItems: "center", borderWidth: 1, borderColor: T.borderMd },
  cancelTxt:  { fontSize: 13, fontWeight: "800", color: T.inkSub },
  saveBtn:    { flex: 2, paddingVertical: 14, borderRadius: T.radius.md, backgroundColor: T.indigo, alignItems: "center" },
  saveTxt:    { fontSize: 13, fontWeight: "900", color: T.white },
});

// \u2500\u2500\u2500 Main Screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export default function FeesScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [methods, setMethods] = useState<FeeMethod[]>([
    { key: "CASH_PICKUP",   label: "Retrait Cash",          icon: "cash-outline",         color: T.amber,   bg: T.amberLt,   rate: 1.5, fixedFee: 0, isFree: false },
    { key: "BANK_DEPOSIT",  label: "Virement Bancaire",     icon: "business-outline",     color: T.sky,     bg: T.skyLt,     rate: 1.5, fixedFee: 0, isFree: false },
    { key: "MOBILE_MONEY",  label: "Mobile Money",          icon: "phone-portrait-outline",color: T.teal,   bg: T.tealLt,    rate: 1.0, fixedFee: 0, isFree: false },
    { key: "IBAN_TRANSFER", label: "Virement IBAN (Europe)",icon: "globe-outline",         color: T.indigo,  bg: T.indigoLt,  rate: 1.5, fixedFee: 0, isFree: false },
    { key: "WALLET",        label: "Wallet \u2192 Wallet",        icon: "swap-horizontal-outline",color: T.green, bg: T.greenLt,   rate: 0,   fixedFee: 0, isFree: true  },
  ]);

  const [tiers,       setTiers]       = useState<FeeTier[]>([]);
  const [overrides,   setOverrides]   = useState<FeeOverride[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showAddTier, setShowAddTier] = useState(false);
  const [showAddOv,   setShowAddOv]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // \u2500\u2500 Chargement \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Charge les paliers et remises depuis AsyncStorage (persistance locale)
      const [tiersJson, ovJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TIERS),
        AsyncStorage.getItem(STORAGE_KEY_OVERRIDES),
      ]);
      if (tiersJson) setTiers(JSON.parse(tiersJson));
      if (ovJson)    setOverrides(JSON.parse(ovJson));

      // Charge les taux depuis l'API commission (si d\u00e9finis)
      try {
        const rules = await api.getCommissionRules() as any[];
        if (Array.isArray(rules)) {
          const updatedMethods = [...methods];
          for (const rule of rules) {
            if (rule.sourceType === "FEE" && rule.payoutMethod) {
              const idx = updatedMethods.findIndex((m) => m.key === rule.payoutMethod);
              if (idx !== -1) {
                updatedMethods[idx] = {
                  ...updatedMethods[idx],
                  rate:     rule.senderShare ?? updatedMethods[idx].rate,
                  fixedFee: rule.platformCommission ?? updatedMethods[idx].fixedFee,
                };
              }
            }
          }
          setMethods(updatedMethods);
        }
      } catch { /* Taux par d\u00e9faut utilis\u00e9s */ }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void load();
  }, [load]));

  // \u2500\u2500 Handlers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const handleMethodChange = (key: string, rate: number, fixedFee: number) => {
    setMethods((prev) => prev.map((m) => m.key === key ? { ...m, rate, fixedFee } : m));
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

  // \u2500\u2500 Sauvegarder \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const handleSave = async () => {
    setSaving(true);
    try {
      // Persiste paliers et remises localement
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_TIERS,    JSON.stringify(tiers)),
        AsyncStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides)),
      ]);

      // Envoi des frais par m\u00e9thode vers l'API commission
      for (const method of methods) {
        if (!method.isFree) {
          try {
            await api.saveCommissionRule({
              sourceType:   "FEE",
              destType:     "SUBSIDIARY",
              payoutMethod: method.key,
              senderShare:  method.rate,
              payerShare:   0,
              platformShare: 100 - method.rate,
            } as any);
          } catch { /* On continue m\u00eame si un envoi \u00e9choue */ }
        }
      }

      Alert.alert(
        "\u2705 Frais sauvegard\u00e9s",
        `${methods.filter((m) => !m.isFree).length} m\u00e9thodes \u00b7 ${tiers.length} palier(s) \u00b7 ${overrides.length} remise(s)`,
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

      {/* \u2500\u2500 Header \u2500\u2500 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Frais de Transaction</Text>
          <Text style={[s.headerSub, { color: T.indigo, fontFamily: T.font.sub }]}>
            Tarification \u00b7 Admin soci\u00e9t\u00e9 uniquement
          </Text>
        </View>
        <View style={[s.roleBadge, { backgroundColor: T.indigoLt, borderColor: T.indigoMd }]}>
          <View style={s.roleDot} />
          <Text style={[s.roleTxt, { color: T.indigo, fontFamily: T.font.sans }]}>ADMIN</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            INFO CARD
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <View style={[s.infoBanner, { backgroundColor: T.indigoLt, borderColor: T.indigoMd }]}>
          <Ionicons name="information-circle-outline" size={16} color={T.indigo} />
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: T.indigo, fontFamily: T.font.sans }]}>
              Principes de tarification
            </Text>
            <Text style={[s.infoText, { color: T.indigo, fontFamily: T.font.sub }]}>
              Les frais sont pr\u00e9lev\u00e9s sur le montant envoy\u00e9. Le virement Wallet \u2192 Wallet est
              toujours gratuit. Les remises n\u00e9goci\u00e9es s'appliquent par num\u00e9ro de t\u00e9l\u00e9phone.
            </Text>
          </View>
        </View>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            SECTION 1 \u2014 FRAIS PAR M\u00c9THODE
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <View style={s.card}>
          <SH
            icon="pricetag-outline"
            title="Frais par m\u00e9thode de paiement"
            color={T.indigo}
            desc="Taux appliqu\u00e9 lors de la cr\u00e9ation d'une transaction"
          />

          {/* Ligne "Wallet" en premier (toujours gratuit) */}
          {methods.filter((m) => m.isFree).map((m) => (
            <FeeMethodRow key={m.key} method={m} onChange={handleMethodChange} />
          ))}

          <View style={{ height: 8 }} />

          {/* M\u00e9thodes payantes */}
          {methods.filter((m) => !m.isFree).map((m) => (
            <FeeMethodRow key={m.key} method={m} onChange={handleMethodChange} />
          ))}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: T.indigo }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
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

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            SECTION 2 \u2014 PALIERS DE FRAIS
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <View style={s.card}>
          <SH
            icon="layers-outline"
            title="Paliers de frais"
            color={T.teal}
            desc="Appliquer des taux diff\u00e9rents selon le montant envoy\u00e9"
          />

          {tiers.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="layers-outline" size={18} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sub }]}>
                Aucun palier d\u00e9fini \u00b7 Le taux standard s'applique \u00e0 tous les montants
              </Text>
            </View>
          ) : (
            tiers.map((tier, i) => (
              <FeeTierRow
                key={tier.id}
                tier={tier}
                index={i}
                onDelete={handleDeleteTier}
              />
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

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            SECTION 3 \u2014 REMISES PARTENAIRES
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <View style={s.card}>
          <SH
            icon="handshake-outline"
            title="Remises n\u00e9goci\u00e9es"
            color={T.violet}
            desc="Taux r\u00e9duit accord\u00e9 suite \u00e0 une n\u00e9gociation partenaire"
          />

          {/* Badge r\u00e9capitulatif */}
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
                <Text style={[s.summaryLbl, { fontFamily: T.font.sans }]}>expir\u00e9es</Text>
              </View>
            </View>
          )}

          {overrides.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name={"people-outline"} size={18} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sub }]}>
                Aucune remise n\u00e9goci\u00e9e \u00b7 Tous les partenaires paient le taux standard
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

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
            NOTE INT\u00c9GRATION BACKEND
        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <View style={[s.infoNote, { backgroundColor: T.amberLt, borderColor: T.amberMd }]}>
          <Ionicons name="construct-outline" size={14} color={T.amber} />
          <Text style={[s.infoNoteTxt, { fontFamily: T.font.sub }]}>
            Les paliers et remises sont synchronis\u00e9s lors de la cr\u00e9ation d'une transaction via
            <Text style={{ fontWeight: "700" }}> transactions.service.ts \u2192 getFeeRate()</Text>.
            Assurez-vous que la m\u00e9thode est bien appel\u00e9e dans le service backend.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* \u2500\u2500 Modals \u2500\u2500 */}
      <AddTierModal
        visible={showAddTier}
        onClose={() => setShowAddTier(false)}
        onSave={handleAddTier}
      />
      <AddOverrideModal
        visible={showAddOv}
        onClose={() => setShowAddOv(false)}
        onSave={handleAddOverride}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  headerSub:   { fontSize: 11, fontWeight: "600", marginTop: 2 },
  roleBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.sm, borderWidth: 1 },
  roleDot:     { width: 6, height: 6, borderRadius: T.radius.full, backgroundColor: T.indigo },
  roleTxt:     { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },

  scroll: { padding: 16 },

  infoBanner: { flexDirection: "row", gap: 10, padding: 14, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 16, alignItems: "flex-start" },
  infoTitle:  { fontSize: 12, fontWeight: "800", marginBottom: 4 },
  infoText:   { fontSize: 11, lineHeight: 16 },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.xl,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
    ...T.shadow.card,
  },

  addBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: T.radius.md, borderWidth: 1.5, borderStyle: "dashed", marginTop: 12 },
  addBtnTxt: { fontSize: 13, fontWeight: "800" },

  saveBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: T.radius.lg, paddingVertical: 16, marginTop: 16 },
  saveBtnTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, backgroundColor: T.borderLt, borderRadius: T.radius.sm },
  emptyTxt: { flex: 1, color: T.inkMuted, fontSize: 12 },

  summaryStrip:   { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, borderRadius: T.radius.md, borderWidth: 1, marginBottom: 12, gap: 20 },
  summaryItem:    { alignItems: "center", gap: 2 },
  summaryVal:     { fontSize: 20, fontWeight: "900" },
  summaryLbl:     { fontSize: 9, fontWeight: "700", color: T.inkSub },
  summaryDivider: { width: 1, height: 28 },

  infoNote:    { flexDirection: "row", gap: 8, padding: 12, borderRadius: T.radius.md, borderWidth: 1, alignItems: "flex-start" },
  infoNoteTxt: { flex: 1, fontSize: 10, color: T.amber, lineHeight: 15 },
});