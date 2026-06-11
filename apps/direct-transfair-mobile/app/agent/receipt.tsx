// apps/direct-transfair-mobile/app/agent/receipt.tsx
// =========================================================
// REÇU AGENT v1.0 — Direct Transf'air
// ✅ Types couverts : RETRAIT · DÉPÔT · ENVOI ESPÈCES
// ✅ Prévisualisation native React Native (style Sendwave)
// ✅ Impression PDF via expo-print
// ✅ Partage (WhatsApp, email…) via expo-sharing
// ✅ HTML professionnel avec signatures, branding, mentions légales
//
// Prérequis : npx expo install expo-print expo-sharing
//
// Navigation : router.push(`/agent/receipt?data=${encodeURIComponent(JSON.stringify(receiptData))}`)
// Retour     : router.back() ou router.replace("/(tabs)")
// =========================================================

import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, Platform, Alert,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import * as Print   from "expo-print";
import * as Sharing from "expo-sharing";

const { width: SW } = Dimensions.get("window");

// ─── Types ──────────────────────────────────────────────
export type ReceiptType = "RETRAIT" | "DEPOT" | "ENVOI";

export interface ReceiptData {
  type:             ReceiptType;
  reference:        string;
  date:             string;          // ISO string

  // Montants
  amount:           number;
  currency:         string;
  fees?:            number;
  totalAmount?:     number;
  receivedAmount?:  number;          // en devise cible (retrait / envoi)
  targetCurrency?:  string;
  exchangeRate?:    number;

  // Bénéficiaire / Client
  beneficiaryName:     string;
  beneficiaryPhone?:   string;
  beneficiaryCountry?: string;

  // Expéditeur
  senderName?:     string;
  senderPhone?:    string;
  senderCountry?:  string;

  // Code de retrait
  code?:           string;

  // Agence
  agencyName?:     string;
  agentName?:      string;
}

// ─── Design ─────────────────────────────────────────────
const BLUE  = "#2563EB";
const DARK  = "#1D4ED8";
const CONCAVE_H = 40;

