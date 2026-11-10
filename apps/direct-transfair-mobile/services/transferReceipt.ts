// apps/direct-transfair-mobile/services/transferReceipt.ts
// =========================================================
// REÇU D'ENVOI — le document est construit PAR LE SERVEUR (GET /transactions/:id/receipt) à partir de l'opération enregistrée :
// société (logo, agrément…), parties, montants, taux, agences, code signé du QR. Le téléphone ne fait que le mettre en page
// (écran, PDF, impression). Le QR porte l'adresse de la page publique de vérification, qui contient le code signé :
//   • n'importe quel téléphone (appareil photo) ou lecteur de codes → page « reçu authentique » (montant, bénéficiaire, statut) ;
//   • l'application agent ou une scanette → le code signé est envoyé tel quel à /withdrawals/agent/check puis /agent/pay.
// =========================================================

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { api } from "./api";
import { getApiBaseUrl } from "./serverConfig";
import { tr, getLang, getLocale } from "../i18n/runtime";

export type ReceiptTone = "ok" | "info" | "warn" | "bad";

export interface ReceiptParty { name: string; phone: string | null; country: string | null; city: string | null }

export interface TransferReceiptDoc {
  v: number;
  company: {
    name: string; legalName: string | null; logoUrl: string | null; address: string | null; city: string | null; phone: string | null;
    email: string | null; website: string | null; licence: string | null; capital: string | null; primaryColor: string | null;
  };
  reference: string;
  kind: "CASH_TRANSFER" | "WALLET_TRANSFER" | "MOBILE_MONEY_TRANSFER" | "BANK_TRANSFER" | "DEPOSIT" | "WITHDRAWAL" | "OTHER";
  title: string;
  status: string;
  statusLabel: string;
  statusTone: ReceiptTone;
  viewerSide: "SENDER" | "RECIPIENT" | "AGENT" | "ADMIN";
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  sender: ReceiptParty;
  recipient: ReceiptParty;
  recipientPhoneHidden: boolean;
  payout: { method: string; methodLabel: string; country: string | null };
  amounts: { sent: number; sentCurrency: string; fees: number; total: number; rate: number | null; received: number | null; receivedCurrency: string | null };
  hero: { label: string; amount: number; currency: string };
  agency: { originName: string | null; originCity: string | null; payerName: string | null; payerCity: string | null; payerAgent: string | null };
  withdrawalCode: string | null;
  qr: { code: string; payable: boolean };
  showSignatures: boolean;
}

export async function fetchTransferReceipt(transactionId: string): Promise<TransferReceiptDoc> {
  const res = await api.http.get(`/transactions/${encodeURIComponent(transactionId)}/receipt`);
  return res.data as TransferReceiptDoc;
}

/** Adresse encodée dans le QR : page publique de contrôle (contient le code signé). */
export function transferVerifyUrl(code: string): string {
  return `${getApiBaseUrl()}/verify/transfer/${encodeURIComponent(code)}`;
}

