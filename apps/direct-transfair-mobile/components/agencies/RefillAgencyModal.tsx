// apps/direct-transfair-mobile/components/agencies/RefillAgencyModal.tsx
// =========================================================
// REFILL AGENCY MODAL v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE — bleu marine, à l'image du hero CompanyDashboard
//    PUREMENT PRÉSENTATIONNEL — la logique métier (resolveCurrency,
//    handleConfirm → api.adminRefillAgency, validation isValid) est
//    strictement identique à la v1.1.
//    - En-tête : fond blanc plat → LinearGradient bleu marine
//      (#070B16 → #123566), mêmes teintes exactes que le hero de
//      CompanyDashboard — halo décoratif, poignée du sheet en blanc
//      translucide (au lieu de gris, invisible sur fond sombre),
//      drapeau dans un cercle "verre" translucide, titre blanc,
//      bouton fermer "verre".
//    - NOUVEAU : carte "Solde actuel → Nouveau solde" — calculée
//      depuis agency.wallets (même logique que AgencyCard dans
//      CompanyDashboard), se met à jour en direct à chaque saisie ou
//      sélection de montant rapide. N'existait pas du tout en v1.1.
//    - Montants rapides, saisie, récapitulatif, CTA : même
//      contenu/logique, recolorés en bleu marine (teal clair → accent
//      #2563EB) au lieu du thème teal d'origine.
//    - Ce composant est désormais utilisé par CompanyDashboard.tsx
//      (v9.6) à la place de son ancien modal inline (violet #7C3AED,
//      dupliqué) — source unique pour ce flux, plus de divergence
//      possible entre les deux écrans qui l'utilisent.
// ✅ v1.1 : Currency dynamique : priorité primaryCurrency → wallet
//    isDefault → wallet[0] → "XOF". Cohérent avec serializeAgency()
//    du backend (primaryCurrency + wallets[]). Conservé à l'identique.
// =========================================================

import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient"; // ✅ v2.0 (nouveau)
import { api } from "../../services/api";
import type { Agency } from "../../services/types";