const C = {
  blue:        BLUE,
  dark:        DARK,
  blueBg:      "#EFF6FF",
  blueBorder:  "#DBEAFE",
  white:       "#FFFFFF",
  pageBg:      "#EFF6FF",
  cardBorder:  "#DBEAFE",
  ink:         "#0F172A",
  inkMid:      "#374151",
  inkSoft:     "#6B7280",
  green:       "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  purple:      "#8B5CF6", purpleBg: "#F5F3FF", purpleBorder: "#DDD6FE",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

// ─── Helpers ────────────────────────────────────────────
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function fmtDate(iso: string): { short: string; full: string } {
  try {
    const d = new Date(iso);
    return {
      short: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      full: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
        + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch { return { short: iso, full: iso }; }
}

function typeInfo(type: ReceiptType) {
  switch (type) {
    case "RETRAIT": return { label: "RETRAIT ESPÈCES",  icon: "arrow-up-circle",    color: "#EF4444", bg: "#FEF2F2", amtLabel: "MONTANT REMIS AU CLIENT" };
    case "DEPOT":   return { label: "DÉPÔT CLIENT",     icon: "arrow-down-circle",  color: BLUE,      bg: "#EFF6FF", amtLabel: "MONTANT CRÉDITÉ" };
    case "ENVOI":   return { label: "ENVOI ESPÈCES",    icon: "paper-plane",        color: "#8B5CF6", bg: "#F5F3FF", amtLabel: "MONTANT ENVOYÉ" };
  }
}

// ─── Arc concave ─────────────────────────────────────────
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill={C.pageBg} />
      <Path d={d} fill={BLUE} />
      <Path d={bd} fill="none" stroke="rgba(37,99,235,0.22)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── HTML Receipt Generator ──────────────────────────────
function buildHtml(d: ReceiptData): string {
  const ti   = typeInfo(d.type);
  const dt   = fmtDate(d.date);
  const isXOFLike = d.currency === "XOF" || d.currency === "GNF";

  const mainAmt  = d.type === "RETRAIT" && d.receivedAmount
    ? fmt(d.receivedAmount, d.targetCurrency ?? d.currency)
    : fmt(d.amount, d.currency);
  const mainCurr = d.type === "RETRAIT" && d.targetCurrency ? d.targetCurrency : d.currency;

  // Bloc code de retrait
  const codeHtml = d.code ? `
  <div class="code-box">
    <div class="code-label">CODE DE RETRAIT</div>
    <div class="code-value">${d.code}</div>
    <div class="code-tip">À conserver — justificatif de la transaction</div>
  </div>` : "";

  // Lignes montants
  const hasFees = d.fees !== undefined && d.type !== "DEPOT";
  const amtHtml = hasFees ? `
  <div class="amt-row">
    <span class="amt-lbl">Montant envoyé</span>
    <span class="amt-val">${fmt(d.amount, d.currency)} ${d.currency}</span>
  </div>
  <div class="amt-row">
    <span class="amt-lbl">Frais de service</span>
    <span class="amt-val">${fmt(d.fees ?? 0, d.currency)} ${d.currency}</span>
  </div>
  <div class="amt-row total">
    <span class="amt-lbl bold">Total débité</span>
    <span class="amt-val blue">${fmt(d.totalAmount ?? d.amount, d.currency)} ${d.currency}</span>
  </div>` : `
  <div class="amt-row">
    <span class="amt-lbl">Montant</span>
    <span class="amt-val blue">${fmt(d.amount, d.currency)} ${d.currency}</span>
  </div>`;

  const receivedHtml = d.receivedAmount && d.targetCurrency && d.targetCurrency !== d.currency ? `
  <div class="received-row">
    <span class="received-icon">⇄</span>
    <div>
      <div class="received-lbl">Montant reçu par le bénéficiaire</div>
      <div class="received-amt">${fmt(d.receivedAmount, d.targetCurrency)} ${d.targetCurrency}</div>
    </div>
  </div>` : "";

  const rateHtml = d.exchangeRate ? `
  <div class="amt-row">
    <span class="amt-lbl">Taux de change</span>
    <span class="amt-val mono">1 ${d.currency} = ${Number(d.exchangeRate).toFixed(isXOFLike ? 0 : 4)} ${d.targetCurrency ?? ""}</span>
  </div>` : "";

  // Section expéditeur
  const senderHtml = d.senderName ? `
  <div class="section">
    <div class="section-title purple">Expéditeur</div>
    <div class="field-row"><span class="f-lbl">Nom</span><span class="f-val">${d.senderName}</span></div>
    ${d.senderPhone   ? `<div class="field-row"><span class="f-lbl">Téléphone</span><span class="f-val mono">${d.senderPhone}</span></div>` : ""}
    ${d.senderCountry ? `<div class="field-row"><span class="f-lbl">Pays</span><span class="f-val">${d.senderCountry}</span></div>` : ""}
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reçu Direct Transf'air — ${d.reference}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;background:#fff;color:#0F172A}

/* ── Header ── */
.header{background:linear-gradient(140deg,#2563EB 0%,#1D4ED8 100%);padding:24px 22px 36px;text-align:center;position:relative}
.header::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:22px;background:#fff;border-radius:50% 50% 0 0/22px 22px 0 0}
.logo{color:#fff;font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:2px}
.logo-sub{color:rgba(255,255,255,0.6);font-size:8px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
.type-badge{display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.32);color:#fff;padding:4px 16px;border-radius:20px;font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:18px}
.amt-label{font-size:8px;letter-spacing:1.5px;color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:5px}
.amt-big{font-size:38px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1}
.amt-curr{font-size:14px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:2px;margin-top:4px}

/* ── Body ── */
.body{padding:20px 20px 0}
.meta-row{display:flex;justify-content:space-between;align-items:center;background:#F8FAFF;border:1px solid #DBEAFE;border-radius:10px;padding:12px 14px;margin-bottom:12px}
.meta-lbl{font-size:8px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
.meta-val{font-size:11px;font-weight:800;color:#0F172A;font-family:monospace}
.meta-val.sm{font-size:10px}
.status-row{text-align:center;margin-bottom:14px}
.status-badge{display:inline-block;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;padding:5px 18px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:0.5px}

/* ── Code ── */
.code-box{background:#EFF6FF;border:2px solid #2563EB;border-radius:12px;padding:18px;text-align:center;margin-bottom:16px}
.code-label{font-size:8px;font-weight:900;color:#2563EB;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.code-value{font-size:28px;font-weight:900;color:#1D4ED8;letter-spacing:6px;font-family:monospace;margin-bottom:6px}
.code-tip{font-size:9px;color:#6B7280;font-style:italic}

/* ── Section ── */
.section{margin-bottom:16px}
.section-title{font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#2563EB;border-bottom:1.5px solid #2563EB;padding-bottom:5px;margin-bottom:10px}
.section-title.purple{color:#8B5CF6;border-bottom-color:#8B5CF6}
.section-title.gray{color:#6B7280;border-bottom-color:#E5E7EB}
.field-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
.f-lbl{font-size:10px;color:#6B7280;font-weight:600;flex-shrink:0;margin-right:8px}
.f-val{font-size:11px;color:#0F172A;font-weight:700;text-align:right}
.f-val.mono{font-family:monospace}

/* ── Amounts ── */
.amounts-card{background:#F8FAFF;border:1px solid #DBEAFE;border-radius:10px;padding:14px;margin-bottom:14px}
.amt-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.amt-row:last-child{margin-bottom:0}
.amt-row.total{border-top:1px solid #DBEAFE;margin-top:8px;padding-top:8px}
.amt-lbl{font-size:10px;color:#6B7280;font-weight:600}
.amt-lbl.bold{font-weight:900;color:#0F172A}
.amt-val{font-size:11px;color:#0F172A;font-weight:800;font-family:monospace}
.amt-val.blue{color:#2563EB;font-size:14px;font-weight:900}
.amt-val.mono{font-family:monospace;font-size:10px}
.received-row{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;margin-top:10px}
.received-icon{font-size:16px}
.received-lbl{font-size:8px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
.received-amt{font-size:15px;font-weight:900;color:#065F46;font-family:monospace}

/* ── Signatures ── */
.sig-area{display:flex;justify-content:space-between;margin:24px 0 16px}
.sig-box{width:44%;text-align:center}
.sig-line{border-top:1px solid #0F172A;margin-top:36px;margin-bottom:6px}
.sig-lbl{font-size:9px;color:#6B7280;font-weight:600}

/* ── Footer ── */
.footer{background:#F8FAFF;border-top:2px solid #DBEAFE;padding:16px 20px}
.f-logo{font-size:12px;font-weight:900;color:#2563EB;letter-spacing:2px;margin-bottom:5px}
.f-legal{font-size:8px;color:#9CA3AF;line-height:1.6;margin-bottom:10px}
.f-ref{font-size:8px;color:#9CA3AF;text-align:center;border-top:1px dashed #DBEAFE;padding-top:8px;font-style:italic}
@media print{.no-print{display:none}}
</style>
</head>
<body>

<div class="header">
  <div class="logo">DIRECT TRANSF'AIR</div>
  <div class="logo-sub">Transfert d'argent international</div>
  <div class="type-badge">${ti.label}</div>
  <div class="amt-label">${ti.amtLabel}</div>
  <div class="amt-big">${mainAmt}</div>
  <div class="amt-curr">${mainCurr}</div>
</div>

<div class="body">

  <div class="meta-row">
    <div>
      <div class="meta-lbl">Référence</div>
      <div class="meta-val">${d.reference}</div>
    </div>
    <div style="text-align:right">
      <div class="meta-lbl">Date &amp; Heure</div>
      <div class="meta-val sm">${dt.full}</div>
    </div>
  </div>

  <div class="status-row">
    <span class="status-badge">✓ TRANSACTION VALIDÉE</span>
  </div>

  ${codeHtml}

  <div class="section">
    <div class="section-title">Détails financiers</div>
    <div class="amounts-card">
      ${amtHtml}
      ${rateHtml}
      ${receivedHtml}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bénéficiaire</div>
    <div class="field-row"><span class="f-lbl">Nom complet</span><span class="f-val">${d.beneficiaryName}</span></div>
    ${d.beneficiaryPhone   ? `<div class="field-row"><span class="f-lbl">Téléphone</span><span class="f-val mono">${d.beneficiaryPhone}</span></div>` : ""}
    ${d.beneficiaryCountry ? `<div class="field-row"><span class="f-lbl">Pays</span><span class="f-val">${d.beneficiaryCountry}</span></div>` : ""}
  </div>

  ${senderHtml}

  <div class="section">
    <div class="section-title gray">Agence émettrice</div>
    <div class="field-row"><span class="f-lbl">Agence</span><span class="f-val">${d.agencyName ?? "—"}</span></div>
    <div class="field-row"><span class="f-lbl">Agent</span><span class="f-val">${d.agentName ?? "—"}</span></div>
  </div>

  <div class="sig-area">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Signature Agent</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Signature Client</div>
    </div>
  </div>

</div>

<div class="footer">
  <div class="f-logo">DIRECT TRANSF'AIR</div>
  <div class="f-legal">
    Ce reçu constitue une preuve officielle d'exécution de la transaction indiquée ci-dessus.
    Conservez ce document précieusement. Pour toute réclamation, contactez votre agence
    Direct Transf'air dans les 48 heures suivant la transaction. Direct Transf'air décline
    toute responsabilité en cas de perte ou d'utilisation frauduleuse de ce document.
  </div>
  <div class="f-ref">Réf. ${d.reference} · ${dt.short}</div>
</div>

</body>
</html>`;
}

// ─── Mini-composants natifs ──────────────────────────────
function ReceiptRow({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <View style={rr.row}>
      <Text style={[rr.label, { fontFamily: C.font.sans }]}>{label}</Text>
      <Text style={[
        rr.value,
        { fontFamily: mono ? C.font.mono : C.font.sans },
        highlight && { color: BLUE, fontSize: 15, fontWeight: "800" as any },
      ]}>
        {value}
      </Text>
    </View>
  );
}
const rr = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 },
  label: { fontSize: 11, color: C.inkSoft, fontWeight: "600", flex: 1, marginRight: 8 },
  value: { fontSize: 12, color: C.ink, fontWeight: "700", textAlign: "right", flex: 2 },
});

