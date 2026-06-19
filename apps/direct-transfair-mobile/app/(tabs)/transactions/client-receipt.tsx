// apps/direct-transfair-mobile/app/(tabs)/transactions/client-receipt.tsx
// =========================================================
// REÇU CLIENT v1.0 — Direct Transf'air
// ✅ v1.0 : Reçu propre pour le client (rôle USER / COMPANY_ADMIN)
//   - Déclenché par transactions/[id].tsx > handleShare (bouton
//     "Partager le reçu" / "Voir le reçu")
//   - Écran natif minimaliste : même style que agent/receipt v2.1
//     (blanc pur, lignes compactes, aucun héro coloré)
//   - PDF riche partageable (via expo-print + expo-sharing) :
//     header blanc pur, logo encre, montant en gros texte sombre,
//     bloc parties Expéditeur → Destinataire, détails financiers,
//     bloc conversion EUR/XOF si applicable, footer légal
//   - Affichage intelligent selon direction (isIncoming) :
//     · Entrant  → montant en vert, "Montant crédité"
//     · Sortant  → montant en rouge, "Montant envoyé + frais + total"
//   - Logique 100 % présentationnelle : les données arrivent déjà
//     calculées par [id].tsx (heroDisplayAmount, isIncoming, etc.)
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

// ─── Type du reçu client ─────────────────────────────────
// (construit dans [id].tsx > handleShare, passé en param URL)
export interface ClientReceiptData {
  reference:           string;
  date:                string;
  status:              string;
  isIncoming:          boolean;
  txLabel:             string;
  payoutMethod?:       string;
  // Montants bruts
  sentAmount:          number;
  sentCurrency:        string;
  receivedAmount?:     number;
  receivedCurrency?:   string;
  exchangeRate?:       number;
  fees:                number;
  total:               number;
  // Montant/devise à afficher en héro (déjà calculés par [id].tsx)
  heroDisplayAmount:   number;
  heroDisplayCurrency: string;
  // Parties
  senderName:          string;
  recipientName:       string;
  recipientPhone?:     string;
  recipientCountry?:   string;
}

// ─── Design tokens ───────────────────────────────────────
const T = {
  bg:         "#FFFFFF",
  ink:        "#0F172A",
  inkSub:     "#475569",
  inkMuted:   "#94A3B8",
  divider:    "#F1F5F9",
  dividerMd:  "#E2E8F0",
  green:      "#059669",
  greenBg:    "#DCFCE7",
  greenText:  "#065F46",
  red:        "#DC2626",
  redBg:      "#FEE2E2",
  blue:       "#2563EB",
  blueBg:     "#EFF6FF",
  amber:      "#D97706",
  amberBg:    "#FEF3C7",
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers ─────────────────────────────────────────────
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function fmtDate(iso: string): { day: string; time: string; short: string; full: string } {
  try {
    const d = new Date(iso);
    return {
      day:   d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long",    year: "numeric" }),
      time:  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      short: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
             + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      full:  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long",    year: "numeric" })
             + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch { return { day: iso, time: "", short: iso, full: iso }; }
}

function statusInfo(status: string, isIncoming: boolean) {
  if (status === "PAID" && isIncoming)  return { label: "REÇUE ✓",   color: T.green, bg: T.greenBg };
  if (status === "PAID" && !isIncoming) return { label: "PAYÉE ✓",   color: T.green, bg: T.greenBg };
  if (status === "VALIDATED")           return { label: "DISPONIBLE", color: T.blue,  bg: T.blueBg  };
  if (status === "CANCELLED")           return { label: "ANNULÉE",    color: T.red,   bg: T.redBg   };
  if (status === "FAILED")              return { label: "ÉCHOUÉE",    color: T.red,   bg: T.redBg   };
  return { label: "EN ATTENTE", color: T.amber, bg: T.amberBg };
}

// ─── Composants UI ───────────────────────────────────────
function Row({ label, value, mono, bold }: {
  label: string; value: string; mono?: boolean; bold?: boolean;
}) {
  return (
    <View style={ro.row}>
      <Text style={[ro.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[ro.value, { fontFamily: mono ? T.font.mono : T.font.sans }, bold && ro.bold]}>
        {value}
      </Text>
    </View>
  );
}
const ro = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.divider },
  label: { fontSize: 13, color: T.inkSub, fontWeight: "500", flex: 1 },
  value: { fontSize: 13, color: T.ink,    fontWeight: "600", textAlign: "right", flex: 2 },
  bold:  { fontWeight: "800", color: T.ink, fontSize: 14 },
});

function SectionTitle({ children }: { children: string }) {
  return <Text style={[st.txt, { fontFamily: T.font.sans }]}>{children}</Text>;
}
const st = StyleSheet.create({
  txt: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.5, textTransform: "uppercase", paddingTop: 10, paddingBottom: 2 },
});

