// apps/direct-transfair-mobile/components/agencies/RefillAgencyModal.tsx
// =========================================================
// REFILL AGENCY MODAL v1.1 — Direct Transf'air
// ✅ Currency dynamique : priorité primaryCurrency → wallet isDefault → wallet[0] → "XOF"
// ✅ Cohérent avec serializeAgency() du backend (primaryCurrency + wallets[])
// ✅ Appel api.adminRefillAgency(id, amount, currency)
// ✅ Design thème clair — cohérent avec agencies/index.tsx
// =========================================================

import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import type { Agency } from "../../services/types";

// ─── Tokens ──────────────────────────────────────────────
const T = {
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  ink:      "#0F172A",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",
  white:    "#FFFFFF",
  radius:   { md: 12, lg: 16 },
  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "Trebuchet MS" }),
  },
};

const FLAG_MAP: Record<string, string> = {
  GN: "🇬🇳", SN: "🇸🇳", ML: "🇲🇱", CI: "🇨🇮", FR: "🇫🇷",
  GB: "🇬🇧", US: "🇺🇸", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬",
};

const CURRENCY_LABELS: Record<string, string> = {
  XOF: "CFA", GNF: "FG", EUR: "€", USD: "$", GBP: "£",
};

const QUICK_AMOUNTS: Record<string, number[]> = {
  XOF: [50_000, 100_000, 250_000, 500_000],
  GNF: [500_000, 1_000_000, 2_500_000, 5_000_000],
  EUR: [100, 250, 500, 1_000],
  USD: [100, 250, 500, 1_000],
  GBP: [100, 250, 500, 1_000],
};

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch { return n.toFixed(d); }
}

// ─── Résolution de la devise ──────────────────────────────
// Ordre de priorité identique à serializeAgency() backend :
//   1. primaryCurrency (calculé depuis country au moment de la création)
//   2. wallet isDefault → currency
//   3. wallets[0] → currency
//   4. "XOF" (fallback absolu)
function resolveCurrency(agency: Agency | null): string {
  if (!agency) return "XOF";

  if (agency.primaryCurrency) return agency.primaryCurrency;

  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const defaultWallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  if (defaultWallet?.currency) return defaultWallet.currency;

  return "XOF";
}

// ─── Props ────────────────────────────────────────────────
export interface RefillAgencyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  agency: Agency | null;
}