function Sect({ title, color = BLUE, children }: {
  title: string; color?: string; children: React.ReactNode;
}) {
  return (
    <View style={ss.wrap}>
      <View style={[ss.bar, { borderBottomColor: color }]}>
        <Text style={[ss.title, { color, fontFamily: C.font.sans }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
const ss = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  bar:   { borderBottomWidth: 1.5, paddingBottom: 5, marginBottom: 10 },
  title: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Écran principal ─────────────────────────────────────
export default function AgentReceiptScreen() {
  const router = useRouter();
  const { data: raw } = useLocalSearchParams<{ data: string }>();

  const data: ReceiptData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(raw ?? "null")); }
    catch { return null; }
  }, [raw]);

  // ── Impression PDF ──
  const handlePrint = useCallback(async () => {
    if (!data) return;
    try {
      await Print.printAsync({ html: buildHtml(data) });
    } catch {
      Alert.alert("Erreur", "Impossible d'imprimer le reçu.");
    }
  }, [data]);

  // ── Partage PDF ──
  const handleShare = useCallback(async () => {
    if (!data) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(data) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        Alert.alert("Non disponible", "Le partage n'est pas disponible sur cet appareil.");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de générer le PDF.");
    }
  }, [data]);

  // ── Données invalides ──
  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={56} color={C.inkSoft} />
          <Text style={[s.errTxt, { fontFamily: C.font.sans }]}>Données du reçu introuvables</Text>
          <TouchableOpacity style={s.errBtn} onPress={() => router.back()}>
            <Text style={[s.errBtnTxt, { fontFamily: C.font.sans }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ti       = typeInfo(data.type);
  const dt       = fmtDate(data.date);
  const mainAmt  = data.type === "RETRAIT" && data.receivedAmount
    ? fmt(data.receivedAmount, data.targetCurrency ?? data.currency)
    : fmt(data.amount, data.currency);
  const mainCurr = data.type === "RETRAIT" && data.targetCurrency ? data.targetCurrency : data.currency;
  const hasFees  = data.fees !== undefined && data.type !== "DEPOT";

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ══ Héro bleu ══ */}
      <View style={s.hero}>
        {/* Glow */}
        <View style={s.glow} />

        {/* Ligne haut : fermer + label + badge type */}
        <View style={s.heroTop}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={[s.heroLabel, { fontFamily: C.font.sans }]}>REÇU DE TRANSACTION</Text>
          <View style={[s.typeBadge, { backgroundColor: ti.bg }]}>
            <Text style={[s.typeBadgeTxt, { color: ti.color, fontFamily: C.font.sans }]}>{ti.label}</Text>
          </View>
        </View>

        {/* Montant */}
        <View style={s.heroAmt}>
          <Text style={[s.heroAmtLabel, { fontFamily: C.font.sans }]}>{ti.amtLabel}</Text>
          <Text style={[s.heroAmtValue, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
            {mainAmt}
          </Text>
          <Text style={[s.heroAmtCurr, { fontFamily: C.font.mono }]}>{mainCurr}</Text>
        </View>

        {/* Statut */}
        <View style={s.statusPill}>
          <Ionicons name="checkmark-circle" size={14} color={C.green} />
          <Text style={[s.statusTxt, { fontFamily: C.font.sans }]}>TRANSACTION VALIDÉE</Text>
        </View>
      </View>

      <HeroConcave />

      {/* ══ Contenu scrollable ══ */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Référence + date */}
        <View style={s.refCard}>
          <View style={{ flex: 1 }}>
            <Text style={[s.metaLbl, { fontFamily: C.font.sans }]}>Référence</Text>
            <Text style={[s.metaVal, { fontFamily: C.font.mono }]}>{data.reference}</Text>
          </View>
          <View style={s.refDivider} />
          <View style={{ flex: 1.6, alignItems: "flex-end" }}>
            <Text style={[s.metaLbl, { fontFamily: C.font.sans }]}>Date & Heure</Text>
            <Text style={[s.metaVal, { fontFamily: C.font.sans, fontSize: 10 }]}>{dt.full}</Text>
          </View>
        </View>

        {/* Code de retrait */}
        {data.code && (
          <View style={s.codeCard}>
            <Ionicons name="qr-code-outline" size={16} color={BLUE} style={{ marginBottom: 6 }} />
            <Text style={[s.codeLbl, { fontFamily: C.font.sans }]}>CODE DE RETRAIT</Text>
            <Text style={[s.codeVal, { fontFamily: C.font.mono }]}>{data.code}</Text>
            <Text style={[s.codeTip, { fontFamily: C.font.sans }]}>
              À conserver — justificatif de la transaction
            </Text>
          </View>
        )}

        {/* Montants */}
        <View style={s.card}>
          <Sect title="Détails financiers">
            {hasFees ? (
              <>
                <ReceiptRow label="Montant envoyé" value={`${fmt(data.amount, data.currency)} ${data.currency}`} />
                <ReceiptRow label="Frais de service" value={`${fmt(data.fees ?? 0, data.currency)} ${data.currency}`} />
                <View style={s.totalRow}>
                  <Text style={[s.totalLbl, { fontFamily: C.font.sans }]}>Total débité</Text>
                  <Text style={[s.totalVal, { fontFamily: C.font.serif }]}>
                    {fmt(data.totalAmount ?? data.amount, data.currency)} {data.currency}
                  </Text>
                </View>
              </>
            ) : (
              <ReceiptRow label="Montant" value={`${fmt(data.amount, data.currency)} ${data.currency}`} highlight />
            )}
            {data.exchangeRate && (
              <ReceiptRow
                label="Taux de change"
                value={`1 ${data.currency} = ${Number(data.exchangeRate).toFixed(2)} ${data.targetCurrency ?? ""}`}
                mono
              />
            )}
          </Sect>

          {/* Montant reçu (conversion) */}
          {data.receivedAmount && data.targetCurrency && data.targetCurrency !== data.currency && (
            <View style={s.receivedBox}>
              <View style={s.receivedIcon}>
                <Ionicons name="swap-horizontal" size={14} color={C.green} />
              </View>
              <View>
                <Text style={[s.receivedLbl, { fontFamily: C.font.sans }]}>Montant reçu par le bénéficiaire</Text>
                <Text style={[s.receivedAmt, { fontFamily: C.font.serif }]}>
                  {fmt(data.receivedAmount, data.targetCurrency)} {data.targetCurrency}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Bénéficiaire */}
        <View style={s.card}>
          <Sect title="Bénéficiaire" color={BLUE}>
            <ReceiptRow label="Nom complet" value={data.beneficiaryName} />
            {data.beneficiaryPhone   && <ReceiptRow label="Téléphone" value={data.beneficiaryPhone} mono />}
            {data.beneficiaryCountry && <ReceiptRow label="Pays" value={data.beneficiaryCountry} />}
          </Sect>
        </View>

        {/* Expéditeur */}
        {data.senderName && (
          <View style={s.card}>
            <Sect title="Expéditeur" color={C.purple}>
              <ReceiptRow label="Nom" value={data.senderName} />
              {data.senderPhone   && <ReceiptRow label="Téléphone" value={data.senderPhone} mono />}
              {data.senderCountry && <ReceiptRow label="Pays" value={data.senderCountry} />}
            </Sect>
          </View>
        )}

        {/* Agence */}
        <View style={s.card}>
          <Sect title="Agence émettrice" color={C.inkSoft}>
            <ReceiptRow label="Agence" value={data.agencyName ?? "—"} />
            <ReceiptRow label="Agent"  value={data.agentName  ?? "—"} />
          </Sect>
        </View>

        {/* Signatures */}
        <View style={s.sigArea}>
          <View style={s.sigBox}>
            <View style={s.sigLine} />
            <Text style={[s.sigLbl, { fontFamily: C.font.sans }]}>Signature Agent</Text>
          </View>
          <View style={s.sigBox}>
            <View style={s.sigLine} />
            <Text style={[s.sigLbl, { fontFamily: C.font.sans }]}>Signature Client</Text>
          </View>
        </View>

        {/* Mention légale */}
        <Text style={[s.legal, { fontFamily: C.font.sans }]}>
          Ce reçu constitue une preuve officielle d'exécution de la transaction ci-dessus.
          Pour toute réclamation, contactez votre agence dans les 48 heures.
        </Text>

        {/* Branding pied */}
        <View style={s.brandFoot}>
          <Text style={[s.brandLogo, { fontFamily: C.font.sans }]}>DIRECT TRANSF'AIR</Text>
          <Text style={[s.brandSub,  { fontFamily: C.font.sans }]}>Transfert d'argent international</Text>
          <Text style={[s.brandRef,  { fontFamily: C.font.mono  }]}>Réf. {data.reference} · {dt.short}</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ══ Barre actions fixe ══ */}
      <View style={s.footer}>
        <TouchableOpacity style={[s.footBtn, s.shareBtn]} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={BLUE} />
          <Text style={[s.shareTxt, { fontFamily: C.font.sans }]}>Partager PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.footBtn, s.printBtn]} onPress={handlePrint} activeOpacity={0.88}>
          <Ionicons name="print-outline" size={18} color="#fff" />
          <Text style={[s.printTxt, { fontFamily: C.font.sans }]}>Imprimer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // Erreur
  errTxt:    { fontSize: 15, color: C.inkSoft, marginTop: 14, fontWeight: "600", textAlign: "center" },
  errBtn:    { marginTop: 18, paddingVertical: 10, paddingHorizontal: 28, backgroundColor: C.blueBg, borderRadius: 12, borderWidth: 1, borderColor: BLUE },
  errBtnTxt: { color: BLUE, fontWeight: "700", fontSize: 14 },

  // ── Héro ──
  hero: {
    backgroundColor: BLUE,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 32 : 6,
    paddingBottom: 16,
    overflow: "hidden",
  },
  glow: {
    position: "absolute", top: -50, right: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroTop:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBtn:      { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", justifyContent: "center", alignItems: "center" },
  heroLabel:    { flex: 1, color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  typeBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  typeBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  heroAmt:      { alignItems: "center", marginBottom: 12 },
  heroAmtLabel: { fontSize: 8, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 },
  heroAmtValue: { fontSize: 42, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  heroAmtCurr:  { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.8)", marginTop: 4, letterSpacing: 2 },

  statusPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  statusTxt:  { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  // ── Scroll ──
  scroll: { paddingHorizontal: 18, paddingTop: 14 },

  // Ref card
  refCard:    { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: C.r.md, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  refDivider: { width: 1, height: 34, backgroundColor: C.cardBorder, marginHorizontal: 13 },
  metaLbl:    { fontSize: 8, fontWeight: "700", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  metaVal:    { fontSize: 12, fontWeight: "800", color: C.ink },

  // Code card
  codeCard: { backgroundColor: C.blueBg, borderRadius: C.r.md, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: BLUE, alignItems: "center" },
  codeLbl:  { fontSize: 8, fontWeight: "900", color: BLUE, letterSpacing: 2, textTransform: "uppercase", marginBottom: 9 },
  codeVal:  { fontSize: 30, fontWeight: "900", color: DARK, letterSpacing: 6, marginBottom: 6 },
  codeTip:  { fontSize: 10, color: C.inkSoft, textAlign: "center" },

  // Card générique
  card: { backgroundColor: C.white, borderRadius: C.r.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder, shadowColor: BLUE, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },

  // Total
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.cardBorder, marginTop: 8, paddingTop: 10 },
  totalLbl: { fontSize: 12, fontWeight: "900", color: C.ink },
  totalVal: { fontSize: 18, fontWeight: "900", color: BLUE },

  // Received
  receivedBox:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.greenBg, borderRadius: 10, padding: 11, marginTop: 10, borderWidth: 1, borderColor: C.greenBorder },
  receivedIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center" },
  receivedLbl:  { fontSize: 9, color: C.inkSoft, fontWeight: "600", marginBottom: 2 },
  receivedAmt:  { fontSize: 16, fontWeight: "900", color: C.greenDark },

  // Signatures
  sigArea: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.white, borderRadius: C.r.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  sigBox:  { width: "44%", alignItems: "center" },
  sigLine: { width: "100%", height: 1, backgroundColor: C.ink, marginTop: 38, marginBottom: 6 },
  sigLbl:  { fontSize: 9, color: C.inkSoft, fontWeight: "600" },

  // Légal + branding
  legal:     { fontSize: 10, color: C.inkSoft, lineHeight: 16, textAlign: "center", paddingHorizontal: 6, marginBottom: 16 },
  brandFoot: { alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.cardBorder },
  brandLogo: { fontSize: 13, fontWeight: "900", color: BLUE, letterSpacing: 2.5, marginBottom: 2 },
  brandSub:  { fontSize: 9, color: C.inkSoft, letterSpacing: 1, marginBottom: 5 },
  brandRef:  { fontSize: 9, color: C.inkSoft },

  // ── Footer fixe ──
  footer:   { flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 12, paddingBottom: Platform.OS === "ios" ? 26 : 12, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.cardBorder },
  footBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: C.r.md },
  shareBtn: { backgroundColor: C.blueBg, borderWidth: 1.5, borderColor: BLUE },
  printBtn: { backgroundColor: BLUE },
  shareTxt: { color: BLUE, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
  printTxt: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});