// apps/direct-transfair-mobile/app/(tabs)/transactions/client-receipt.tsx
// ✅ v-Corridor : neutres vert brume / forêt alignés sur le design « Corridor » (logique inchangée).
// =========================================================
// REÇU CLIENT v2.0 — Direct Transf'air
// ✅ v2.0 : 🔥 REFONTE de l'écran en thème clair (design system components/ui) : reçu « ticket » blanc sur
//    fond crème, montant géant, lignes à filets, parties expéditeur → destinataire, boutons « Partager PDF »
//    (accent de la société) et « Imprimer » (noir). Le PDF (buildHtml) et toutes les données sont INCHANGÉS.
// ✅ v1.1 : WHITE-LABEL — les couleurs vertes écrites en dur suivent maintenant la
//    couleur de marque du tenant (components/wallet/brand.ts) ; palette et styles
//    évalués paresseusement. Avec la marque par défaut, rendu strictement identique.
//    Aucune logique métier touchée. Développé par Thierno Doniko (Grand Chef).
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
//    Nom de la société = branding.name du tenant (était « Direct Transf'air » écrit en dur).
// =========================================================

import React, { useCallback } from "react";
import { View, Platform, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import * as Print   from "expo-print";
import * as Sharing from "expo-sharing";

import { themed, brand } from "../../../components/wallet/brand";
import { Button, Card, NavBar, Pill, Screen, UText, useUI } from "../../../components/ui";
import { useTenant } from "../../../providers/TenantProvider";
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
const T = themed(() => ({
  bg:         "#FFFFFF",
  ink:        "#10231B",
  inkSub:     "#2F463A",
  inkMuted:   "#5E7468",
  divider:    "#E8F0EA",
  dividerMd:  "#D3E0D7",
  green:      brand("#1F8A5B"),
  greenBg:    "#DDEFE5",
  greenText:  brand("#0E3B2D"),
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
}));

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
  if (status === "EXPIRED")             return { label: "EXPIRÉE",    color: T.red,   bg: T.redBg   };
  return { label: "EN ATTENTE", color: T.amber, bg: T.amberBg };
}

