// apps/direct-transfair-mobile/services/merchantDocs.ts
// =========================================================
// DOCUMENTS DU MARCHAND (lot 13) — reçu de paiement, rapport/clôture de journée, affiche du QR de caisse (PDF) et export CSV.
// Tout est produit SUR L'APPAREIL (expo-print + expo-sharing) à partir de données déjà renvoyées par le serveur : aucun fichier
// n'est stocké côté serveur, aucune dépendance supplémentaire. Le CSV passe par la feuille de partage native (Excel, Drive, mail…).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { Alert, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { money, shortDateTime } from "../components/merchant/merchantUi";
import { getApiBaseUrl } from "./serverConfig";
import type { ClosingView, CurrencyTotalsView, DayView, MerchantReport, PaymentRequestView, SaleMethod, StaticQrView } from "./merchantTypes";

/** Échappe tout texte venant du serveur ou d'un client avant de le mettre dans le HTML du PDF. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const BASE_CSS = `
  *{box-sizing:border-box} body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:0;padding:28px;}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px} .muted{color:#6b6b6b;font-size:12px}
  .head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px}
  .logo{width:56px;height:56px;border-radius:12px;object-fit:cover}
  .big{font-size:34px;font-weight:800;margin:6px 0}
  table{width:100%;border-collapse:collapse;font-size:12.5px} td,th{padding:7px 4px;border-bottom:1px solid #e5e5e5;text-align:left}
  td.r,th.r{text-align:right} .tag{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:#e8f6ee;color:#17803d}
  .tag.red{background:#fdeaea;color:#b42318} .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee;font-size:13px}
  .seal{display:flex;gap:16px;align-items:center;margin-top:24px;padding:14px;border:1.5px solid #111;border-radius:14px}
  .seal img{width:132px;height:132px;flex:none} .seal b{font-size:13.5px} .seal .muted{margin-top:4px;line-height:1.45}
  .code{margin-top:8px;font-family:Menlo,Consolas,monospace;font-size:11px;word-break:break-all;color:#333}
  .foot{margin-top:26px;font-size:11px;color:#8a8a8a;text-align:center}
`;

const METHOD: Record<SaleMethod, string> = { PHONE: "Téléphone", QR: "QR code", STATIC_QR: "QR de caisse" };

const head = (title: string, subtitle: string, logo?: string | null) =>
  `<div class="head">${logo ? `<img class="logo" src="${esc(logo)}"/>` : ""}<div><h1>${esc(title)}</h1><div class="muted">${esc(subtitle)}</div></div></div>`;

async function sharePdf(html: string, title: string): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf", dialogTitle: title });
    else Alert.alert("Partage indisponible", "Le partage de fichiers n'est pas disponible sur cet appareil.");
  } catch {
    Alert.alert("Erreur", "Impossible de générer le PDF. Réessayez.");
  }
}

// ── Reçu de paiement ──────────────────────────────────────
/** QR de vérification imprimé sur le reçu (lot 14) : `qr` = image PNG (data-URL), `url` = adresse de contrôle, `code` = code court. */
export interface ReceiptSeal { qr: string; url: string; code: string }

/** Adresse de contrôle d'un reçu sur le serveur (page publique : l'appareil photo d'un téléphone suffit). */
export function receiptVerifyUrl(code: string): string {
  return `${getApiBaseUrl()}/verify/receipt/${encodeURIComponent(code)}`;
}

