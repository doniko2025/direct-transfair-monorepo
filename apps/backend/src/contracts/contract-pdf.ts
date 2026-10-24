// apps/backend/src/contracts/contract-pdf.ts
// =========================================================
// RENDU PDF DU CONTRAT (pdfkit, polices intégrées : aucun fichier externe)
//   • en-tête avec le logo « t’ » de la plateforme (le logo du Grand Chef), titre, référence ;
//   • cadres des deux parties, tableau des conditions essentielles, préambule, articles numérotés ;
//   • bloc de signature (Prestataire / Client avec la signature dessinée) ;
//   • page « Certificat de signature électronique » (signataire, date, adresse IP, empreintes) si le contrat est signé ;
//   • pied de page : référence, mention d'exemplaire, numérotation « Page x / y ».
// =========================================================

import PDFDocument from 'pdfkit';
import { platform } from '../common/platform.config';
import { contractConfig } from './contract-config';
import { formatDateFr, pdfText } from './contract-format';
import { contractLogoBuffer } from './contract-logo';
import type { ContractContent } from './contract-templates';

export interface SignatureProof {
  signedAt: Date;
  signerName: string;
  signerEmail: string;
  signerIp: string | null;
  signerUserAgent: string | null;
  /** PNG de la signature dessinée. */
  signaturePng: Buffer | null;
  contentHash: string;
}

const INK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#D1D5DB';
const SOFT = '#F3F4F6';

const M = { left: 56, right: 56, top: 56, bottom: 70 };
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - M.left - M.right;

