// apps/backend/src/bills/bills.pdf.ts
// =========================================================
// REÇU DE FACTURE EN PDF (lot 14b) — pdfkit, polices intégrées : aucun fichier externe, rien à installer.
//   Aux couleurs et au nom de LA société qui a encaissé la facture (chaque société tient son catalogue et son image) ;
//   montants, facturier, référence saisie, numéro d'opération et jeton éventuel ; code de vérification imprimé en toutes lettres.
//   Fonction pure : elle reçoit des données déjà prêtes (aucune lecture en base) → testable, et jamais de donnée interne
//   (coordonnées de règlement, note interne, état du partenariat) : le reçu ne contient que ce que le client voit déjà.
// =========================================================

import PDFDocument from 'pdfkit';

import { platform } from '../common/platform.config';
import { formatDateFr, formatMoney, pdfText } from '../contracts/contract-format';

export interface BillReceiptPdfData {
  company: { name: string; address?: string | null; city?: string | null; phone?: string | null; email?: string | null; color?: string | null };
  receiptNumber: string;
  billerName: string;
  billerCategoryLabel: string;
  referenceLabel: string;
  accountRef: string;
  customerName?: string | null;
  extraFields: Array<{ label: string; value: string }>;
  amount: number;
  fee: number;
  currency: string;
  walletCurrency: string;
  amountCharged: number;
  feeCharged: number;
  totalCharged: number;
  providerRef?: string | null;
  token?: string | null;
  receiptNote?: string | null;
  paidAt: Date;
  completedAt: Date;
  payerName: string;
  verifyCode: string;
  /** Adresse complète de vérification (facultative : absente tant que PUBLIC_API_URL n'est pas réglée). */
  verifyUrl?: string | null;
  simulated?: boolean;
}

const INK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const SOFT = '#F3F4F6';
const M = 48;
const PAGE_W = 595.28;
const W = PAGE_W - M * 2;

const CATEGORY_FR: Record<string, string> = {
  ELECTRICITY: 'Électricité', WATER: 'Eau', GAS: 'Gaz', INTERNET_TV: 'Internet / TV', TELECOM: 'Téléphonie',
  INSURANCE_AUTO: 'Assurance auto', INSURANCE_MOTO: 'Assurance moto', INSURANCE_HOME: 'Assurance habitation', INSURANCE_HEALTH: 'Assurance santé',
  SCHOOL_FEES: 'Frais de scolarité', UNIVERSITY_FEES: 'Frais universitaires', RENT: 'Loyer', TAXES: 'Impôts et taxes', HEALTH: 'Santé', TRANSPORT: 'Transport', OTHER: 'Autre',
};

/** Libellé français d'une catégorie ; une catégorie saisie par la société (« ABONNEMENT_SALLE ») est affichée lisiblement. */
export function categoryLabelFr(code: string): string {
  if (CATEGORY_FR[code]) return CATEGORY_FR[code];
  const t = code.toLowerCase().replace(/_/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'Autre';
}

/** Couleur #RRGGBB valide, sinon celle de la plateforme (une couleur saisie à la main ne doit jamais casser le PDF). */
export function safeColor(c: string | null | undefined, fallback: string): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim() : fallback;
}

export function renderBillReceiptPdf(d: BillReceiptPdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const brand = safeColor(d.company.color, platform.brandColor);
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M, bottom: 20, left: M, right: M },
      info: { Title: pdfText(`Reçu de facture ${d.receiptNumber}`), Author: pdfText(d.company.name), Subject: pdfText(`${d.billerName} — ${d.accountRef}`), Creator: pdfText(platform.name) },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Bandeau ────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 96).fill(brand);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(pdfText(d.company.name), M, 30, { width: W * 0.62 });
    doc.font('Helvetica').fontSize(10).text('Reçu de paiement de facture', M, 58, { width: W * 0.62 });
    doc.font('Helvetica-Bold').fontSize(10).text(pdfText(d.receiptNumber), PAGE_W - M - 190, 34, { width: 190, align: 'right' });
    doc.font('Helvetica').fontSize(9).text(pdfText(formatDateFr(d.completedAt)), PAGE_W - M - 190, 50, { width: 190, align: 'right' });

    // ── Montant ────────────────────────────────────────
    let y = 124;
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Montant réglé au facturier', M, y);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(30).text(formatMoney(d.amount, d.currency), M, y + 14, { width: W });
    y += 62;
    doc.fillColor('#17803D').font('Helvetica-Bold').fontSize(11).text('PAYÉ', M, y);
    y += 26;

    // ── Détail ─────────────────────────────────────────
    const row = (label: string, value: string, bold = false) => {
      doc.rect(M, y, W, 26).fill(bold ? SOFT : '#FFFFFF');
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(pdfText(label), M + 10, y + 8, { width: W * 0.38 });
      doc.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(pdfText(value), M + W * 0.4, y + 8, { width: W * 0.58, align: 'right' });
      doc.moveTo(M, y + 26).lineTo(M + W, y + 26).strokeColor(LINE).lineWidth(0.5).stroke();
      y += 26;
    };
    row('Facturier', d.billerName);
    row('Catégorie', d.billerCategoryLabel);
    row(d.referenceLabel, d.accountRef);
    if (d.customerName) row('Titulaire', d.customerName);
    for (const f of d.extraFields) row(f.label, f.value);
    if (d.providerRef) row('N° d\'opération du facturier', d.providerRef);
    if (d.token) row('Jeton / code', d.token, true);
    row('Facture', formatMoney(d.amount, d.currency));
    if (d.fee > 0) row('Frais de service', formatMoney(d.fee, d.currency));
    row('Total débité de votre portefeuille', formatMoney(d.totalCharged, d.walletCurrency), true);
    row('Payé le', formatDateFr(d.paidAt, true));
    row('Réglé au facturier le', formatDateFr(d.completedAt, true));
    row('Payeur', d.payerName);
    if (d.receiptNote) {
      y += 8;
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9).text(pdfText(d.receiptNote), M, y, { width: W });
      y = doc.y + 4;
    }

    // ── Vérification ───────────────────────────────────
    y += 16;
    const boxTop = y;
    doc.roundedRect(M, boxTop, W, d.verifyUrl ? 92 : 76, 8).fill(SOFT);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text('Vérifier ce reçu', M + 14, boxTop + 12);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Ce code permet à toute personne qui reçoit ce document (propriétaire, assureur, école…) de vérifier qu\'il est authentique et non modifié.', M + 14, boxTop + 27, { width: W - 28 });
    doc.fillColor(INK).font('Courier-Bold').fontSize(9).text(pdfText(d.verifyCode), M + 14, boxTop + 50, { width: W - 28 });
    if (d.verifyUrl) doc.fillColor(brand).font('Helvetica').fontSize(8.5).text(pdfText(d.verifyUrl), M + 14, boxTop + 68, { width: W - 28, link: d.verifyUrl, underline: true });

    // ── Pied de page ───────────────────────────────────
    const contact = [d.company.address, d.company.city, d.company.phone, d.company.email].filter(Boolean).join(' · ');
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    if (d.simulated) doc.fillColor('#B42318').font('Helvetica-Bold').text('DOCUMENT DE SIMULATION — aucun argent n\'a été versé à un vrai facturier.', M, 752, { width: W, align: 'center' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(pdfText(contact || d.company.name), M, 772, { width: W, align: 'center' });
    doc.text(pdfText(`Document généré par ${platform.name}. Le reçu officiel est celui du facturier ; ce document atteste du paiement effectué via ${d.company.name}.`), M, 786, { width: W, align: 'center' });

    doc.end();
  });
}