/** `side` : le marchand voit commission et net ; le client voit seulement ce qu'il a payé. */
export function buildReceiptHtml(p: PaymentRequestView, side: "merchant" | "payer", logo?: string | null, seal?: ReceiptSeal | null): string {
  const line = (k: string, v: string, strong = false) => `<div class="row"><span>${esc(k)}</span><span${strong ? ' style="font-weight:800"' : ""}>${esc(v)}</span></div>`;
  const rows = [
    line("Référence", p.reference),
    line("Date", shortDateTime(p.paidAt ?? p.createdAt)),
    line("Moyen", p.viaStaticQr ? METHOD.STATIC_QR : p.method === "QR" ? METHOD.QR : METHOD.PHONE),
    side === "merchant" && p.payer ? line("Client", p.payer.name) : "",
    side === "payer" ? line("Commerce", p.merchant.businessName) : "",
    side === "merchant" && p.fee !== undefined ? line("Commission", money(p.fee, p.currency)) : "",
    side === "merchant" && p.netAmount !== undefined ? line("Net reçu", money(p.netAmount, p.currency), true) : "",
    p.note ? line("Libellé", p.note) : "",
    p.refunded ? line("Remboursé le", p.refundedAt ? shortDateTime(p.refundedAt) : "—") : "",
    p.refunded && p.refundReason ? line("Motif du remboursement", p.refundReason) : "",
  ].join("");
  return `<html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body>
    ${head(p.merchant.businessName, [p.merchant.address, p.merchant.city].filter(Boolean).join(" · ") || "Reçu de paiement", logo)}
    <div class="muted">${side === "payer" ? "Vous avez payé" : "Paiement encaissé"}</div>
    <div class="big">${esc(money(p.amount, p.currency))}</div>
    <span class="tag${p.refunded ? " red" : ""}">${p.refunded ? "Remboursé" : "Payé"}</span>
    <h2>Détail</h2>${rows}
    ${seal ? `<div class="seal"><img src="${esc(seal.qr.startsWith("data:") ? seal.qr : `data:image/png;base64,${seal.qr}`)}"/><div>
      <b>Vérifier l'authenticité de ce reçu</b>
      <div class="muted">Scannez ce QR code avec l'appareil photo de votre téléphone : le serveur affiche le vrai montant, le commerce, la date et le statut du paiement. Comparez-les avec ce document. S'ils diffèrent, le reçu a été modifié.</div>
      <div class="code">${esc(seal.code)}</div></div></div>` : ""}
    <div class="foot">Reçu généré par Direct Transf'air — ${esc(new Date().toLocaleDateString("fr-FR"))}</div>
  </body></html>`;
}

export function shareReceipt(p: PaymentRequestView, side: "merchant" | "payer", logo?: string | null, seal?: ReceiptSeal | null) {
  return sharePdf(buildReceiptHtml(p, side, logo, seal), `Reçu ${p.reference}`);
}