const TONE: Record<ReceiptTone, { bg: string; fg: string }> = {
  ok: { bg: "#E8F6EE", fg: "#17803D" },
  info: { bg: "#E8F0FE", fg: "#1A56C4" },
  warn: { bg: "#FFF4E0", fg: "#A15C00" },
  bad: { bg: "#FDEAEA", fg: "#B42318" },
};
export const toneColors = (t: ReceiptTone) => TONE[t];

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function fmtAmount(n: number, currency: string): string {
  const zero = currency === "GNF" || currency === "XOF" || currency === "XAF";
  let s: string;
  try { s = new Intl.NumberFormat(getLocale(), { minimumFractionDigits: zero ? 0 : 2, maximumFractionDigits: zero ? 0 : 2 }).format(n); }
  catch { s = n.toFixed(zero ? 0 : 2); }
  return `${s.replace(/[  ]/g, " ")} ${currency === "XOF" || currency === "XAF" ? "F CFA" : currency}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(getLocale(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Libellé de pays : « GN » → « Guinée » (repli : le code tel quel). */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "";
  try { return new Intl.DisplayNames([getLang() === "pt" ? "pt-PT" : getLang()], { type: "region" }).of(code.toUpperCase()) ?? code; }
  catch { return code; }
}

const partyLines = (p: ReceiptParty, phoneHidden = false): string => {
  const place = [p.city, countryLabel(p.country)].filter(Boolean).join(", ");
  return `<div class="pn">${esc(p.name)}</div>${p.phone ? `<div class="pl">${esc(p.phone)}</div>` : phoneHidden ? `<div class="pl">${esc(tr("rcpt.phoneHidden"))}</div>` : ""}${place ? `<div class="pl">${esc(place)}</div>` : ""}`;
};

/** HTML du PDF / de l'impression. `qr` = image PNG (data-URL) du QR, indispensable : un reçu sans moyen de contrôle ne doit pas circuler. */
export function buildTransferReceiptHtml(d: TransferReceiptDoc, qr: string): string {
  const accent = /^#[0-9a-f]{6}$/i.test(d.company.primaryColor ?? "") ? (d.company.primaryColor as string) : "#059669";
  const tone = TONE[d.statusTone];
  const a = d.amounts;
  const row = (k: string, v: string, strong = false) => `<div class="r"><span>${esc(k)}</span><b${strong ? ' class="s"' : ""}>${esc(v)}</b></div>`;
  const url = transferVerifyUrl(d.qr.code);
  const companyLines = [d.company.legalName && d.company.legalName !== d.company.name ? d.company.legalName : null, d.company.address, d.company.city, d.company.phone, d.company.email, d.company.website]
    .filter(Boolean).map((x) => esc(x)).join(" · ");
  const legal = [d.company.licence, d.company.capital ? tr("rcpt.capital", { value: d.company.capital }) : null].filter(Boolean).map((x) => esc(x)).join(" · ");

  return `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:0;padding:0;background:#fff}
.page{max-width:720px;margin:0 auto}
.top{padding:22px 26px 16px;border-bottom:4px solid ${accent};display:flex;align-items:center;gap:14px}
.logo{width:60px;height:60px;border-radius:12px;object-fit:contain;flex:none}.co{flex:1}.co b{font-size:19px;display:block}.co span{font-size:10.5px;color:#666;line-height:1.5}
.kind{text-align:right;font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
.hero{padding:20px 26px 6px}.hl{font-size:11px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.ha{font-size:36px;font-weight:800;margin:4px 0 10px;word-break:break-word}
.badge{display:inline-block;padding:6px 12px;border-radius:99px;font-weight:800;font-size:12px;background:${tone.bg};color:${tone.fg}}
.sec{padding:10px 26px 0}.st{font-size:11px;color:#666;font-weight:800;text-transform:uppercase;letter-spacing:.8px;margin:12px 0 6px}
.parties{display:flex;gap:12px}.party{flex:1;background:#f6f6f4;border-radius:12px;padding:12px}.pr{font-size:10px;color:#777;font-weight:800;text-transform:uppercase;margin-bottom:4px}
.pn{font-size:14px;font-weight:800}.pl{font-size:11.5px;color:#555;margin-top:2px}
.r{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}.r span{color:#666}.r b{text-align:right}.r b.s{font-size:15px}
.code{margin:14px 26px 0;border:2px dashed ${accent};border-radius:14px;padding:12px 16px;text-align:center}.code .k{font-size:10.5px;color:#666;font-weight:800;text-transform:uppercase}.code .v{font-size:30px;font-weight:800;letter-spacing:5px;margin-top:4px;font-family:Menlo,Consolas,monospace}
.seal{display:flex;gap:16px;align-items:center;margin:18px 26px 0;padding:14px;border:1.5px solid #111;border-radius:14px}.seal img{width:132px;height:132px;flex:none}
.seal b{font-size:13px}.seal .m{font-size:11px;color:#555;margin-top:5px;line-height:1.45}.seal .u{font-family:Menlo,Consolas,monospace;font-size:9.5px;word-break:break-all;color:#333;margin-top:6px}
.sig{display:flex;gap:14px;margin:18px 26px 0}.sig div{flex:1;border:1px solid #ccc;border-radius:10px;height:78px;padding:8px;font-size:10px;color:#777}
.foot{margin:22px 26px 24px;border-top:1px solid #ddd;padding-top:10px;font-size:9.5px;color:#888;line-height:1.55;text-align:center}
</style></head><body><div class="page">
<div class="top">${d.company.logoUrl ? `<img class="logo" src="${esc(d.company.logoUrl)}"/>` : ""}<div class="co"><b>${esc(d.company.name)}</b><span>${companyLines}</span></div><div class="kind">${esc(tr("rcpt.pdf.receipt"))}<br/>${esc(d.title)}</div></div>
<div class="hero"><div class="hl">${esc(d.hero.label)}</div><div class="ha">${esc(fmtAmount(d.hero.amount, d.hero.currency))}</div><span class="badge">${esc(d.statusLabel)}</span></div>
<div class="sec">${row(tr("rcpt.reference"), d.reference, true)}${row(tr("rcpt.issued"), fmtDateTime(d.createdAt))}${d.paidAt ? row(tr("rcpt.paidOn"), fmtDateTime(d.paidAt)) : ""}${d.expiresAt ? row(tr("rcpt.collectBefore"), fmtDateTime(d.expiresAt)) : ""}${row(tr("rcpt.payoutMode"), d.payout.methodLabel)}</div>
<div class="sec"><div class="st">${esc(tr("rcpt.parties"))}</div><div class="parties"><div class="party"><div class="pr">${esc(tr("rcpt.sender"))}</div>${partyLines(d.sender)}</div><div class="party"><div class="pr">${esc(tr("rcpt.beneficiary"))}</div>${partyLines(d.recipient, d.recipientPhoneHidden)}</div></div></div>
<div class="sec"><div class="st">${esc(tr("rcpt.financial"))}</div>${row(tr("rcpt.sent"), fmtAmount(a.sent, a.sentCurrency))}${row(tr("rcpt.fees"), fmtAmount(a.fees, a.sentCurrency))}${row(tr("rcpt.total"), fmtAmount(a.total, a.sentCurrency), true)}${a.rate && a.receivedCurrency ? row(tr("rcpt.rate"), `1 ${a.sentCurrency} = ${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 6 }).format(a.rate)} ${a.receivedCurrency}`) : ""}${a.received && a.receivedCurrency ? row(tr("rcpt.receivedAmt"), fmtAmount(a.received, a.receivedCurrency), true) : ""}</div>
${d.agency.originName || d.agency.payerName ? `<div class="sec"><div class="st">${esc(tr("rcpt.agencies"))}</div>${d.agency.originName ? row(tr("rcpt.originAt"), [d.agency.originName, d.agency.originCity].filter(Boolean).join(" — ")) : ""}${d.agency.payerName ? row(tr("rcpt.paidAt"), [d.agency.payerName, d.agency.payerCity].filter(Boolean).join(" — ")) : ""}${d.agency.payerAgent ? row(tr("rcpt.payerAgent"), d.agency.payerAgent) : ""}</div>` : ""}
${d.withdrawalCode ? `<div class="code"><div class="k">${esc(tr("rcpt.pdf.code"))}</div><div class="v">${esc(d.withdrawalCode)}</div></div>` : ""}
<div class="seal"><img src="${qr}"/><div><b>${esc(d.qr.payable ? tr("rcpt.pdf.qrPay") : tr("rcpt.pdf.qrVerify"))}</b><div class="m">${d.qr.payable ? esc(tr("rcpt.pdf.qrAgent")) : ""}${esc(tr("rcpt.pdf.qrAny"))}</div><div class="u">${esc(url)}</div></div></div>
${d.showSignatures ? `<div class="sig"><div>${esc(tr("rcpt.pdf.sigBenef"))}</div><div>${esc(tr("rcpt.pdf.sigAgent"))}</div></div>` : ""}
<div class="foot">${legal ? legal + "<br/>" : ""}${esc(tr("rcpt.pdf.foot", { ref: d.reference, contact: d.company.email || d.company.phone || d.company.name }))}</div>
</div></body></html>`;
}

export async function shareTransferReceiptPdf(d: TransferReceiptDoc, qr: string): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildTransferReceiptHtml(d, qr) });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf", dialogTitle: tr("rcpt.shareTitle", { ref: d.reference }) });
    else Alert.alert(tr("rcpt.shareUnavail"), tr("rcpt.shareUnavailMsg"));
  } catch {
    Alert.alert(tr("common.error"), tr("rcpt.pdfFail"));
  }
}

export async function printTransferReceipt(d: TransferReceiptDoc, qr: string): Promise<void> {
  try { await Print.printAsync({ html: buildTransferReceiptHtml(d, qr) }); }
  catch { Alert.alert(tr("common.error"), tr("rcpt.printFail")); }
}

/** Ce que contient un QR/une saisie d'agent : code signé (TF…) ou adresse qui le contient. true si c'est un reçu signé. */
export function looksLikeSignedReceipt(raw: string): boolean {
  let t = String(raw ?? "").trim();
  try { t = decodeURIComponent(t); } catch { /* tel quel */ }
  return /TF\d{6,14}\.[A-Za-z0-9_-]{22}/.test(t);
}