// ─── Tokens — ✅ v2.0 : bleu marine (mêmes teintes que CompanyDashboard) ──
const T = {
  navyFrom:   "#070B16",
  navyTo:     "#123566",
  accent:     "#2563EB",
  accentSoft: "#EFF6FF",
  accentMd:   "#BFDBFE",
  glass:      "rgba(255,255,255,0.1)",
  glassBdr:   "rgba(255,255,255,0.18)",
  heroMuted:  "rgba(255,255,255,0.6)",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  ink:      "#0F172A",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",
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

// ─── Résolution de la devise — inchangé (v1.1) ────────────
function resolveCurrency(agency: Agency | null): string {
  if (!agency) return "XOF";
  if (agency.primaryCurrency) return agency.primaryCurrency;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const defaultWallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  if (defaultWallet?.currency) return defaultWallet.currency;
  return "XOF";
}

// ✅ v2.0 (nouveau) — Solde actuel de l'agence dans sa devise (même
// logique de résolution wallet que AgencyCard dans CompanyDashboard).
function resolveBalance(agency: Agency | null): number {
  if (!agency) return 0;
  const wallets = Array.isArray(agency.wallets) ? agency.wallets : [];
  const defaultWallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  return Number(defaultWallet?.balance ?? 0);
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

  const currency       = useMemo(() => resolveCurrency(agency), [agency]);
  const currentBalance = useMemo(() => resolveBalance(agency), [agency]);
  const currencyLabel  = CURRENCY_LABELS[currency] ?? currency;
  const flag           = agency?.country
    ? (FLAG_MAP[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
    : "🌍";
  const quickAmounts   = QUICK_AMOUNTS[currency] ?? QUICK_AMOUNTS.XOF;

  const reset = () => setAmountStr("");
  const handleClose = () => { reset(); onClose(); };

  const parsedAmount = Number(amountStr.replace(/\s/g, "").replace(",", "."));
  const isValid = parsedAmount > 0;
  const projectedBalance = currentBalance + (isValid ? parsedAmount : 0);

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
          {/* ── Header — bleu marine ── */}
          <LinearGradient
            colors={[T.navyFrom, T.navyTo]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.header}
          >
            <View style={s.handleLight} />
            <View style={s.headerGlow} pointerEvents="none" />
            <View style={s.headerContent}>
              <View style={s.flagBox}>
                <Text style={{ fontSize: 22 }}>{flag}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { fontFamily: T.font.display }]} numberOfLines={1}>
                  Recharger {agency.name}
                </Text>
                <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
                  {agency.city ?? "—"} · Devise <Text style={{ color: "#93C5FD", fontWeight: "900" }}>{currency}</Text>
                </Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Solde actuel / nouveau solde — ✅ v2.0 (nouveau) ── */}
            <View style={s.balanceRow}>
              <View style={s.balanceCard}>
                <Text style={[s.balanceLbl, { fontFamily: T.font.sans }]}>SOLDE ACTUEL</Text>
                <Text style={[s.balanceVal, { fontFamily: T.font.mono }]} numberOfLines={1}>
                  {fmt(currentBalance, currency)}
                </Text>
              </View>
              <View style={s.balanceArrow}>
                <Ionicons name="arrow-forward" size={14} color={T.inkMuted} />
              </View>
              <View style={[s.balanceCard, isValid && s.balanceCardActive]}>
                <Text style={[s.balanceLbl, { fontFamily: T.font.sans }, isValid && { color: T.accent }]}>
                  NOUVEAU SOLDE
                </Text>
                <Text style={[
                  s.balanceVal, { fontFamily: T.font.mono },
                  isValid && { color: T.accent },
                ]} numberOfLines={1}>
                  {fmt(projectedBalance, currency)}
                </Text>
              </View>
            </View>

            {/* ── Montants rapides ── */}
            <Text style={[s.label, { fontFamily: T.font.sans, marginTop: 22 }]}>MONTANTS RAPIDES</Text>
            <View style={s.quickRow}>
              {quickAmounts.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[s.quickBtn, parsedAmount === val && s.quickBtnActive]}
                  onPress={() => setAmountStr(String(val))}
                  disabled={loading}
                  activeOpacity={0.8}
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
                <Ionicons name="information-circle-outline" size={15} color={T.accent} />
                <Text style={[s.recapTxt, { fontFamily: T.font.sans }]}>
                  {fmt(parsedAmount, currency)} {currencyLabel} seront crédités sur le wallet {currency} de {agency.name}.
                </Text>
              </View>
            )}

            {/* ── CTA — dégradé bleu marine ── */}
            <TouchableOpacity
              style={[s.confirmBtn, (!isValid || loading) && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!isValid || loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[T.navyTo, T.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.confirmGrad}
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
              </LinearGradient>
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

// ─── Styles — ✅ v2.0 ──────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(7,11,22,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    overflow: "hidden",
  },

  // ✅ v2.0 — header bleu marine (était fond blanc plat)
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  handleLight: {
    width: 36, height: 4, borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignSelf: "center", marginBottom: 14,
  },
  headerGlow: {
    position: "absolute", top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(37,99,235,0.22)",
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  flagBox: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: T.glass, borderWidth: 1, borderColor: T.glassBdr,
    justifyContent: "center", alignItems: "center",
  },
  title:    { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 3 },
  subtitle: { fontSize: 11, color: T.heroMuted, fontWeight: "600" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: T.glass, borderWidth: 1, borderColor: T.glassBdr,
    justifyContent: "center", alignItems: "center",
  },

  body:  { padding: 20 },

  // ✅ v2.0 (nouveau) — carte solde actuel / nouveau solde
  balanceRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceCard:  {
    flex: 1, backgroundColor: T.borderLt, borderRadius: T.radius.md,
    padding: 12, borderWidth: 1, borderColor: T.border,
  },
  balanceCardActive: { backgroundColor: T.accentSoft, borderColor: T.accentMd },
  balanceLbl:   { fontSize: 8, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8, marginBottom: 4 },
  balanceVal:   { fontSize: 14, fontWeight: "800", color: T.ink },
  balanceArrow: { width: 20, alignItems: "center" },

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
  quickBtnActive: { borderColor: T.accent, backgroundColor: T.accentSoft },
  quickTxt:       { fontSize: 12, fontWeight: "700", color: T.inkSub },
  quickTxtActive: { color: T.accent, fontWeight: "900" },

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
    borderColor: T.accentMd, backgroundColor: T.accentSoft,
  },
  currencyTxt: { fontSize: 13, fontWeight: "900", color: T.accent },

  recap: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginTop: 16, padding: 12,
    backgroundColor: T.accentSoft, borderRadius: T.radius.md,
    borderWidth: 1, borderColor: T.accentMd,
  },
  recapTxt: { flex: 1, fontSize: 12, color: T.accent, fontWeight: "600", lineHeight: 18 },

  confirmBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 20 },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16,
  },
  confirmTxt: { color: T.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },

  cancelRow:  { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  cancelTxt:  { fontSize: 14, fontWeight: "700", color: T.inkSub },
});