// ─── Component ───────────────────────────────────────────
export default function RefillAgencyModal({
  visible, onClose, onSuccess, agency,
}: RefillAgencyModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [loading,   setLoading]   = useState(false);

  // currency résolu une seule fois quand agency change
  const currency      = useMemo(() => resolveCurrency(agency), [agency]);
  const currencyLabel = CURRENCY_LABELS[currency] ?? currency;
  const flag          = agency?.country
    ? (FLAG_MAP[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
    : "🌍";
  const quickAmounts  = QUICK_AMOUNTS[currency] ?? QUICK_AMOUNTS.XOF;

  const reset = () => setAmountStr("");
  const handleClose = () => { reset(); onClose(); };

  const parsedAmount = Number(amountStr.replace(/\s/g, "").replace(",", "."));
  const isValid = parsedAmount > 0;

  const handleConfirm = async () => {
    if (!isValid) {
      Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0.");
      return;
    }
    if (!agency?.id) return;
    setLoading(true);
    try {
      await api.adminRefillAgency(agency.id, parsedAmount, currency);
      Alert.alert(
        "✅ Recharge effectuée",
        `${fmt(parsedAmount, currency)} ${currencyLabel} crédités sur le compte de ${agency.name}.`,
      );
      reset();
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Recharge impossible. Vérifiez votre solde.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  if (!agency) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={s.flagBox}>
              <Text style={{ fontSize: 22 }}>{flag}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { fontFamily: T.font.display }]} numberOfLines={1}>
                Recharger {agency.name}
              </Text>
              <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
                {agency.city ?? "—"} · Devise : <Text style={{ color: T.teal, fontWeight: "900" }}>{currency}</Text>
              </Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={18} color={T.inkSub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Montants rapides ── */}
            <Text style={[s.label, { fontFamily: T.font.sans }]}>MONTANTS RAPIDES</Text>
            <View style={s.quickRow}>
              {quickAmounts.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[s.quickBtn, parsedAmount === val && s.quickBtnActive]}
                  onPress={() => setAmountStr(String(val))}
                  disabled={loading}
                >
                  <Text style={[
                    s.quickTxt, { fontFamily: T.font.mono },
                    parsedAmount === val && s.quickTxtActive,
                  ]}>
                    {fmt(val, currency)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Saisie libre ── */}
            <Text style={[s.label, { fontFamily: T.font.sans, marginTop: 20 }]}>
              MONTANT PERSONNALISÉ
            </Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { fontFamily: T.font.mono }]}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder={`Ex: ${fmt(quickAmounts[1], currency)}`}
                placeholderTextColor={T.inkMuted}
                keyboardType="numeric"
                editable={!loading}
              />
              <View style={s.currencyTag}>
                <Text style={[s.currencyTxt, { fontFamily: T.font.sans }]}>{currencyLabel}</Text>
              </View>
            </View>

            {/* ── Récap ── */}
            {isValid && (
              <View style={s.recap}>
                <Ionicons name="information-circle-outline" size={15} color={T.teal} />
                <Text style={[s.recapTxt, { fontFamily: T.font.sans }]}>
                  {fmt(parsedAmount, currency)} {currencyLabel} seront crédités sur le wallet {currency} de {agency.name}.
                </Text>
              </View>
            )}

            {/* ── CTA ── */}
            <TouchableOpacity
              style={[s.confirmBtn, (!isValid || loading) && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!isValid || loading}
            >
              {loading
                ? <ActivityIndicator color={T.white} />
                : <>
                    <Ionicons name="arrow-up-circle" size={18} color={T.white} />
                    <Text style={[s.confirmTxt, { fontFamily: T.font.sans }]}>
                      RECHARGER · {currency}
                    </Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelRow} onPress={handleClose} disabled={loading}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: T.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 99,
    backgroundColor: T.border,
    alignSelf: "center",
    marginTop: 14, marginBottom: 4,
  },
  header: {
    flexDirection: "row", alignItems: "center",
    padding: 20, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  flagBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: T.tealLt, borderWidth: 1.5, borderColor: T.tealMd,
    justifyContent: "center", alignItems: "center",
  },
  title:    { fontSize: 16, fontWeight: "700", color: T.ink, marginBottom: 2 },
  subtitle: { fontSize: 11, color: T.inkSub, fontWeight: "600" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: T.borderLt,
    justifyContent: "center", alignItems: "center",
  },
  body:  { padding: 20 },
  label: {
    fontSize: 10, fontWeight: "900", color: T.inkMuted,
    letterSpacing: 1, marginBottom: 10,
  },
  quickRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: T.radius.md, borderWidth: 1.5,
    borderColor: T.border, backgroundColor: T.surface,
  },
  quickBtnActive: { borderColor: T.tealMd, backgroundColor: T.tealLt },
  quickTxt:       { fontSize: 12, fontWeight: "700", color: T.inkSub },
  quickTxtActive: { color: T.teal, fontWeight: "900" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1, backgroundColor: T.surface,
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontWeight: "700", color: T.ink,
  },
  currencyTag: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: T.radius.md, borderWidth: 1.5,
    borderColor: T.tealMd, backgroundColor: T.tealLt,
  },
  currencyTxt: { fontSize: 13, fontWeight: "900", color: T.teal },
  recap: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginTop: 16, padding: 12,
    backgroundColor: T.tealLt, borderRadius: T.radius.md,
    borderWidth: 1, borderColor: T.tealMd,
  },
  recapTxt: { flex: 1, fontSize: 12, color: T.teal, fontWeight: "600", lineHeight: 18 },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 20,
    backgroundColor: T.teal,
    borderRadius: T.radius.md,
    paddingVertical: 16,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },
  cancelRow:  { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  cancelTxt:  { fontSize: 14, fontWeight: "700", color: T.inkSub },
});