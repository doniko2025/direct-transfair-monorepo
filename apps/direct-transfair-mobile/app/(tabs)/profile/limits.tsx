// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// =========================================================
// LIMITS SCREEN v6.2 — Direct Transf'air
// ✅ v6.1 : fetch brut → api.http (x-tenant-id automatique)
// ✅ v6.2 :
//   - useSafeAreaInsets : paddingBottom du ScrollView = inset natif + 90
//     → la barre de navigation inférieure ne masque plus le contenu
//   - Bouton "Demander une augmentation" : modal bottom sheet inline
//     → champ motif + appel POST /limits/request (à créer côté backend)
// =========================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ✅ v6.2
import { api } from "../../../services/api";

// ─── Tokens de design ────────────────────────────────────────────────────────
const T = {
  bg: "#F0FDF4", accent: "#16A34A", accentLight: "#DCFCE7",
  white: "#FFFFFF", cardBg: "#FFFFFF", border: "#E5E8EF", borderLight: "#EFF1F5",
  text: "#111827", textSub: "#6B7280", textMuted: "#9CA3AF",
  blue: "#2563EB", blueBg: "#DBEAFE", amber: "#D97706",
  purple: "#7C3AED", purpleBg: "#EDE9FE", red: "#DC2626",
  radius: { md: 12, lg: 16, xl: 20 },
  shadow: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────
type LimitEntry = { used: number; max: number };
type LimitsData = {
  currency: string; kycLevel: string; kycLabel: string;
  limits: { daily: LimitEntry; monthly: LimitEntry; yearly: LimitEntry };
};

// ─── Utilitaire de formatage ──────────────────────────────────────────────────
function fmt(n: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

// ─── Carte de plafond ─────────────────────────────────────────────────────────
function LimitCard({ title, period, used, max, currency, color, colorBg }: {
  title: string; period: string; used: number; max: number;
  currency: string; color: string; colorBg: string;
}) {
  const pct       = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const remaining = max - used;
  const isDanger  = pct > 90;
  const isWarning = pct > 70;
  const barColor  = isDanger ? T.red : isWarning ? T.amber : color;

  return (
    <View style={[lcS.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={lcS.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[lcS.period, { fontFamily: T.font.sans }]}>{period}</Text>
          <Text style={[lcS.title,  { fontFamily: T.font.display }]}>{title}</Text>
        </View>
        <View style={[lcS.badge, { backgroundColor: colorBg }]}>
          <Text style={[lcS.badgeTxt, { color, fontFamily: T.font.mono }]}>{pct.toFixed(0)}%</Text>
        </View>
      </View>
      <View style={lcS.amountRow}>
        <Text
          style={[lcS.used, { color, fontFamily: T.font.display }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {fmt(used, currency)}
        </Text>
        <Text style={[lcS.slash, { fontFamily: T.font.sans }]}>/</Text>
        <Text style={[lcS.max, { fontFamily: T.font.mono }]}>{fmt(max, currency)}</Text>
      </View>
      <View style={lcS.progBg}>
        <View style={[lcS.progFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <View style={lcS.footRow}>
        <Ionicons
          name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"}
          size={13}
          color={isDanger ? T.red : T.textMuted}
        />
        <Text style={[lcS.remaining, { color: isDanger ? T.red : T.textSub, fontFamily: T.font.sans }]}>
          {fmt(remaining, currency)} restant{isDanger ? " · Limite presque atteinte" : ""}
        </Text>
      </View>
    </View>
  );
}

const lcS = StyleSheet.create({
  card:      { backgroundColor: T.cardBg, borderRadius: T.radius.lg, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: T.border, ...T.shadow },
  topRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  period:    { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 3, color: T.textMuted },
  title:     { color: T.text, fontSize: 17, fontWeight: "700" },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt:  { fontSize: 12, fontWeight: "800" },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 12 },
  used:      { fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  slash:     { color: T.textMuted, fontSize: 16 },
  max:       { color: T.textSub, fontSize: 14, fontWeight: "700" },
  progBg:    { height: 5, backgroundColor: T.borderLight, borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  progFill:  { height: 5, borderRadius: 99 },
  footRow:   { flexDirection: "row", alignItems: "center", gap: 5 },
  remaining: { fontSize: 11, fontWeight: "600" },
});

// ─── Constantes KYC ──────────────────────────────────────────────────────────
const KYC_COLOR: Record<string, string> = {
  LEVEL_0: T.amber, LEVEL_1: T.accent, LEVEL_2: T.blue, LEVEL_3: T.purple,
};
const KYC_BG: Record<string, string> = {
  LEVEL_0: "#FEF3C7", LEVEL_1: T.accentLight, LEVEL_2: T.blueBg, LEVEL_3: T.purpleBg,
};

// ─── Modal demande d'augmentation ─────────────────────────────────────────────
// ✅ v6.2 : bottom sheet inline — appelle POST /limits/request (à créer backend)
function RequestLimitModal({
  visible, onClose, currency,
}: {
  visible: boolean; onClose: () => void; currency: string;
}) {
  const { bottom } = useSafeAreaInsets();

  const [reason,     setReason]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleClose = () => {
    setReason(""); setSuccess(false); setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Veuillez préciser la raison de votre demande.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      // 📌 Backend : créer POST /limits/request dans LimitsController / LimitsService
      await api.http.post("/limits/request", { reason: reason.trim() });
      setSuccess(true);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Erreur lors de l'envoi";
      setError(Array.isArray(raw) ? raw[0] : String(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={mS.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Fond semi-transparent cliquable pour fermer */}
        <TouchableOpacity style={mS.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[mS.sheet, { paddingBottom: (bottom || 0) + 20 }]}>
          {/* Poignée */}
          <View style={mS.handle} />

          {success ? (
            /* ── État succès ────────────────────────────────────── */
            <View style={mS.successBox}>
              <Ionicons name="checkmark-circle" size={52} color={T.accent} />
              <Text style={[mS.successTitle, { fontFamily: T.font.display }]}>Demande envoyée</Text>
              <Text style={[mS.successSub, { fontFamily: T.font.sans }]}>
                Votre demande a été transmise. Nous vous répondrons dans les plus brefs délais.
              </Text>
              <TouchableOpacity
                style={[mS.btn, { backgroundColor: T.accent, alignSelf: "stretch" }]}
                onPress={handleClose}
                activeOpacity={0.85}
              >
                <Text style={[mS.btnTxt, { fontFamily: T.font.sans }]}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Formulaire ─────────────────────────────────────── */
            <>
              <View style={mS.headerRow}>
                <View style={[mS.iconBox, { backgroundColor: T.accentLight }]}>
                  <Ionicons name="trending-up-outline" size={20} color={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mS.sheetTitle, { fontFamily: T.font.display }]}>
                    Augmenter mes plafonds
                  </Text>
                  <Text style={[mS.sheetSub, { fontFamily: T.font.sans }]}>
                    Demande soumise à validation
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose} hitSlop={12}>
                  <Ionicons name="close-circle-outline" size={26} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[mS.label, { fontFamily: T.font.sans }]}>MOTIF DE LA DEMANDE</Text>
              <TextInput
                style={[mS.input, { fontFamily: T.font.sans }]}
                multiline
                numberOfLines={4}
                placeholder="Ex. : augmentation d'activité, virements professionnels réguliers…"
                placeholderTextColor={T.textMuted}
                value={reason}
                onChangeText={setReason}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={[mS.counter, { fontFamily: T.font.mono }]}>{reason.length} / 500</Text>

              {!!error && (
                <View style={mS.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={T.red} />
                  <Text style={[mS.errorTxt, { fontFamily: T.font.sans }]}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[mS.btn, { backgroundColor: submitting ? T.textMuted : T.accent }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={T.white} />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={16} color={T.white} />
                    <Text style={[mS.btnTxt, { fontFamily: T.font.sans }]}>Envoyer la demande</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mS = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: "flex-end" },
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:        {
    backgroundColor: T.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  handle:       { width: 40, height: 4, backgroundColor: T.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 },
  headerRow:    { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  iconBox:      { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  sheetTitle:   { color: T.text, fontSize: 16, fontWeight: "700" },
  sheetSub:     { color: T.textSub, fontSize: 11, fontWeight: "600", marginTop: 2 },
  label:        { fontSize: 9, fontWeight: "800", color: T.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  input:        {
    backgroundColor: T.bg, borderRadius: T.radius.md, borderWidth: 1,
    borderColor: T.border, padding: 14, fontSize: 13, color: T.text,
    minHeight: 100, marginBottom: 6,
  },
  counter:      { fontSize: 10, color: T.textMuted, textAlign: "right", marginBottom: 16 },
  errorRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  errorTxt:     { color: T.red, fontSize: 12, fontWeight: "600", flex: 1 },
  btn:          {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: T.radius.md, marginTop: 4,
  },
  btnTxt:       { color: T.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 },
  successBox:   { alignItems: "center", paddingVertical: 24, gap: 12 },
  successTitle: { color: T.text, fontSize: 20, fontWeight: "700" },
  successSub:   { color: T.textSub, fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function LimitsScreen() {
  const router     = useRouter();
  const { bottom } = useSafeAreaInsets(); // ✅ v6.2

  const [data,      setData]      = useState<LimitsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false); // ✅ v6.2

  // ✅ v6.1 : api.http.get ajoute automatiquement x-tenant-id
  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.http.get<LimitsData>("/limits");
      setData(res.data);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Impossible de charger les plafonds";
      setError(Array.isArray(raw) ? raw[0] : String(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLimits(); }, [fetchLimits]);

  const kycColor = data ? (KYC_COLOR[data.kycLevel] ?? T.accent)      : T.accent;
  const kycBg    = data ? (KYC_BG[data.kycLevel]    ?? T.accentLight) : T.accentLight;

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        {/* ── En-tête ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mes Plafonds</Text>
            <Text style={[s.headerSub,   { color: T.accent, fontFamily: T.font.sans }]}>
              Transferts & virements
            </Text>
          </View>
        </View>

        {/* ── États ──────────────────────────────────────────────── */}
        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={T.accent} />
          </View>
        ) : error ? (
          <View style={s.loader}>
            <Ionicons name="alert-circle-outline" size={36} color={T.red} />
            <Text style={[s.errorTxt, { fontFamily: T.font.sans }]}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={fetchLimits}>
              <Text style={[s.retryTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <ScrollView
            // ✅ v6.2 : paddingBottom = inset natif + 90 → plus de masquage par la tab bar
            //           remplace l'ancien spacer <View style={{ height: 80 }} /> fixe
            contentContainerStyle={[s.scroll, { paddingBottom: (bottom || 0) + 90 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Bandeau réglementaire */}
            <View style={s.infoBanner}>
              <View style={[s.infoIconBox, { backgroundColor: T.blueBg }]}>
                <Ionicons name="information-circle-outline" size={18} color={T.blue} />
              </View>
              <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
                Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation en vigueur.
              </Text>
            </View>

            {/* Carte KYC */}
            <View style={s.kycCard}>
              <View style={s.kycRow}>
                <View style={[s.kycIconBox, { backgroundColor: kycBg }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={kycColor} />
                </View>
                <View>
                  <Text style={[s.kycLabel, { fontFamily: T.font.sans }]}>NIVEAU DE VÉRIFICATION</Text>
                  <Text style={[s.kycValue, { color: kycColor, fontFamily: T.font.display }]}>
                    {data.kycLabel}
                  </Text>
                </View>
              </View>
              <View style={s.kycHintRow}>
                <Ionicons name="arrow-up-circle-outline" size={13} color={T.textMuted} />
                <Text style={[s.kycHint, { fontFamily: T.font.sans }]}>
                  Complétez votre vérification pour augmenter vos plafonds
                </Text>
              </View>
            </View>

            {/* Titre section */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>PLAFONDS ACTIFS</Text>
            </View>

            {/* Cartes de plafond */}
            <LimitCard
              title="Plafond Journalier" period="AUJOURD'HUI"
              {...data.limits.daily}   currency={data.currency}
              color={T.accent} colorBg={T.accentLight}
            />
            <LimitCard
              title="Plafond Mensuel" period="CE MOIS"
              {...data.limits.monthly} currency={data.currency}
              color={T.blue}   colorBg={T.blueBg}
            />
            <LimitCard
              title="Plafond Annuel" period="CETTE ANNÉE"
              {...data.limits.yearly}  currency={data.currency}
              color={T.purple} colorBg={T.purpleBg}
            />

            {/* ✅ v6.2 : onPress câblé → ouvre le modal */}
            <TouchableOpacity
              style={[s.requestBtn, { backgroundColor: T.accent }]}
              activeOpacity={0.85}
              onPress={() => setShowModal(true)}
            >
              <Ionicons name="trending-up-outline" size={17} color={T.white} />
              <Text style={[s.requestTxt, { fontFamily: T.font.sans }]}>Demander une augmentation</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </SafeAreaView>

      {/* ✅ v6.2 : modal hors SafeAreaView pour couvrir tout l'écran */}
      <RequestLimitModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        currency={data?.currency ?? "EUR"}
      />
    </View>
  );
}

// ─── Styles de l'écran principal ─────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn:     {
    width: 40, height: 40, borderRadius: T.radius.md, backgroundColor: T.cardBg,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  headerTitle: { color: T.text, fontSize: 22, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  loader:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorTxt:    { color: T.textSub, fontSize: 14, fontWeight: "600", textAlign: "center", paddingHorizontal: 40 },
  retryBtn:    { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: T.accentLight, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.accent },
  retryTxt:    { color: T.accent, fontWeight: "800", fontSize: 13 },
  scroll:      { paddingHorizontal: 20, paddingTop: 8 },
  infoBanner:  {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.blueBg, borderRadius: T.radius.md, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 14,
  },
  infoIconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", marginTop: 1 },
  infoTxt:     { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  kycCard:     {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  kycRow:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  kycIconBox:  { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kycLabel:    { fontSize: 9, fontWeight: "800", color: T.textMuted, letterSpacing: 1.2, marginBottom: 2 },
  kycValue:    { fontSize: 15, fontWeight: "700" },
  kycHintRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  kycHint:     { color: T.textSub, fontSize: 11, fontWeight: "600" },
  sectionRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot:  { width: 5, height: 5, borderRadius: 99 },
  sectionLabel:{ fontSize: 11, fontWeight: "800", color: T.textMuted, letterSpacing: 1.5 },
  requestBtn:  {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: T.radius.md, marginTop: 8,
  },
  requestTxt:  { color: T.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 },
});