export function renderContractPdf(content: ContractContent, proof?: SignatureProof | null): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const brand = platform.brandColor;
    const accent = platform.accentColor;
    const signed = !!proof;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
      bufferPages: true,
      info: {
        Title: pdfText(`${content.title} — ${content.reference}`),
        Author: pdfText(contractConfig.issuerName),
        Subject: pdfText(content.subtitle),
        Creator: pdfText(platform.name),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const bottomLimit = () => PAGE_H - M.bottom;
    const ensure = (needed: number) => {
      if (doc.y + needed > bottomLimit()) doc.addPage();
    };

    // ─── En-tête (page 1) ───────────────────────────────
    try {
      doc.image(contractLogoBuffer(), M.left, M.top - 8, { width: 54, height: 54 });
    } catch {
      /* le contrat reste valide sans logo */
    }
    doc.font('Helvetica-Bold').fontSize(17).fillColor(brand).text(pdfText(platform.name), M.left + 66, M.top + 4, { width: 300 });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(pdfText(`Édité par ${contractConfig.issuerName}`), M.left + 66, M.top + 26, { width: 300 });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(MUTED)
      .text(pdfText(`Réf. ${content.reference}`), PAGE_W - M.right - 180, M.top + 6, { width: 180, align: 'right' })
      .font('Helvetica')
      .text(pdfText(formatDateFr(content.issuedAt)), PAGE_W - M.right - 180, M.top + 20, { width: 180, align: 'right' });

    const barY = M.top + 56;
    doc.rect(M.left, barY, CONTENT_W, 3).fill(brand);
    doc.rect(M.left, barY, 70, 3).fill(accent);

    doc.y = barY + 28;
    doc.font('Helvetica-Bold').fontSize(19).fillColor(brand).text(pdfText(content.title), M.left, doc.y, { width: CONTENT_W, align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(pdfText(content.subtitle), M.left, doc.y, { width: CONTENT_W, align: 'center' });
    doc.moveDown(1.6);

    // ─── Parties ────────────────────────────────────────
    const sectionLabel = (text: string) => {
      ensure(40);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(accent === '#F5C32C' ? brand : accent).text(pdfText(text.toUpperCase()), M.left, doc.y, { width: CONTENT_W, characterSpacing: 1 });
      doc.moveDown(0.5);
    };

    sectionLabel('Entre les soussignés');
    const colGap = 14;
    const colW = (CONTENT_W - colGap) / 2;
    const partyHeight = (p: ContractContent['provider']) => {
      let h = 12 + 14 + 6;
      doc.font('Helvetica-Bold').fontSize(11);
      h += doc.heightOfString(pdfText(p.name), { width: colW - 24 }) + 4;
      doc.font('Helvetica').fontSize(9);
      for (const l of p.lines) h += doc.heightOfString(pdfText(l), { width: colW - 24 }) + 2;
      h += doc.heightOfString(pdfText(p.representative), { width: colW - 24 }) + 14;
      return h;
    };
    const boxH = Math.max(partyHeight(content.provider), partyHeight(content.customer));
    ensure(boxH + 10);
    const boxY = doc.y;
    [content.provider, content.customer].forEach((p, i) => {
      const x = M.left + i * (colW + colGap);
      doc.roundedRect(x, boxY, colW, boxH, 8).fillAndStroke(SOFT, LINE);
      let y = boxY + 12;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text(pdfText(p.role.toUpperCase()), x + 12, y, { width: colW - 24, characterSpacing: 0.8 });
      y += 14;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK);
      doc.text(pdfText(p.name), x + 12, y, { width: colW - 24 });
      y += doc.heightOfString(pdfText(p.name), { width: colW - 24 }) + 4;
      doc.font('Helvetica').fontSize(9).fillColor(INK);
      for (const l of p.lines) {
        doc.text(pdfText(l), x + 12, y, { width: colW - 24 });
        y += doc.heightOfString(pdfText(l), { width: colW - 24 }) + 2;
      }
      doc.font('Helvetica-Oblique').fillColor(MUTED).text(pdfText(p.representative), x + 12, y + 2, { width: colW - 24 });
    });
    doc.y = boxY + boxH + 18;

    // ─── Conditions essentielles ────────────────────────
    sectionLabel('Conditions essentielles');
    const labelW = 160;
    const rowsH = content.summary.map((r) => {
      doc.font('Helvetica').fontSize(9.5);
      return Math.max(doc.heightOfString(pdfText(r.value), { width: CONTENT_W - labelW - 28 }), 12) + 12;
    });
    const totalH = rowsH.reduce((a, b) => a + b, 0);
    ensure(totalH + 10);
    const sumY = doc.y;
    doc.roundedRect(M.left, sumY, CONTENT_W, totalH, 8).lineWidth(1).stroke(LINE);
    let ry = sumY;
    content.summary.forEach((r, i) => {
      if (i > 0) doc.moveTo(M.left + 12, ry).lineTo(M.left + CONTENT_W - 12, ry).lineWidth(0.5).stroke(LINE);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED).text(pdfText(r.label), M.left + 14, ry + 6, { width: labelW - 8 });
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(pdfText(r.value), M.left + 14 + labelW, ry + 6, { width: CONTENT_W - labelW - 28 });
      ry += rowsH[i];
    });
    doc.y = sumY + totalH + 20;

    // ─── Préambule ──────────────────────────────────────
    sectionLabel('Préambule');
    for (const para of content.preamble) {
      doc.font('Helvetica').fontSize(10).fillColor(INK);
      ensure(doc.heightOfString(pdfText(para), { width: CONTENT_W, align: 'justify', lineGap: 2.5 }) + 8);
      doc.text(pdfText(para), M.left, doc.y, { width: CONTENT_W, align: 'justify', lineGap: 2.5 });
      doc.moveDown(0.6);
    }
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Les parties conviennent de ce qui suit :', M.left, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);

    // ─── Articles ───────────────────────────────────────
    for (const art of content.articles) {
      const heading = pdfText(`Article ${art.number} — ${art.title}`);
      const first = art.paragraphs[0] ?? '';
      doc.font('Helvetica').fontSize(10);
      const firstH = doc.heightOfString(pdfText(first), { width: CONTENT_W, align: 'justify', lineGap: 2.5 });
      ensure(30 + Math.min(firstH, 60));
      doc.font('Helvetica-Bold').fontSize(11).fillColor(brand).text(heading, M.left, doc.y, { width: CONTENT_W });
      doc.moveDown(0.35);
      art.paragraphs.forEach((para) => {
        doc.font('Helvetica').fontSize(10).fillColor(INK);
        const h = doc.heightOfString(pdfText(para), { width: CONTENT_W, align: 'justify', lineGap: 2.5 });
        if (h < bottomLimit() - M.top) ensure(Math.min(h, 40));
        doc.text(pdfText(para), M.left, doc.y, { width: CONTENT_W, align: 'justify', lineGap: 2.5 });
        doc.moveDown(0.5);
      });
      doc.moveDown(0.4);
    }

    // Le texte de clôture et les signatures restent ensemble : une page de signature sans texte n'a pas de valeur.
    const sigH = 150;
    ensure(sigH + 110);
    for (const line of content.closing) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED);
      ensure(doc.heightOfString(pdfText(line), { width: CONTENT_W }) + 8);
      doc.text(pdfText(line), M.left, doc.y, { width: CONTENT_W, align: 'justify' });
      doc.moveDown(0.8);
    }

    // ─── Signatures ─────────────────────────────────────
    ensure(sigH + 40);
    sectionLabel('Signatures');
    const sy = doc.y;
    const provider = content.provider;
    const customer = content.customer;

    // Prestataire
    doc.roundedRect(M.left, sy, colW, sigH, 8).lineWidth(1).stroke(LINE);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text('POUR LE PRESTATAIRE', M.left + 12, sy + 12, { width: colW - 24, characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(provider.name), M.left + 12, sy + 28, { width: colW - 24 });
    doc.font('Helvetica').fontSize(9).fillColor(INK).text(pdfText(`${contractConfig.issuerRepresentative}, ${contractConfig.issuerTitle}`), M.left + 12, sy + 44, { width: colW - 24 });
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(pdfText(`Contrat émis le ${formatDateFr(content.issuedAt)}`), M.left + 12, sy + 62, { width: colW - 24 });
    try {
      doc.image(contractLogoBuffer(), M.left + 12, sy + 84, { width: 46, height: 46 });
    } catch {
      /* sans logo */
    }
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text('Émission du contrat valant engagement du Prestataire.', M.left + 66, sy + 100, { width: colW - 80 });

    // Client
    const cx = M.left + colW + colGap;
    doc.roundedRect(cx, sy, colW, sigH, 8).lineWidth(1).stroke(LINE);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text('POUR LE CLIENT', cx + 12, sy + 12, { width: colW - 24, characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(pdfText(customer.name), cx + 12, sy + 28, { width: colW - 24 });
    if (proof) {
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(pdfText(`${proof.signerName}`), cx + 12, sy + 44, { width: colW - 24 });
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(pdfText(`Lu et approuvé — signé le ${formatDateFr(proof.signedAt)}`), cx + 12, sy + 58, { width: colW - 24 });
      if (proof.signaturePng) {
        try {
          doc.image(proof.signaturePng, cx + 12, sy + 76, { fit: [colW - 24, 62] });
        } catch {
          /* signature illisible : le certificat reste la preuve */
        }
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text('« Lu et approuvé », date et signature :', cx + 12, sy + 48, { width: colW - 24 });
      doc.moveTo(cx + 12, sy + sigH - 24).lineTo(cx + colW - 12, sy + sigH - 24).lineWidth(0.6).stroke(LINE);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text('Exemplaire non signé — à signer en ligne via le lien reçu par e-mail.', cx + 12, sy + sigH - 18, { width: colW - 24 });
    }
    doc.y = sy + sigH + 10;

    // ─── Certificat de signature ────────────────────────
    if (proof) {
      doc.addPage();
      doc.rect(M.left, M.top, CONTENT_W, 3).fill(brand);
      doc.rect(M.left, M.top, 70, 3).fill(accent);
      doc.font('Helvetica-Bold').fontSize(17).fillColor(brand).text('Certificat de signature électronique', M.left, M.top + 20, { width: CONTENT_W });
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(
        pdfText(`Document : ${content.title} — réf. ${content.reference}`),
        M.left,
        doc.y + 4,
        { width: CONTENT_W },
      );
      doc.moveDown(1.4);

      const rows: [string, string][] = [
        ['Statut', 'Signé électroniquement par le Client'],
        ['Signataire', proof.signerName],
        ['Adresse e-mail du destinataire', proof.signerEmail],
        ['Société signataire', customer.name],
        ['Date et heure de signature', formatDateFr(proof.signedAt, true)],
        ['Date et heure (UTC)', proof.signedAt.toISOString()],
        ['Adresse IP du signataire', proof.signerIp ?? 'non disponible'],
        ['Navigateur', (proof.signerUserAgent ?? 'non disponible').slice(0, 220)],
        ['Mode de signature', "Lien sécurisé à usage unique envoyé par e-mail, signature manuscrite dessinée à l'écran, saisie du nom et case « Lu et approuvé » cochée"],
        ['Empreinte SHA-256 du contrat', proof.contentHash],
      ];
      for (const [k, v] of rows) {
        doc.font('Helvetica').fontSize(9.5);
        const h = Math.max(doc.heightOfString(pdfText(v), { width: CONTENT_W - 190 }), 12) + 14;
        ensure(h + 4);
        const y = doc.y;
        doc.rect(M.left, y, CONTENT_W, h).fill(SOFT);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED).text(pdfText(k), M.left + 12, y + 7, { width: 170 });
        doc.font(k.startsWith('Empreinte') ? 'Courier' : 'Helvetica').fontSize(k.startsWith('Empreinte') ? 8.5 : 9.5).fillColor(INK).text(pdfText(v), M.left + 190, y + 7, { width: CONTENT_W - 202 });
        doc.y = y + h + 4;
      }

      doc.moveDown(1);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
        pdfText(
          `L'empreinte ci-dessus identifie de façon unique le texte et les conditions du contrat tels qu'ils ont été présentés au signataire : toute modification du contrat en changerait la valeur. ` +
            `Ce certificat est conservé avec le contrat par ${contractConfig.issuerName}. La signature électronique a, entre les parties, la valeur d'une signature manuscrite (articles 1366 et 1367 du Code civil ; règlement (UE) n° 910/2014).`,
        ),
        M.left,
        doc.y,
        { width: CONTENT_W, align: 'justify', lineGap: 2 },
      );
    }

    // ─── Pieds de page ──────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = PAGE_H - 44;
      doc.page.margins.bottom = 0; // sans cela, écrire sous la marge ajouterait une page
      doc.moveTo(M.left, footerY - 8).lineTo(PAGE_W - M.right, footerY - 8).lineWidth(0.5).stroke(LINE);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      doc.text(
        pdfText(`${content.reference} — ${contractConfig.issuerName}${signed ? '' : ' — exemplaire non signé'}`),
        M.left,
        footerY,
        { width: CONTENT_W - 80, align: 'left', lineBreak: false },
      );
      doc.text(`Page ${i + 1} / ${range.count}`, PAGE_W - M.right - 80, footerY, { width: 80, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}
