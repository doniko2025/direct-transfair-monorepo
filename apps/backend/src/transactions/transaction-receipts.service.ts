// apps/backend/src/transactions/transaction-receipts.service.ts
// =========================================================
// REÇUS D'ENVOI — document complet (société, parties, montants, agences, code signé du QR) + vérification publique du QR.
//   • forUser()  : GET /transactions/:id/receipt — authentifié, même visibilité que le détail d'une opération.
//   • check()    : GET /verify/transfer/:code    — public (le QR se scanne avec n'importe quel téléphone) : noms réduits, jamais de
//                  téléphone, de commission, de solde ni de pièce d'identité.
// Le document est construit ICI à partir de l'opération enregistrée : le téléphone ne fait que le mettre en page.
// =========================================================

import { Injectable, NotFoundException } from '@nestjs/common';

import { CompanySettingsService } from '../company-settings/company-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import {
  buildTransferReceipt, isPayableNow, kindOf, maskName, statusInfo, KIND_TITLE,
  type PublicTransferCheck, type ReceiptCompany, type TransferReceiptDoc,
} from './transfer-receipt';
import { extractTransferReceiptCode, transferReceiptCode, verifyTransferSeal } from './transfer-receipt-seal';

type ClientRow = {
  name: string; legalCompanyName: string | null; logoUrl: string | null; address: string | null; city: string | null; phone: string | null;
  email: string | null; website: string | null; supportEmail: string | null; regulatorName: string | null; regulatorAcronym: string | null;
  regulatorLicenseNumber: string | null; regulatorLicenseType: string | null; capitalSocial: string | null; primaryColor: string | null;
};

export function companyOf(c: ClientRow): ReceiptCompany {
  const authority = c.regulatorAcronym || c.regulatorName;
  const licence = authority || c.regulatorLicenseNumber
    ? [c.regulatorLicenseType, authority, c.regulatorLicenseNumber].filter(Boolean).join(' — ')
    : null;
  return {
    name: c.name,
    legalName: c.legalCompanyName ?? null,
    logoUrl: c.logoUrl ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    phone: c.phone ?? null,
    email: c.supportEmail ?? c.email ?? null,
    website: c.website ?? null,
    licence,
    capital: c.capitalSocial ?? null,
    primaryColor: c.primaryColor ?? null,
  };
}

const CLIENT_SELECT = {
  name: true, legalCompanyName: true, logoUrl: true, address: true, city: true, phone: true, email: true, website: true, supportEmail: true,
  regulatorName: true, regulatorAcronym: true, regulatorLicenseNumber: true, regulatorLicenseType: true, capitalSocial: true, primaryColor: true,
} as const;

@Injectable()
export class TransactionReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly settings: CompanySettingsService,
  ) {}

  async forUser(id: string, userId: string): Promise<TransferReceiptDoc> {
    const { tx, viewer } = await this.transactions.receiptSourceFor(id, userId);
    const client = await this.prisma.client.findUnique({ where: { id: tx.clientId }, select: CLIENT_SELECT });
    if (!client) throw new NotFoundException('Société introuvable');
    const company = await this.settings.forClient(tx.clientId);
    return buildTransferReceipt({
      // La ligne lue en base porte ses relations : on les range dans la forme attendue par le constructeur de reçu.
      src: { tx, sender: tx.sender, recipient: tx.recipient, beneficiary: tx.beneficiary, counterCustomer: tx.counterCustomer, agency: tx.agency, withdrawal: tx.withdrawal },
      company: companyOf(client),
      viewer,
      qrCode: transferReceiptCode({ id: tx.id, reference: tx.reference, amount: tx.amount, currency: tx.currency, createdAt: tx.createdAt }),
      phoneCheckRequired: !!company.pickup.requireBeneficiaryPhoneCheck,
    });
  }

  /** Vérification publique. Toute erreur (code mal formé, référence inconnue, signature fausse) donne la même réponse : pas d'indice. */
  async check(raw: string): Promise<PublicTransferCheck | { valid: false }> {
    const parsed = extractTransferReceiptCode(String(raw ?? '').slice(0, 200));
    if (!parsed) return { valid: false };
    const tx = await this.prisma.transaction.findUnique({
      where: { reference: parsed.reference },
      select: {
        id: true, reference: true, type: true, status: true, payoutMethod: true, amount: true, currency: true, targetCurrency: true,
        receivedAmount: true, createdAt: true, paidAt: true, pickupExpiry: true, deletedAt: true,
        sender: { select: { firstName: true, lastName: true } },
        counterCustomer: { select: { firstName: true, lastName: true } },
        recipient: { select: { firstName: true, lastName: true } },
        beneficiary: { select: { fullName: true } },
        withdrawal: { select: { status: true } },
        client: { select: { name: true } },
      },
    });
    if (!tx || tx.deletedAt || !verifyTransferSeal(tx, parsed.signature)) return { valid: false };

    const kind = kindOf(tx.type, tx.payoutMethod);
    const st = statusInfo(tx.status, kind);
    const received = Number(tx.receivedAmount?.toString() ?? 0);
    const converted = !!tx.targetCurrency && tx.targetCurrency !== tx.currency && received > 0;
    const senderName = tx.counterCustomer ? `${tx.counterCustomer.firstName} ${tx.counterCustomer.lastName}` : [tx.sender?.firstName, tx.sender?.lastName].filter(Boolean).join(' ');
    const recipientName = tx.recipient ? [tx.recipient.firstName, tx.recipient.lastName].filter(Boolean).join(' ') : tx.beneficiary?.fullName ?? '';
    return {
      valid: true,
      reference: tx.reference,
      companyName: tx.client.name,
      status: tx.status,
      statusLabel: st.label,
      statusTone: st.tone,
      title: KIND_TITLE[kind],
      amount: converted ? received : Number(tx.amount.toString()),
      currency: converted ? (tx.targetCurrency as string) : tx.currency,
      sentAmount: Number(tx.amount.toString()),
      sentCurrency: tx.currency,
      createdAt: tx.createdAt.toISOString(),
      paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
      sender: maskName(senderName),
      recipient: maskName(recipientName),
      payable: isPayableNow(tx, tx.withdrawal?.status, new Date()),
    };
  }
}
