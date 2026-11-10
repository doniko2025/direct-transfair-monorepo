// apps/backend/src/transactions/transfer-receipt.ts
// =========================================================
// REÇU D'UN ENVOI — construit CÔTÉ SERVEUR à partir de l'opération réelle (et non plus d'un paramètre passé d'un écran à l'autre) :
// un reçu ne peut donc plus afficher un montant que le serveur n'a pas enregistré. Le téléphone ne fait que le mettre en page
// (écran, PDF, impression) et y dessiner le QR code.
// Fonctions pures — aucune dépendance Nest/Prisma — testées dans transfer-receipt.spec.ts.
// Rien de confidentiel : ni commissions, ni scores de risque, ni soldes, ni pièces d'identité.
// =========================================================

export const RECEIPT_VERSION = 1;

export type ReceiptKind = 'CASH_TRANSFER' | 'WALLET_TRANSFER' | 'MOBILE_MONEY_TRANSFER' | 'BANK_TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL' | 'OTHER';
export type ReceiptTone = 'ok' | 'info' | 'warn' | 'bad';
export type ViewerSide = 'SENDER' | 'RECIPIENT' | 'AGENT' | 'ADMIN';

export const PAYOUT_LABEL: Record<string, string> = {
  CASH_PICKUP: 'Retrait en espèces en agence',
  WALLET: 'Crédit sur portefeuille',
  MOBILE_MONEY: 'Mobile Money',
  BANK_DEPOSIT: 'Dépôt bancaire',
  IBAN_TRANSFER: 'Virement bancaire',
  CRYPTO: 'Crypto-actif',
};

export interface ReceiptCompany {
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** « Autorité — N° 12345 » : agrément / régulateur, quand la société les a renseignés. */
  licence: string | null;
  capital: string | null;
  primaryColor: string | null;
}

export interface ReceiptParty {
  name: string;
  phone: string | null;
  country: string | null;
  city: string | null;
}

export interface TransferReceiptDoc {
  v: typeof RECEIPT_VERSION;
  company: ReceiptCompany;
  reference: string;
  kind: ReceiptKind;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: ReceiptTone;
  viewerSide: ViewerSide;
  createdAt: string;
  paidAt: string | null;
  /** Date limite pour retirer l'argent (envoi cash non encore payé). */
  expiresAt: string | null;
  sender: ReceiptParty;
  recipient: ReceiptParty;
  /** Le numéro du bénéficiaire est masqué (contrôle téléphonique exigé par la société, avant paiement) — pour un agent seulement. */
  recipientPhoneHidden: boolean;
  payout: { method: string; methodLabel: string; country: string | null };
  amounts: {
    sent: number;
    sentCurrency: string;
    fees: number;
    total: number;
    rate: number | null;
    received: number | null;
    receivedCurrency: string | null;
  };
  /** Montant mis en avant, avec son libellé (« Montant à retirer », « Montant payé »…). */
  hero: { label: string; amount: number; currency: string };
  agency: { originName: string | null; originCity: string | null; payerName: string | null; payerCity: string | null; payerAgent: string | null };
  /** Code de retrait en clair : réservé à l'expéditeur, tant que l'envoi cash n'est pas payé. */
  withdrawalCode: string | null;
  /** Code signé encodé dans le QR + indication « ce QR permet de payer ». */
  qr: { code: string; payable: boolean };
  showSignatures: boolean;
}

export interface ReceiptSource {
  tx: {
    id: string;
    reference: string;
    type: string;
    status: string;
    payoutMethod: string;
    amount: unknown;
    fees: unknown;
    total: unknown;
    currency: string;
    targetCurrency: string | null;
    exchangeRate: number | null;
    receivedAmount: unknown;
    createdAt: Date;
    paidAt?: Date | null;
    pickupExpiry?: Date | null;
    receiveCountry?: string | null;
    senderId: string;
    recipientId?: string | null;
    counterCustomerId?: string | null;
  };
  sender: { firstName: string | null; lastName: string | null; phone: string | null; country: string | null; city?: string | null } | null;
  counterCustomer: { firstName: string; lastName: string; phone: string } | null;
  recipient: { firstName: string | null; lastName: string | null; phone: string | null; country: string | null; city?: string | null } | null;
  beneficiary: { fullName: string; phone: string | null; country: string; city: string } | null;
  agency: { name: string; city: string | null } | null;
  withdrawal: {
    status: string;
    expiresAt: Date | null;
    processedAt: Date | null;
    processedBy: { firstName: string | null; lastName: string | null; agency: { name: string; city: string | null } | null } | null;
  } | null;
}