// ─── PDF builder ─────────────────────────────────────────
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function buildHtml(d: ClientReceiptData, brandName: string, tagline: string): string {
  const brandHtml = escHtml(brandName.toUpperCase());
  const taglineHtml = escHtml(tagline);
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
.amt-val.highlight{color:${brand("#059669")};font-size:14px;font-weight:900}
.amt-val.mono{font-family:monospace;font-size:10px}

/* ── Conversion ── */
.conv-row{background:${brand("#ECFDF5")};border:1px solid ${brand("#A7F3D0")};border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;margin-top:10px}
.conv-icon{font-size:16px}
.conv-lbl{font-size:8px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
.conv-amt{font-size:14px;font-weight:900;color:${brand("#065F46")};font-family:monospace}

/* ── Footer ── */
.footer{background:#F8FAFF;border-top:2px solid #E2E8F0;padding:16px 20px}
.f-logo{font-size:12px;font-weight:900;color:#0F172A;letter-spacing:2px;margin-bottom:5px}
.f-legal{font-size:8px;color:#9CA3AF;line-height:1.6;margin-bottom:10px}
.f-ref{font-size:8px;color:#9CA3AF;text-align:center;border-top:1px dashed #E2E8F0;padding-top:8px;font-style:italic}
</style></head><body>

<div class="header">
  <div class="logo">${brandHtml}</div>
  <div class="logo-sub">${taglineHtml}</div>
  <div class="type-badge">${d.txLabel.toUpperCase()}</div>
  <div class="amt-label">${d.isIncoming ? "MONTANT REÇU" : "MONTANT ENVOYÉ"}</div>
  <div style="color:${d.isIncoming ? brand("#059669") : "#DC2626"}">
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
  <div class="f-logo">${brandHtml}</div>
  <div class="f-legal">Ce reçu constitue une preuve officielle de votre transaction. Pour toute réclamation, contactez le service client dans les 48 heures suivant la transaction.</div>
  <div class="f-ref">Réf. ${d.reference} · ${dt.short}</div>
</div>
</body></html>`;
}

// ─── Écran principal ─────────────────────────────────────
export default function ClientReceiptScreen() {
  const { C } = useUI(); // synchronise aussi la marque pour buildHtml (brand())
  const { branding } = useTenant();
  const tagline = branding.tagline || "";
  const router = useRouter();
  const { data: raw } = useLocalSearchParams<{ data: string }>();

  const data: ClientReceiptData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(raw ?? "null")); }
    catch { return null; }
  }, [raw]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(data, branding.name, tagline) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        Alert.alert("Non disponible", "Le partage n'est pas disponible sur cet appareil.");
      }
    } catch { Alert.alert("Erreur", "Impossible de générer le PDF."); }
  }, [data, branding.name, tagline]);

  const handlePrint = useCallback(async () => {
    if (!data) return;
    try { await Print.printAsync({ html: buildHtml(data, branding.name, tagline) }); }
    catch { Alert.alert("Erreur", "Impression impossible."); }
  }, [data, branding.name, tagline]);

  if (!data) {
    return (
      <Screen header={<NavBar onBack={() => router.back()} title="Reçu" />}>
        <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
          <Ionicons name="alert-circle-outline" size={48} color={C.faint} />
          <UText v="body" tone="muted">Données introuvables</UText>
          <Button label="Retour" kind="outline" full={false} small onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const dt      = fmtDate(data.date);
  const hasConv = !!(data.receivedCurrency && data.receivedCurrency !== data.sentCurrency && (data.receivedAmount ?? 0) > 0);
  const amtColor = data.isIncoming ? C.pos : C.ink;
  const stTone: "pos" | "info" | "danger" | "warn" | "neutral" =
    data.status === "PAID" ? "pos" : data.status === "VALIDATED" ? "info"
      : data.status === "CANCELLED" || data.status === "FAILED" || data.status === "EXPIRED" ? "danger" : "warn";
  const stLabel = statusInfo(data.status, data.isIncoming).label.replace(" ✓", "");

  const Line = ({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <UText v="caption" tone="muted" style={{ flex: 1 }}>{label}</UText>
      <UText v={bold ? "subheading" : "bodyStrong"} style={{ flex: 2, textAlign: "right", fontWeight: bold ? "800" : "600" }}>{value}</UText>
    </View>
  );

  return (
    <Screen
      header={<NavBar onBack={() => router.back()} title="Reçu" subtitle={data.reference} />}
      footer={
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button label="Partager PDF" icon="share-outline" onPress={handleShare} style={{ flex: 1 }} />
          <Button label="Imprimer" icon="print-outline" kind="dark" onPress={handlePrint} style={{ flex: 1 }} />
        </View>
      }
    >
      {/* ── Montant ── */}
      <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 18, gap: 8 }}>
        <Pill label={stLabel} tone={stTone} icon="checkmark-circle" style={{ alignSelf: "center" }} />
        <UText v="overline" tone="muted">{data.txLabel}</UText>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <UText v="display" color={amtColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ flexShrink: 1 }}>
            {data.isIncoming ? "+" : "−"}{fmt(data.heroDisplayAmount, data.heroDisplayCurrency)}
          </UText>
          <UText v="heading" tone="muted">{data.heroDisplayCurrency}</UText>
        </View>
      </View>

      {/* ── Référence & date ── */}
      <Card pad={18} style={{ marginBottom: 14 }}>
        <Line label="Référence" value={data.reference} />
        <Line label="Date" value={dt.day} />
        <Line label="Heure" value={dt.time} last />
      </Card>

      {/* ── Conversion ── */}
      {hasConv && (
        <Card tone="accent" pad={16} style={{ marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name="swap-horizontal-outline" size={20} color={C.ink} />
          <View style={{ flex: 1 }}>
            <UText v="caption" tone="muted">
              {data.isIncoming ? "Montant envoyé par l'expéditeur" : "Montant reçu par le destinataire"}
            </UText>
            <UText v="heading">
              {data.isIncoming
                ? `${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`
                : `${fmt(data.receivedAmount ?? 0, data.receivedCurrency ?? "")} ${data.receivedCurrency ?? ""}`}
            </UText>
          </View>
          {!!data.exchangeRate && (
            <UText v="label" tone="muted" align="center">
              1 {data.sentCurrency}{"\n"}= {Number(data.exchangeRate).toFixed(2)}{"\n"}{data.receivedCurrency}
            </UText>
          )}
        </Card>
      )}

      {/* ── Parties ── */}
      <Card pad={18} style={{ marginBottom: 14, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <UText v="overline" tone="muted">Expéditeur</UText>
          <UText v="bodyStrong" style={{ marginTop: 4 }}>{data.senderName}</UText>
        </View>
        <Ionicons name="arrow-forward" size={18} color={C.faint} style={{ marginHorizontal: 10 }} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <UText v="overline" tone="muted">Destinataire</UText>
          <UText v="bodyStrong" style={{ marginTop: 4, textAlign: "right" }}>{data.recipientName}</UText>
          {!!data.recipientPhone && <UText v="caption" tone="muted">{data.recipientPhone}</UText>}
        </View>
      </Card>

      {/* ── Détails financiers ── */}
      <Card tone="sunken" pad={18}>
        <UText v="overline" tone="muted" style={{ marginBottom: 4 }}>Détails financiers</UText>
        {data.isIncoming ? (
          <Line label="Montant crédité" value={`${fmt(data.heroDisplayAmount, data.heroDisplayCurrency)} ${data.heroDisplayCurrency}`} bold last />
        ) : (
          <>
            <Line label="Montant envoyé" value={`${fmt(data.sentAmount, data.sentCurrency)} ${data.sentCurrency}`} />
            {data.fees > 0 && <Line label="Frais de service" value={`${fmt(data.fees, data.sentCurrency)} ${data.sentCurrency}`} />}
            <Line label="Total débité" value={`${fmt(data.total, data.sentCurrency)} ${data.sentCurrency}`} bold last />
          </>
        )}
      </Card>

      {/* ── Pied de reçu ── */}
      <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
        <UText v="label" style={{ letterSpacing: 2 }}>{branding.name.toUpperCase()}</UText>
        {!!tagline && <UText v="caption" tone="muted" align="center">{tagline}</UText>}
        <UText v="caption" tone="faint" align="center" style={{ marginTop: 6 }}>
          Ce reçu constitue une preuve de votre transaction. Pour toute réclamation, contactez le service client dans les 48 heures.
        </UText>
        <UText v="label" tone="faint">Réf. {data.reference} · {dt.short}</UText>
      </View>
    </Screen>
  );
}
