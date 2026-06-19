// apps/direct-transfair-mobile/app/agent/receipt.tsx
// =========================================================
// REÇU AGENT v2.1 — Direct Transf'air
// ✅ v1.0 : types RETRAIT / DÉPÔT / ENVOI, PDF, partage
// ✅ v2.0 : Refonte complète style Sendwave
// ✅ v2.1 : PUREMENT PRÉSENTATIONNEL — logique métier inchangée
//   - Écran natif : espacement compact (paddingVertical rows
//     11→8, amtBlock 28/24→16/12, section titles 18→10,
//     codeBox 18→12, sigArea 24→16, footer 20→12)
//   - PDF buildHtml : suppression du héro bleu dégradé.
//     Nouveau header blanc pur : logo en encre foncée, badge
//     type en gris neutre, montant en texte sombre — même
//     style minimaliste que l'écran natif. Le reste du PDF
//     (meta-row, code, sections, signatures, footer) est
//     strictement inchangé.
// =========================================================

import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, Platform, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print   from "expo-print";
import * as Sharing from "expo-sharing";

// ─── Types ────────────────────────────────────────────────
export type ReceiptType = "RETRAIT" | "DEPOT" | "ENVOI";

export interface ReceiptData {
  type:              ReceiptType;
  reference:         string;
  date:              string;
  amount:            number;
  currency:          string;
  fees?:             number;
  totalAmount?:      number;
  receivedAmount?:   number;
  targetCurrency?:   string;
  exchangeRate?:     number;
  beneficiaryName:   string;
  beneficiaryPhone?: string;
  beneficiaryCountry?: string;
  senderName?:       string;
  senderPhone?:      string;
  senderCountry?:    string;
  code?:             string;
  agencyName?:       string;
  agentName?:        string;
}

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg:         "#FFFFFF",
  surface:    "#FFFFFF",
  ink:        "#0F172A",
  inkSub:     "#475569",
  inkMuted:   "#94A3B8",
  divider:    "#F1F5F9",
  dividerMd:  "#E2E8F0",
  codeBg:     "#F8FAFF",
  codeBorder: "#CBD5E1",
  green:      "#059669",
  greenBg:    "#DCFCE7",
  greenText:  "#065F46",
  blue:       "#2563EB",
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers — 100 % inchangés ───────────────────────────
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function fmtDate(iso: string): { short: string; full: string; day: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      short: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      full:  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long",    year: "numeric" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      day:   d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long",    year: "numeric" }),
      time:  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch { return { short: iso, full: iso, day: iso, time: "" }; }
}

function typeInfo(type: ReceiptType) {
  switch (type) {
    case "RETRAIT": return { label: "Retrait espèces",  icon: "arrow-up-circle-outline",   amtLabel: "Montant remis" };
    case "DEPOT":   return { label: "Dépôt client",     icon: "arrow-down-circle-outline",  amtLabel: "Montant crédité" };
    case "ENVOI":   return { label: "Envoi espèces",    icon: "paper-plane-outline",        amtLabel: "Montant envoyé" };
  }
}

// ─── Composants UI minimalistes ───────────────────────────
function Row({ label, value, mono, bold, top }: {
  label: string; value: string; mono?: boolean; bold?: boolean; top?: boolean;
}) {
  return (
    <View style={[ro.row, top && { borderTopWidth: 1, borderTopColor: T.divider, marginTop: 0, paddingTop: 8 }]}>
      <Text style={[ro.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[ro.value, { fontFamily: mono ? T.font.mono : T.font.sans }, bold && ro.bold]}>
        {value}
      </Text>
    </View>
  );
}
const ro = StyleSheet.create({
  // ✅ v2.1 : paddingVertical 11 → 8
  row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.divider },
  label: { fontSize: 13, color: T.inkSub, fontWeight: "500", flex: 1 },
  value: { fontSize: 13, color: T.ink,    fontWeight: "600", textAlign: "right", flex: 2 },
  bold:  { fontWeight: "800", color: T.ink, fontSize: 14 },
});

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[st.txt, { fontFamily: T.font.sans }]}>{children}</Text>
  );
}
const st = StyleSheet.create({
  // ✅ v2.1 : paddingTop 18 → 10, paddingBottom 4 → 2
  txt: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.5, textTransform: "uppercase", paddingTop: 10, paddingBottom: 2 },
});