// ── Clôture / rapport ─────────────────────────────────────
function totalsTable(t: CurrencyTotalsView[]): string {
  if (t.length === 0) return `<p class="muted">Aucun encaissement.</p>`;
  return t.map((x) => `
    <h2>${esc(x.currency)}</h2>
    <table>
      <tr><td>Paiements encaissés</td><td class="r">${x.count}</td></tr>
      <tr><td>Montant payé par les clients</td><td class="r">${esc(money(x.gross, x.currency))}</td></tr>
      <tr><td>Commissions</td><td class="r">− ${esc(money(x.fees, x.currency))}</td></tr>
      <tr><td>Net encaissé</td><td class="r">${esc(money(x.net, x.currency))}</td></tr>
      <tr><td>Remboursements (${x.refundsCount})</td><td class="r">− ${esc(money(x.refundsTotal, x.currency))}</td></tr>
      <tr><td><b>Variation du solde</b></td><td class="r"><b>${esc(money(x.balanceChange, x.currency))}</b></td></tr>
    </table>
    <div class="muted" style="margin-top:6px">Téléphone ${x.byMethod.PHONE} · QR code ${x.byMethod.QR} · QR de caisse ${x.byMethod.STATIC_QR}</div>
    ${x.byCashierNamed.length > 1 || x.byCashierNamed.some((c) => c.userId) ? `<table style="margin-top:8px">${x.byCashierNamed.map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${c.count} paiement(s)</td><td class="r">${esc(money(c.gross, x.currency))}</td></tr>`).join("")}</table>` : ""}`).join("");
}

export function buildDayHtml(d: DayView, logo?: string | null): string {
  const closed = d.closings.length > 0;
  return `<html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body>
    ${head(d.shop.businessName, `${closed ? "Clôture de caisse" : "Relevé de journée (non clôturée)"} — ${d.day}`, logo)}
    ${totalsTable(d.live)}
    ${d.closings.length ? `<h2>Clôturé le</h2>${d.closings.map((c) => `<div class="row"><span>${esc(c.currency)}</span><span>${esc(shortDateTime(c.closedAt))}</span></div>`).join("")}` : ""}
    ${d.drift ? `<p class="muted" style="color:#b42318">Attention : des mouvements sont arrivés après la clôture.</p>` : ""}
    <div class="foot">Direct Transf'air — document généré le ${esc(new Date().toLocaleString("fr-FR"))}</div>
  </body></html>`;
}

export function shareDayPdf(d: DayView, logo?: string | null) {
  return sharePdf(buildDayHtml(d, logo), `Journée ${d.day}`);
}

export function buildReportHtml(r: MerchantReport, logo?: string | null): string {
  const pays = r.payments.map((p) => `<tr><td>${esc(shortDateTime(p.at ?? ""))}</td><td>${esc(p.reference)}</td><td>${esc(METHOD[p.method])}</td><td>${esc(p.payer ?? "")}</td><td>${esc(p.cashier ?? "")}</td><td class="r">${esc(money(p.amount, p.currency))}${p.refunded ? " (remb.)" : ""}</td><td class="r">${esc(money(p.net, p.currency))}</td></tr>`).join("");
  const refs = r.refunds.map((f) => `<tr><td>${esc(shortDateTime(f.at ?? ""))}</td><td>${esc(f.reference)}</td><td>${esc(f.payer ?? "")}</td><td>${esc(f.reason ?? "")}</td><td class="r">− ${esc(money(f.amount, f.currency))}</td></tr>`).join("");
  return `<html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body>
    ${head(r.shop.businessName, `Encaissements du ${r.period.from} au ${r.period.to}`, logo)}
    ${totalsTable(r.totals)}
    <h2>Paiements</h2>
    <table><tr><th>Date</th><th>Réf.</th><th>Moyen</th><th>Client</th><th>Caissier</th><th class="r">Payé</th><th class="r">Net</th></tr>${pays || '<tr><td colspan="7" class="muted">Aucun paiement.</td></tr>'}</table>
    ${refs ? `<h2>Remboursements</h2><table><tr><th>Date</th><th>Réf.</th><th>Client</th><th>Motif</th><th class="r">Montant</th></tr>${refs}</table>` : ""}
    ${r.truncated ? `<p class="muted">Liste limitée : réduisez la période pour tout voir.</p>` : ""}
    <div class="foot">Direct Transf'air — document généré le ${esc(new Date().toLocaleString("fr-FR"))}</div>
  </body></html>`;
}

export function shareReportPdf(r: MerchantReport, logo?: string | null) {
  return sharePdf(buildReportHtml(r, logo), `Encaissements ${r.period.from} → ${r.period.to}`);
}

/** CSV : partagé comme texte via la feuille native (« Enregistrer dans Fichiers », Excel, e-mail…). */
export async function shareCsv(csv: { filename: string; body: string }): Promise<void> {
  try {
    await Share.share({ title: csv.filename, message: csv.body });
  } catch {
    Alert.alert("Erreur", "Impossible de partager l'export.");
  }
}

// ── Affiche du QR de caisse ───────────────────────────────
/** `qrDataUrl` : image PNG du QR (base64) obtenue depuis le composant QRCode de l'écran. */
export function buildPosterHtml(q: StaticQrView, qrDataUrl: string, logo?: string | null): string {
  const png = qrDataUrl.startsWith("data:") ? qrDataUrl : `data:image/png;base64,${qrDataUrl}`;
  return `<html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;text-align:center;margin:0;padding:48px 32px;color:#111}
    .logo{width:96px;height:96px;border-radius:20px;object-fit:cover;margin-bottom:10px}
    h1{font-size:34px;margin:6px 0} .city{color:#6b6b6b;font-size:16px;margin-bottom:24px}
    .qr{width:440px;height:440px;border:2px solid #111;border-radius:24px;padding:18px}
    .cta{font-size:26px;font-weight:800;margin-top:26px} .sub{font-size:15px;color:#555;margin-top:8px}
  </style></head><body>
    ${logo ? `<img class="logo" src="${esc(logo)}"/>` : ""}
    <h1>${esc(q.businessName)}</h1><div class="city">${esc(q.city ?? "")}</div>
    <img class="qr" src="${esc(png)}"/>
    <div class="cta">Scannez pour payer</div>
    <div class="sub">Ouvrez Direct Transf'air · Payer avec QR code · saisissez le montant</div>
  </body></html>`;
}

export async function sharePoster(q: StaticQrView, qrDataUrl: string, logo?: string | null, print = false) {
  const html = buildPosterHtml(q, qrDataUrl, logo);
  if (!print) return sharePdf(html, "Affiche QR de caisse");
  try { await Print.printAsync({ html }); } catch { Alert.alert("Erreur", "Impression impossible."); }
}

export type { ClosingView };