// ─── PDF builder ─────────────────────────────────────────
function buildHtml(d: ClientReceiptData): string {
  const dt   = fmtDate(d.date);
  const st   = statusInfo(d.status, d.isIncoming);
  const hasConv = !!(d.receivedCurrency && d.receivedCurrency !== d.sentCurrency && (d.receivedAmount ?? 0) > 0);

  const financialHtml = d.isIncoming
    ? `<div class="amt-row">
         <span class="amt-lbl">Montant crédité</span>
         <span class="amt-val highlight">${fmt(d.heroDisplayAmount, d.heroDisplayCurrency)} ${d.heroDisplayCurrency}</span>
       </div>`
    : d.fees > 0
      ? `<div class="amt-row">
           <span class="amt-lbl">Montant envoyé</span>
           <span class="amt-val">${fmt(d.sentAmount, d.sentCurrency)} ${d.sentCurrency}</span>
         </div>
         <div class="amt-row">
           <span class="amt-lbl">Frais de service</span>
           <span class="amt-val">${fmt(d.fees, d.sentCurrency)} ${d.sentCurrency}</span>
         </div>
         <div class="amt-row total">
           <span class="amt-lbl bold">Total débité</span>
           <span class="amt-val highlight">${fmt(d.total, d.sentCurrency)} ${d.sentCurrency}</span>
         </div>`
      : `<div class="amt-row">
           <span class="amt-lbl">Montant envoyé</span>
           <span class="amt-val highlight">${fmt(d.sentAmount, d.sentCurrency)} ${d.sentCurrency}</span>
         </div>`;

  const convHtml = hasConv ? `
    <div class="conv-row">
      <span class="conv-icon">⇄</span>
      <div>
        <div class="conv-lbl">${d.isIncoming ? "Montant envoyé par l'expéditeur" : "Montant reçu par le destinataire"}</div>
        <div class="conv-amt">${d.isIncoming
          ? `${fmt(d.sentAmount, d.sentCurrency)} ${d.sentCurrency}`
          : `${fmt(d.receivedAmount ?? 0, d.receivedCurrency ?? "")} ${d.receivedCurrency ?? ""}`
        }</div>
      </div>
    </div>` : "";

  const rateHtml = hasConv && d.exchangeRate
    ? `<div class="amt-row">
         <span class="amt-lbl">Taux de change</span>
         <span class="amt-val mono">1 ${d.sentCurrency} = ${Number(d.exchangeRate).toFixed(4)} ${d.receivedCurrency ?? ""}</span>
       </div>` : "";

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reçu — ${d.reference}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;background:#fff;color:#0F172A}

/* ── Header blanc pur ── */
.header{background:#fff;border-bottom:2px solid #E2E8F0;padding:28px 22px 20px;text-align:center}
.logo{color:#0F172A;font-size:16px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:2px}
.logo-sub{color:#94A3B8;font-size:8px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
.type-badge{display:inline-block;background:#F1F5F9;border:1px solid #E2E8F0;color:#475569;padding:4px 16px;border-radius:20px;font-size:9px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px}
.amt-label{font-size:8px;letter-spacing:1.5px;color:#94A3B8;text-transform:uppercase;margin-bottom:5px}
.amt-sign{font-size:22px;font-weight:900;vertical-align:middle}
.amt-big{font-size:38px;font-weight:900;letter-spacing:-1px;line-height:1;vertical-align:middle}
.amt-curr{font-size:13px;font-weight:700;color:#475569;letter-spacing:2px;margin-top:4px}

/* ── Corps ── */
.body{padding:18px 20px 0}
.meta-row{display:flex;justify-content:space-between;align-items:center;background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:12px}
.meta-lbl{font-size:8px;font-weight:700;color:#9CA3AF;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
.meta-val{font-size:11px;font-weight:800;color:#0F172A;font-family:monospace}
.meta-val.sm{font-size:10px}
.status-row{text-align:center;margin-bottom:14px}
.status-badge{display:inline-block;padding:5px 18px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:0.5px}
.section{margin-bottom:14px}
.section-title{font-size:8px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#475569;border-bottom:1.5px solid #E2E8F0;padding-bottom:5px;margin-bottom:10px}

/* ── Bloc parties (Expéditeur → Destinataire) ── */
.parties-card{display:flex;align-items:center;justify-content:space-between;background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:14px;gap:8px}
.party{text-align:center;flex:1}
.party-role{font-size:7px;font-weight:900;color:#94A3B8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.party-name{font-size:13px;font-weight:800;color:#0F172A}
.party-phone{font-size:9px;color:#64748B;margin-top:3px;font-family:monospace}
.party-sep{font-size:20px;color:#CBD5E1;flex-shrink:0;padding:0 4px}

/* ── Détails financiers ── */
.amounts-card{background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px}
.amt-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.amt-row:last-child{margin-bottom:0}
.amt-row.total{border-top:1px solid #E2E8F0;margin-top:8px;padding-top:8px}
.amt-lbl{font-size:10px;color:#6B7280;font-weight:600}
.amt-lbl.bold{font-weight:900;color:#0F172A}
.amt-val{font-size:11px;color:#0F172A;font-weight:800;font-family:monospace}
.amt-val.highlight{color:#059669;font-size:14px;font-weight:900}
.amt-val.mono{font-family:monospace;font-size:10px}

/* ── Conversion ── */
.conv-row{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;margin-top:10px}
.conv-icon{font-size:16px}
.conv-lbl{font-size:8px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
.conv-amt{font-size:14px;font-weight:900;color:#065F46;font-family:monospace}

/* ── Footer ── */
.footer{background:#F8FAFF;border-top:2px solid #E2E8F0;padding:16px 20px}
.f-logo{font-size:12px;font-weight:900;color:#0F172A;letter-spacing:2px;margin-bottom:5px}
.f-legal{font-size:8px;color:#9CA3AF;line-height:1.6;margin-bottom:10px}
.f-ref{font-size:8px;color:#9CA3AF;text-align:center;border-top:1px dashed #E2E8F0;padding-top:8px;font-style:italic}
</style></head><body>

<div class="header">
  <div class="logo">DIRECT TRANSF'AIR</div>
  <div class="logo-sub">Transfert d'argent international</div>
  <div class="type-badge">${d.txLabel.toUpperCase()}</div>
  <div class="amt-label">${d.isIncoming ? "MONTANT REÇU" : "MONTANT ENVOYÉ"}</div>
  <div style="color:${d.isIncoming ? "#059669" : "#DC2626"}">
    <span class="amt-sign">${d.isIncoming ? "+" : "−"}</span>
    <span class="amt-big">${fmt(d.heroDisplayAmount, d.heroDisplayCurrency)}</span>
  </div>
  <div class="amt-curr">${d.heroDisplayCurrency}</div>
</div>

<div class="body">
  <div class="meta-row">
    <div><div class="meta-lbl">Référence</div><div class="meta-val">${d.reference}</div></div>
    <div style="text-align:right"><div class="meta-lbl">Date &amp; Heure</div><div class="meta-val sm">${dt.full}</div></div>
  </div>
  <div class="status-row">
    <span class="status-badge" style="background:${st.bg};color:${st.color};">✓ ${st.label}</span>
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="parties-card">
      <div class="party">
        <div class="party-role">Expéditeur</div>
        <div class="party-name">${d.senderName}</div>
      </div>
      <div class="party-sep">→</div>
      <div class="party">
        <div class="party-role">Destinataire</div>
        <div class="party-name">${d.recipientName}</div>
        ${d.recipientPhone ? `<div class="party-phone">${d.recipientPhone}</div>` : ""}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Détails financiers</div>
    <div class="amounts-card">
      ${financialHtml}
      ${rateHtml}
      ${convHtml}
    </div>
  </div>
</div>

<div class="footer">
  <div class="f-logo">DIRECT TRANSF'AIR</div>
  <div class="f-legal">Ce reçu constitue une preuve officielle de votre transaction. Pour toute réclamation, contactez le service client dans les 48 heures suivant la transaction.</div>
  <div class="f-ref">Réf. ${d.reference} · ${dt.short}</div>
</div>
</body></html>`;
}

// ─── Écran principal ─────────────────────────────────────
export default function ClientReceiptScreen() {
  const router = useRouter();
  const { data: raw } = useLocalSearchParams<{ data: string }>();

  const data: ClientReceiptData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(raw ?? "null")); }
    catch { return null; }
  }, [raw]);

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

  const handlePrint = useCallback(async () => {
    if (!data) return;
    try { await Print.printAsync({ html: buildHtml(data) }); }
    catch { Alert.alert("Erreur", "Impression impossible."); }
  }, [data]);

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Ionicons name="alert-circle-outline" size={48} color={T.inkMuted} />
          <Text style={[s.errTxt, { fontFamily: T.font.sans }]}>Données introuvables</Text>
          <TouchableOpacity style={s.errBtn} onPress={() => router.back()}>
            <Text style={[s.errBtnTxt, { fontFamily: T.font.sans }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dt      = fmtDate(data.date);
  const st      = statusInfo(data.status, data.isIncoming);
  const hasConv = !!(data.receivedCurrency && data.receivedCurrency !== data.sentCurrency && (data.receivedAmount ?? 0) > 0);
  const amtColor = data.isIncoming ? T.green : T.red;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Barre haute ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={20} color={T.ink} />
        </TouchableOpacity>
        <Text style={[s.topTitle, { fontFamily: T.font.sans }]}>REÇU</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Héro montant ── */}
        <View style={s.amtBlock}>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Ionicons name="checkmark-circle" size={13} color={st.color} />
            <Text style={[s.statusTxt, { color: st.color, fontFamily: T.font.sans }]}>{st.label}</Text>
          </View>
          <Text style={[s.typeLabel, { fontFamily: T.font.sans }]}>{data.txLabel}</Text>
          <Text
            style={[s.amtMain, { color: amtColor, fontFamily: T.font.display }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {data.isIncoming ? "+" : "−"}{fmt(data.heroDisplayAmount, data.heroDisplayCurrency)}
          </Text>
          <Text style={[s.amtCurr, { color: amtColor, fontFamily: T.font.mono }]}>
            {data.heroDisplayCurrency}
          </Text>
        </View>

        <View style={s.hairline} />

        {/* ── Référence & Date ── */}
        <View style={s.section}>
          <Row label="Référence" value={data.reference} mono />
          <Row label="Date"      value={dt.day} />
          <Row label="Heure"     value={dt.time} />
        </View>

        {/* ── Conversion (si applicable) ── */}
        {hasConv && (
          <>
            <View style={s.hairline} />
            <View style={s.section}>
              <SectionTitle>Conversion</SectionTitle>
              <View style={s.convRow}>
                <Ionicons name="swap-horizontal-outline" size={16} color={T.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.convLabel, { fontFamily: T.font.sans }]}>
                    {data.isIncoming ? "Montant envoyé par l'expéditeur" : "Montant reçu par le destinataire"}
                  </Text>
                  <Text style={[s.convAmt, { fontFamily: T.font.display }]}>
                    {data.isIncoming
                      ? `${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`
                      : `${fmt(data.receivedAmount ?? 0, data.receivedCurrency ?? "")} ${data.receivedCurrency ?? ""}`
                    }
                  </Text>
                </View>
                {!!data.exchangeRate && (
                  <Text style={[s.convRate, { fontFamily: T.font.sans }]}>
                    1 {data.sentCurrency}{"\n"}= {Number(data.exchangeRate).toFixed(2)}{"\n"}{data.receivedCurrency}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* ── Parties ── */}
        <View style={s.hairline} />
        <View style={s.section}>
          <SectionTitle>Parties</SectionTitle>
          <View style={s.partiesCard}>
            <View style={s.partyBox}>
              <Text style={[s.partyRole, { fontFamily: T.font.sans }]}>EXPÉDITEUR</Text>
              <Text style={[s.partyName, { fontFamily: T.font.sans }]}>{data.senderName}</Text>
            </View>
            <View style={s.partyArrow}>
              <Ionicons name="arrow-forward" size={18} color={T.inkMuted} />
            </View>
            <View style={[s.partyBox, { alignItems: "flex-end" }]}>
              <Text style={[s.partyRole, { fontFamily: T.font.sans }]}>DESTINATAIRE</Text>
              <Text style={[s.partyName, { fontFamily: T.font.sans }]}>{data.recipientName}</Text>
              {!!data.recipientPhone && (
                <Text style={[s.partyPhone, { fontFamily: T.font.mono }]}>{data.recipientPhone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Détails financiers ── */}
        <View style={s.hairline} />
        <View style={s.section}>
          <SectionTitle>Détails financiers</SectionTitle>
          {data.isIncoming ? (
            <Row
              label="Montant crédité"
              value={`${fmt(data.heroDisplayAmount, data.heroDisplayCurrency)} ${data.heroDisplayCurrency}`}
              bold
            />
          ) : (
            <>
              <Row label="Montant envoyé" value={`${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`} />
              {data.fees > 0 && (
                <Row label="Frais de service" value={`${fmt(data.fees, data.sentCurrency)} ${data.sentCurrency}`} />
              )}
              <Row
                label="Total débité"
                value={`${fmt(data.total, data.sentCurrency)} ${data.sentCurrency}`}
                bold
              />
            </>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={s.hairline} />
        <View style={s.footer}>
          <Text style={[s.footLogo,  { fontFamily: T.font.sans }]}>DIRECT TRANSF'AIR</Text>
          <Text style={[s.footSub,   { fontFamily: T.font.sans }]}>Transfert d'argent international</Text>
          <Text style={[s.footLegal, { fontFamily: T.font.sans }]}>
            Ce reçu constitue une preuve officielle de votre transaction.
            Pour toute réclamation, contactez le service client dans les 48 heures.
          </Text>
          <Text style={[s.footRef, { fontFamily: T.font.mono }]}>
            Réf. {data.reference} · {dt.short}
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Boutons bas ── */}
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

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  errTxt:    { fontSize: 14, color: T.inkMuted, marginTop: 14, fontWeight: "600", textAlign: "center" },
  errBtn:    { marginTop: 18, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1.5, borderColor: "#CBD5E1" },
  errBtnTxt: { color: T.ink, fontWeight: "700", fontSize: 13 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.divider,
  },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.divider, justifyContent: "center", alignItems: "center" },
  topTitle: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 2 },

  scroll: { paddingHorizontal: 22 },

  amtBlock: { alignItems: "center", paddingTop: 20, paddingBottom: 16 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 10,
  },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  typeLabel: { fontSize: 11, fontWeight: "700", color: T.inkMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  amtMain:   { fontSize: 44, fontWeight: "900", letterSpacing: -1.5, textAlign: "center" },
  amtCurr:   { fontSize: 16, fontWeight: "700", marginTop: 4, letterSpacing: 2 },

  hairline: { height: 1, backgroundColor: T.dividerMd },
  section:  { paddingVertical: 2 },

  convRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.blueBg, borderRadius: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
    padding: 12, marginTop: 4,
  },
  convLabel: { fontSize: 10, color: T.inkSub, fontWeight: "600", marginBottom: 3 },
  convAmt:   { fontSize: 18, fontWeight: "800", color: T.blue },
  convRate:  { fontSize: 9, color: T.inkMuted, fontWeight: "600", textAlign: "center", lineHeight: 14 },

  partiesCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFF", borderRadius: 12,
    borderWidth: 1, borderColor: T.dividerMd,
    padding: 14, marginTop: 4,
  },
  partyBox:   { flex: 1 },
  partyArrow: { paddingHorizontal: 10 },
  partyRole:  { fontSize: 8, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.2, marginBottom: 4 },
  partyName:  { fontSize: 13, fontWeight: "800", color: T.ink },
  partyPhone: { fontSize: 10, color: T.inkSub, marginTop: 3 },

  footer:    { paddingVertical: 14, alignItems: "center" },
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