// ─── HTML receipt — ✅ v2.1 : héro blanc pur (sans bleu) ─
function buildHtml(d: ReceiptData): string {
  const ti   = typeInfo(d.type);
  const dt   = fmtDate(d.date);
  const mainAmt  = d.type === "RETRAIT" && d.receivedAmount ? fmt(d.receivedAmount, d.targetCurrency ?? d.currency) : fmt(d.amount, d.currency);
  const mainCurr = d.type === "RETRAIT" && d.targetCurrency ? d.targetCurrency : d.currency;
  const hasFees  = d.fees !== undefined && d.type !== "DEPOT";

  const codeHtml = d.code ? `
  <div class="code-box">
    <div class="code-label">CODE DE RETRAIT</div>
    <div class="code-value">${d.code}</div>
    <div class="code-tip">À conserver — justificatif de la transaction</div>
  </div>` : "";

  const amtHtml = hasFees ? `
  <div class="amt-row"><span class="amt-lbl">Montant envoyé</span><span class="amt-val">${fmt(d.amount, d.currency)} ${d.currency}</span></div>
  <div class="amt-row"><span class="amt-lbl">Frais de service</span><span class="amt-val">${fmt(d.fees ?? 0, d.currency)} ${d.currency}</span></div>
  <div class="amt-row total"><span class="amt-lbl bold">Total débité</span><span class="amt-val highlight">${fmt(d.totalAmount ?? d.amount, d.currency)} ${d.currency}</span></div>`
  : `<div class="amt-row"><span class="amt-lbl">Montant</span><span class="amt-val highlight">${fmt(d.amount, d.currency)} ${d.currency}</span></div>`;

  const receivedHtml = d.receivedAmount && d.targetCurrency && d.targetCurrency !== d.currency ? `
  <div class="received-row">
    <span class="received-icon">⇄</span>
    <div>
      <div class="received-lbl">Montant reçu par le bénéficiaire</div>
      <div class="received-amt">${fmt(d.receivedAmount, d.targetCurrency)} ${d.targetCurrency}</div>
    </div>
  </div>` : "";

  const rateHtml = d.exchangeRate ? `
  <div class="amt-row"><span class="amt-lbl">Taux de change</span><span class="amt-val mono">1 ${d.currency} = ${Number(d.exchangeRate).toFixed(2)} ${d.targetCurrency ?? ""}</span></div>` : "";

  const senderHtml = d.senderName ? `
  <div class="section">
    <div class="section-title purple">Expéditeur</div>
    <div class="field-row"><span class="f-lbl">Nom</span><span class="f-val">${d.senderName}</span></div>
    ${d.senderPhone   ? `<div class="field-row"><span class="f-lbl">Téléphone</span><span class="f-val mono">${d.senderPhone}</span></div>` : ""}
    ${d.senderCountry ? `<div class="field-row"><span class="f-lbl">Pays</span><span class="f-val">${d.senderCountry}</span></div>` : ""}
  </div>` : "";

  // ✅ v2.1 — CSS reécrit : héro blanc pur, sans fond bleu/gradient.
  // Le .header devient une zone blanche avec bordure basse légère.
  // Le ::after arrondi (transition bleu→blanc) est supprimé.
  // Le montant et la devise passent en texte sombre.
  // Tout le reste du CSS est strictement identique à v2.0.
  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reçu Direct Transf'air — ${d.reference}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;background:#fff;color:#0F172A}

/* ── Hero blanc pur (v2.1) ── */
.header{background:#fff;border-bottom:2px solid #E2E8F0;padding:28px 22px 22px;text-align:center}
.logo{color:#0F172A;font-size:16px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:2px}
.logo-sub{color:#94A3B8;font-size:8px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
.type-badge{display:inline-block;background:#F1F5F9;border:1px solid #E2E8F0;color:#475569;padding:4px 16px;border-radius:20px;font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px}
.amt-label{font-size:8px;letter-spacing:1.5px;color:#94A3B8;text-transform:uppercase;margin-bottom:6px}
.amt-big{font-size:40px;font-weight:900;color:#0F172A;letter-spacing:-1px;line-height:1}
.amt-curr{font-size:13px;font-weight:700;color:#475569;letter-spacing:2px;margin-top:5px}

/* ── Reste inchangé ── */
.body{padding:20px 20px 0}
.meta-row{display:flex;justify-content:space-between;align-items:center;background:#F8FAFF;border:1px solid #DBEAFE;border-radius:10px;padding:12px 14px;margin-bottom:12px}
.meta-lbl{font-size:8px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
.meta-val{font-size:11px;font-weight:800;color:#0F172A;font-family:monospace}
.meta-val.sm{font-size:10px}
.status-row{text-align:center;margin-bottom:14px}
.status-badge{display:inline-block;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;padding:5px 18px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:0.5px}
.code-box{background:#F8FAFF;border:1.5px solid #CBD5E1;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px}
.code-label{font-size:8px;font-weight:900;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.code-value{font-size:28px;font-weight:900;color:#0F172A;letter-spacing:6px;font-family:monospace;margin-bottom:6px}
.code-tip{font-size:9px;color:#6B7280;font-style:italic}
.section{margin-bottom:16px}
.section-title{font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#475569;border-bottom:1.5px solid #E2E8F0;padding-bottom:5px;margin-bottom:10px}
.section-title.purple{color:#8B5CF6;border-bottom-color:#8B5CF6}
.section-title.gray{color:#6B7280;border-bottom-color:#E5E7EB}
.field-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
.f-lbl{font-size:10px;color:#6B7280;font-weight:600;flex-shrink:0;margin-right:8px}
.f-val{font-size:11px;color:#0F172A;font-weight:700;text-align:right}
.f-val.mono{font-family:monospace}
.amounts-card{background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:14px}
.amt-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.amt-row:last-child{margin-bottom:0}
.amt-row.total{border-top:1px solid #E2E8F0;margin-top:8px;padding-top:8px}
.amt-lbl{font-size:10px;color:#6B7280;font-weight:600}
.amt-lbl.bold{font-weight:900;color:#0F172A}
.amt-val{font-size:11px;color:#0F172A;font-weight:800;font-family:monospace}
.amt-val.highlight{color:#0F172A;font-size:14px;font-weight:900}
.amt-val.mono{font-family:monospace;font-size:10px}
.received-row{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;margin-top:10px}
.received-icon{font-size:16px}
.received-lbl{font-size:8px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
.received-amt{font-size:15px;font-weight:900;color:#065F46;font-family:monospace}
.sig-area{display:flex;justify-content:space-between;margin:24px 0 16px}
.sig-box{width:44%;text-align:center}
.sig-line{border-top:1px solid #0F172A;margin-top:36px;margin-bottom:6px}
.sig-lbl{font-size:9px;color:#6B7280;font-weight:600}
.footer{background:#F8FAFF;border-top:2px solid #E2E8F0;padding:16px 20px}
.f-logo{font-size:12px;font-weight:900;color:#0F172A;letter-spacing:2px;margin-bottom:5px}
.f-legal{font-size:8px;color:#9CA3AF;line-height:1.6;margin-bottom:10px}
.f-ref{font-size:8px;color:#9CA3AF;text-align:center;border-top:1px dashed #E2E8F0;padding-top:8px;font-style:italic}
</style></head><body>
<div class="header">
  <div class="logo">DIRECT TRANSF'AIR</div>
  <div class="logo-sub">Transfert d'argent international</div>
  <div class="type-badge">${ti.label.toUpperCase()}</div>
  <div class="amt-label">${ti.amtLabel.toUpperCase()}</div>
  <div class="amt-big">${mainAmt}</div>
  <div class="amt-curr">${mainCurr}</div>
</div>
<div class="body">
  <div class="meta-row">
    <div><div class="meta-lbl">Référence</div><div class="meta-val">${d.reference}</div></div>
    <div style="text-align:right"><div class="meta-lbl">Date &amp; Heure</div><div class="meta-val sm">${dt.full}</div></div>
  </div>
  <div class="status-row"><span class="status-badge">✓ TRANSACTION VALIDÉE</span></div>
  ${codeHtml}
  <div class="section">
    <div class="section-title">Détails financiers</div>
    <div class="amounts-card">${amtHtml}${rateHtml}${receivedHtml}</div>
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
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Signature Agent</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Signature Client</div></div>
  </div>
</div>
<div class="footer">
  <div class="f-logo">DIRECT TRANSF'AIR</div>
  <div class="f-legal">Ce reçu constitue une preuve officielle d'exécution de la transaction ci-dessus. Conservez ce document précieusement. Pour toute réclamation, contactez votre agence dans les 48 heures.</div>
  <div class="f-ref">Réf. ${d.reference} · ${dt.short}</div>
</div>
</body></html>`;
}

// ─── Main — logique métier 100 % inchangée ────────────────
export default function AgentReceiptScreen() {
  const router = useRouter();
  const { data: raw } = useLocalSearchParams<{ data: string }>();

  const data: ReceiptData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(raw ?? "null")); }
    catch { return null; }
  }, [raw]);

  const handlePrint = useCallback(async () => {
    if (!data) return;
    try { await Print.printAsync({ html: buildHtml(data) }); }
    catch { Alert.alert("Erreur", "Impression impossible."); }
  }, [data]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(data) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        Alert.alert("Non disponible", "Le partage n'est pas disponible sur cet appareil.");
      }
    } catch { Alert.alert("Erreur", "Impossible de générer le PDF."); }
  }, [data]);

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color={T.inkMuted} />
          <Text style={[s.errTxt, { fontFamily: T.font.sans }]}>Données du reçu introuvables</Text>
          <TouchableOpacity style={s.errBtn} onPress={() => router.back()}>
            <Text style={[s.errBtnTxt, { fontFamily: T.font.sans }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ti      = typeInfo(data.type);
  const dt      = fmtDate(data.date);
  const hasFees = data.fees !== undefined && data.type !== "DEPOT";

  const mainAmt  = data.type === "RETRAIT" && data.receivedAmount
    ? fmt(data.receivedAmount, data.targetCurrency ?? data.currency)
    : fmt(data.amount, data.currency);
  const mainCurr = data.type === "RETRAIT" && data.targetCurrency
    ? data.targetCurrency
    : data.currency;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header minimaliste ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={20} color={T.ink} />
        </TouchableOpacity>
        <Text style={[s.topTitle, { fontFamily: T.font.sans }]}>REÇU</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ════ BLOC MONTANT ════ */}
        <View style={s.amtBlock}>
          <View style={s.statusBadge}>
            <Ionicons name="checkmark-circle" size={13} color={T.green} />
            <Text style={[s.statusTxt, { fontFamily: T.font.sans }]}>Transaction confirmée</Text>
          </View>
          <Text style={[s.typeLabel, { fontFamily: T.font.sans }]}>{ti.label}</Text>
          <Text style={[s.amtMain, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
            {mainAmt}
          </Text>
          <Text style={[s.amtCurr, { fontFamily: T.font.mono }]}>{mainCurr}</Text>
        </View>

        <View style={s.hairline} />

        {/* ════ RÉFÉRENCE & DATE ════ */}
        <View style={s.section}>
          <Row label="Référence" value={data.reference} mono />
          <Row label="Date"      value={dt.day} />
          <Row label="Heure"     value={dt.time} />
        </View>

        {/* ════ CODE DE RETRAIT ════ */}
        {data.code && (
          <>
            <View style={s.hairline} />
            <View style={s.section}>
              <SectionTitle>Code de retrait</SectionTitle>
              <View style={s.codeBox}>
                <Text style={[s.codeValue, { fontFamily: T.font.mono }]}>{data.code}</Text>
                <Text style={[s.codeTip, { fontFamily: T.font.sans }]}>
                  À conserver · justificatif officiel
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ════ DÉTAILS FINANCIERS ════ */}
        <View style={s.hairline} />
        <View style={s.section}>
          <SectionTitle>Détails financiers</SectionTitle>
          {hasFees ? (
            <>
              <Row label="Montant envoyé"  value={`${fmt(data.amount, data.currency)} ${data.currency}`} />
              <Row label="Frais de service" value={`${fmt(data.fees ?? 0, data.currency)} ${data.currency}`} />
              <Row label="Total débité"    value={`${fmt(data.totalAmount ?? data.amount, data.currency)} ${data.currency}`} bold />
            </>
          ) : (
            <Row label={ti.amtLabel} value={`${fmt(data.amount, data.currency)} ${data.currency}`} bold />
          )}
          {data.exchangeRate && (
            <Row label="Taux de change" value={`1 ${data.currency} = ${Number(data.exchangeRate).toFixed(2)} ${data.targetCurrency ?? ""}`} mono />
          )}
          {data.receivedAmount && data.targetCurrency && data.targetCurrency !== data.currency && (
            <View style={s.receivedRow}>
              <Ionicons name="swap-horizontal-outline" size={14} color={T.green} />
              <View style={{ flex: 1 }}>
                <Text style={[s.receivedLbl, { fontFamily: T.font.sans }]}>
                  Montant reçu par le bénéficiaire
                </Text>
                <Text style={[s.receivedAmt, { fontFamily: T.font.display }]}>
                  {fmt(data.receivedAmount, data.targetCurrency)} {data.targetCurrency}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ════ BÉNÉFICIAIRE ════ */}
        <View style={s.hairline} />
        <View style={s.section}>
          <SectionTitle>Bénéficiaire</SectionTitle>
          <Row label="Nom complet" value={data.beneficiaryName} />
          {data.beneficiaryPhone   && <Row label="Téléphone" value={data.beneficiaryPhone} mono />}
          {data.beneficiaryCountry && <Row label="Pays"      value={data.beneficiaryCountry} />}
        </View>

        {/* ════ EXPÉDITEUR ════ */}
        {data.senderName && (
          <>
            <View style={s.hairline} />
            <View style={s.section}>
              <SectionTitle>Expéditeur</SectionTitle>
              <Row label="Nom"       value={data.senderName} />
              {data.senderPhone   && <Row label="Téléphone" value={data.senderPhone} mono />}
              {data.senderCountry && <Row label="Pays"      value={data.senderCountry} />}
            </View>
          </>
        )}

        {/* ════ AGENCE ════ */}
        <View style={s.hairline} />
        <View style={s.section}>
          <SectionTitle>Agence émettrice</SectionTitle>
          <Row label="Agence" value={data.agencyName ?? "—"} />
          <Row label="Agent"  value={data.agentName  ?? "—"} />
        </View>

        {/* ════ SIGNATURES ════ */}
        <View style={s.hairline} />
        <View style={s.sigArea}>
          <View style={s.sigBox}>
            <View style={s.sigLine} />
            <Text style={[s.sigLbl, { fontFamily: T.font.sans }]}>Signature Agent</Text>
          </View>
          <View style={s.sigBox}>
            <View style={s.sigLine} />
            <Text style={[s.sigLbl, { fontFamily: T.font.sans }]}>Signature Client</Text>
          </View>
        </View>

        {/* ════ BRANDING & LÉGAL ════ */}
        <View style={s.hairline} />
        <View style={s.footer}>
          <Text style={[s.footLogo,  { fontFamily: T.font.sans }]}>DIRECT TRANSF'AIR</Text>
          <Text style={[s.footSub,   { fontFamily: T.font.sans }]}>Transfert d'argent international</Text>
          <Text style={[s.footLegal, { fontFamily: T.font.sans }]}>
            Ce reçu constitue une preuve officielle d'exécution de la transaction ci-dessus.
            Pour toute réclamation, contactez votre agence dans les 48 heures suivant la transaction.
          </Text>
          <Text style={[s.footRef, { fontFamily: T.font.mono }]}>
            Réf. {data.reference} · {dt.short}
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ════ ACTIONS FIXÉES EN BAS ════ */}
      <View style={s.actions}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={17} color={T.ink} />
          <Text style={[s.shareTxt, { fontFamily: T.font.sans }]}>Partager PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.printBtn} onPress={handlePrint} activeOpacity={0.88}>
          <Ionicons name="print-outline" size={17} color="#fff" />
          <Text style={[s.printTxt, { fontFamily: T.font.sans }]}>Imprimer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  errTxt:    { fontSize: 14, color: T.inkMuted, marginTop: 14, fontWeight: "600", textAlign: "center" },
  errBtn:    { marginTop: 18, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1.5, borderColor: T.codeBorder },
  errBtnTxt: { color: T.ink, fontWeight: "700", fontSize: 13 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.divider,
  },
  closeBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: T.divider, justifyContent: "center", alignItems: "center" },
  topTitle:  { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 2 },

  scroll: { paddingHorizontal: 22 },

  // ✅ v2.1 : paddingTop 28→16, paddingBottom 24→12
  amtBlock: { alignItems: "center", paddingTop: 16, paddingBottom: 12 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.greenBg, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 10,
  },
  statusTxt: { fontSize: 11, fontWeight: "700", color: T.greenText },
  // ✅ v2.1 : marginBottom 8→4
  typeLabel: { fontSize: 11, fontWeight: "700", color: T.inkMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  amtMain:   { fontSize: 48, fontWeight: "900", color: T.ink, letterSpacing: -1.5, textAlign: "center" },
  amtCurr:   { fontSize: 16, fontWeight: "700", color: T.inkSub, marginTop: 4, letterSpacing: 2 },

  hairline: { height: 1, backgroundColor: T.dividerMd, marginVertical: 0 },

  // ✅ v2.1 : paddingVertical 4→2
  section: { paddingVertical: 2 },

  // ✅ v2.1 : padding 18→12, marginTop 8→4, marginBottom 6→4
  codeBox: {
    borderWidth: 1, borderColor: T.codeBorder, borderRadius: 12,
    backgroundColor: T.codeBg, padding: 12, alignItems: "center",
    marginTop: 4, marginBottom: 4,
  },
  codeValue: { fontSize: 28, fontWeight: "900", color: T.ink, letterSpacing: 6, marginBottom: 4 },
  codeTip:   { fontSize: 10, color: T.inkMuted, textAlign: "center" },

  receivedRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.greenBg, borderRadius: 10,
    padding: 10, marginTop: 4, marginBottom: 2,
  },
  receivedLbl: { fontSize: 10, color: T.inkSub, fontWeight: "600", marginBottom: 2 },
  receivedAmt: { fontSize: 18, fontWeight: "900", color: T.greenText },

  // ✅ v2.1 : paddingVertical 24→16
  sigArea: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 16 },
  sigBox:  { width: "43%", alignItems: "center" },
  sigLine: { width: "100%", height: 1, backgroundColor: T.ink, marginBottom: 7, marginTop: 36 },
  sigLbl:  { fontSize: 10, color: T.inkMuted, fontWeight: "600" },

  // ✅ v2.1 : paddingVertical 20→12
  footer:    { paddingVertical: 12, alignItems: "center" },
  footLogo:  { fontSize: 12, fontWeight: "900", color: T.ink, letterSpacing: 2.5, marginBottom: 3 },
  footSub:   { fontSize: 10, color: T.inkMuted, letterSpacing: 0.5, marginBottom: 10 },
  footLegal: { fontSize: 10, color: T.inkMuted, lineHeight: 16, textAlign: "center", marginBottom: 8 },
  footRef:   { fontSize: 9,  color: T.inkMuted },

  actions: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 26 : 12,
    backgroundColor: T.bg,
    borderTopWidth: 1, borderTopColor: T.dividerMd,
  },
  shareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: T.bg, borderWidth: 1.5, borderColor: T.dividerMd,
  },
  printBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: T.ink,
  },
  shareTxt: { color: T.ink, fontWeight: "700", fontSize: 13 },
  printTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});