const num = (v: unknown): number => {
  const n = Number((v as { toString(): string } | null | undefined)?.toString() ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const full = (u: { firstName: string | null; lastName: string | null } | null | undefined): string =>
  [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function kindOf(type: string, payoutMethod: string): ReceiptKind {
  if (type === 'DEPOSIT') return 'DEPOSIT';
  if (type === 'WITHDRAWAL') return 'WITHDRAWAL';
  if (type === 'TRANSFER' || type === 'SCHEDULED') {
    if (payoutMethod === 'WALLET') return 'WALLET_TRANSFER';
    if (payoutMethod === 'MOBILE_MONEY') return 'MOBILE_MONEY_TRANSFER';
    if (payoutMethod === 'BANK_DEPOSIT' || payoutMethod === 'IBAN_TRANSFER') return 'BANK_TRANSFER';
    return 'CASH_TRANSFER';
  }
  return 'OTHER';
}

export const KIND_TITLE: Record<ReceiptKind, string> = {
  CASH_TRANSFER: "Envoi d'argent — retrait en agence",
  WALLET_TRANSFER: 'Transfert vers portefeuille',
  MOBILE_MONEY_TRANSFER: 'Transfert Mobile Money',
  BANK_TRANSFER: 'Virement bancaire',
  DEPOSIT: 'Dépôt en agence',
  WITHDRAWAL: 'Retrait',
  OTHER: 'Opération',
};

export function statusInfo(status: string, kind: ReceiptKind): { label: string; tone: ReceiptTone } {
  switch (status) {
    case 'PAID': return { label: kind === 'DEPOSIT' ? 'DÉPOSÉ' : 'PAYÉ', tone: 'ok' };
    case 'VALIDATED': return kind === 'CASH_TRANSFER' ? { label: 'DISPONIBLE — À RETIRER', tone: 'info' } : { label: 'EN COURS', tone: 'info' };
    case 'PROCESSING': return { label: 'EN COURS', tone: 'info' };
    case 'PENDING': return { label: 'EN ATTENTE DE VALIDATION', tone: 'warn' };
    case 'ON_HOLD': return { label: 'EN VÉRIFICATION', tone: 'warn' };
    case 'CANCELLED': return { label: 'ANNULÉ', tone: 'bad' };
    case 'FAILED': return { label: 'ÉCHOUÉ', tone: 'bad' };
    case 'EXPIRED': return { label: 'EXPIRÉ', tone: 'bad' };
    case 'REFUNDED': return { label: 'REMBOURSÉ', tone: 'warn' };
    default: return { label: status, tone: 'warn' };
  }
}

/** Un envoi cash que l'agent peut encore payer : c'est le seul cas où le QR sert à encaisser. */
export function isPayableNow(tx: { type: string; status: string; payoutMethod: string; pickupExpiry?: Date | null }, withdrawalStatus: string | null | undefined, now: Date): boolean {
  if (tx.type !== 'TRANSFER' && tx.type !== 'SCHEDULED') return false;
  if (tx.payoutMethod !== 'CASH_PICKUP' || tx.status !== 'VALIDATED') return false;
  if (withdrawalStatus && withdrawalStatus !== 'PENDING' && withdrawalStatus !== 'APPROVED') return false;
  if (tx.pickupExpiry && tx.pickupExpiry.getTime() <= now.getTime()) return false;
  return true;
}

export function buildTransferReceipt(input: {
  src: ReceiptSource;
  company: ReceiptCompany;
  viewer: { id: string; role: string };
  qrCode: string;
  /** Contrôle du téléphone du bénéficiaire exigé par la société pour payer en agence. */
  phoneCheckRequired: boolean;
  now?: Date;
}): TransferReceiptDoc {
  const { src, company, viewer } = input;
  const { tx } = src;
  const now = input.now ?? new Date();
  const kind = kindOf(tx.type, tx.payoutMethod);
  const st = statusInfo(tx.status, kind);

  const viewerSide: ViewerSide =
    viewer.role === 'SUPER_ADMIN' || viewer.role === 'COMPANY_ADMIN' ? 'ADMIN'
    : viewer.id === tx.senderId ? (viewer.role === 'AGENT' ? 'AGENT' : 'SENDER')
    : viewer.id === tx.recipientId ? 'RECIPIENT'
    : viewer.role === 'AGENT' ? 'AGENT'
    : 'SENDER';

  // Expéditeur : le client de passage quand l'envoi a été fait au comptoir par un agent, sinon le titulaire du compte.
  const counter = src.counterCustomer;
  const sender: ReceiptParty = counter
    ? { name: `${counter.firstName} ${counter.lastName}`.trim(), phone: counter.phone, country: null, city: null }
    : { name: full(src.sender) || 'Client', phone: src.sender?.phone ?? null, country: src.sender?.country ?? null, city: src.sender?.city ?? null };

  // Destinataire : titulaire du portefeuille crédité, sinon bénéficiaire enregistré.
  const recipient: ReceiptParty = src.recipient
    ? { name: full(src.recipient) || 'Client', phone: src.recipient.phone ?? null, country: src.recipient.country ?? null, city: src.recipient.city ?? null }
    : src.beneficiary
      ? { name: src.beneficiary.fullName, phone: src.beneficiary.phone, country: src.beneficiary.country, city: src.beneficiary.city }
      : { name: '—', phone: null, country: tx.receiveCountry ?? null, city: null };

  // Contrôle du téléphone : l'agent qui va payer ne doit pas lire le numéro complet (sinon le contrôle ne servirait à rien).
  const hidePhone = input.phoneCheckRequired && viewerSide === 'AGENT' && viewer.id !== tx.senderId && tx.status !== 'PAID' && !!recipient.phone;
  if (hidePhone) recipient.phone = null;

  const received = num(tx.receivedAmount);
  const converted = !!tx.targetCurrency && tx.targetCurrency !== tx.currency && received > 0;
  const payable = isPayableNow(tx, src.withdrawal?.status, now);

  const heroLabel =
    tx.status === 'PAID' ? (viewerSide === 'RECIPIENT' ? 'Montant crédité' : kind === 'DEPOSIT' ? 'Montant déposé' : 'Montant payé')
    : payable ? 'Montant à retirer'
    : tx.status === 'CANCELLED' || tx.status === 'FAILED' || tx.status === 'EXPIRED' || tx.status === 'REFUNDED' ? "Montant de l'envoi"
    : 'Montant du transfert';
  const hero = converted
    ? { label: heroLabel, amount: received, currency: tx.targetCurrency as string }
    : { label: heroLabel, amount: num(tx.amount), currency: tx.currency };

  const payer = src.withdrawal?.processedBy ?? null;

  return {
    v: RECEIPT_VERSION,
    company,
    reference: tx.reference,
    kind,
    title: KIND_TITLE[kind],
    status: tx.status,
    statusLabel: st.label,
    statusTone: st.tone,
    viewerSide,
    createdAt: tx.createdAt.toISOString(),
    paidAt: iso(tx.paidAt ?? (tx.status === 'PAID' ? src.withdrawal?.processedAt : null) ?? null),
    expiresAt: payable ? iso(src.withdrawal?.expiresAt ?? tx.pickupExpiry ?? null) : null,
    sender,
    recipient,
    recipientPhoneHidden: hidePhone,
    payout: { method: tx.payoutMethod, methodLabel: PAYOUT_LABEL[tx.payoutMethod] ?? tx.payoutMethod, country: recipient.country ?? tx.receiveCountry ?? null },
    amounts: {
      sent: num(tx.amount),
      sentCurrency: tx.currency,
      fees: num(tx.fees),
      total: num(tx.total) || num(tx.amount) + num(tx.fees),
      rate: converted && tx.exchangeRate ? Number(tx.exchangeRate) : null,
      received: converted ? received : null,
      receivedCurrency: converted ? (tx.targetCurrency as string) : null,
    },
    hero,
    agency: {
      originName: src.agency?.name ?? null,
      originCity: src.agency?.city ?? null,
      payerName: payer?.agency?.name ?? null,
      payerCity: payer?.agency?.city ?? null,
      payerAgent: payer ? full(payer) || null : null,
    },
    withdrawalCode: kind === 'CASH_TRANSFER' && payable && viewer.id === tx.senderId ? tx.reference : null,
    qr: { code: input.qrCode, payable },
    showSignatures: kind === 'CASH_TRANSFER' && tx.status === 'PAID' && viewerSide !== 'RECIPIENT',
  };
}

/** Nom d'un tiers réduit pour la page publique : « Moustapha D. ». */
export function maskName(name: string | null | undefined): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** Vérification PUBLIQUE d'un reçu (QR scanné par n'importe qui) : juste de quoi comparer avec le papier, noms réduits, jamais de téléphone. */
export interface PublicTransferCheck {
  valid: true;
  reference: string;
  companyName: string;
  status: string;
  statusLabel: string;
  statusTone: ReceiptTone;
  title: string;
  amount: number;
  currency: string;
  sentAmount: number;
  sentCurrency: string;
  createdAt: string;
  paidAt: string | null;
  sender: string;
  recipient: string;
  /** Un agent peut encore le payer avec ce QR (la page propose alors d'ouvrir l'application). */
  payable: boolean;
}
