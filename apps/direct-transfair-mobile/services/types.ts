// apps/direct-transfair-mobile/services/types.ts
// =========================================================
// DIRECT TRANSF'AIR — Types v4.0
// ✅ Multi-Currency (XOF, EUR, USD, GNF, GBP)
// ✅ Phone Login + OTP every login
// ✅ Push Notifications (FCM/APNS)
// ✅ Scheduled Transfers, Rate Alerts, Loyalty
// ✅ KYC Levels, AML, Treasury Snapshots
// =========================================================

// =========================================================
// ENUMS & UNIONS DE BASE
// =========================================================

export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "AGENT" | "USER";

export type Currency = "XOF" | "EUR" | "USD" | "GNF" | "GBP";

export type KycLevel = "LEVEL_0" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export type DevicePlatform = "IOS" | "ANDROID" | "WEB" | "DESKTOP";

export type DeviceStatus = "TRUSTED" | "PENDING" | "REVOKED";

export type OtpPurpose =
  | "LOGIN"
  | "PASSWORD_RESET"
  | "PHONE_VERIFICATION"
  | "EMAIL_VERIFICATION"
  | "TRANSACTION_CONFIRM"
  | "WITHDRAWAL_CONFIRM"
  | "DEVICE_TRUST";

export type CommsType = "EMAIL" | "SMS" | "PUSH" | "IN_APP";

export type CommsStatus = "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "BOUNCED";

export type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "TRANSACTION"
  | "SECURITY"
  | "MARKETING"
  | "SYSTEM";

export type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS";

export type SessionStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export type ScheduledFrequency = "ONCE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type ScheduledStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";

export type RateAlertDirection = "ABOVE" | "BELOW";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WebhookStatus = "PENDING" | "SUCCESS" | "FAILED" | "RETRYING";

export type LedgerEntryType = "CREDIT" | "DEBIT" | "HOLD" | "UNHOLD" | "ADJUSTMENT";

// =========================================================
// WALLET (Multi-devises)
// =========================================================

export interface Wallet {
  id: string;
  currency: Currency | string;
  balance: number | string;
  reservedBalance?: number | string; // Fonds en attente de débit
  isDefault?: boolean;
  isActive?: boolean;
  userId?: string;
  agencyId?: string;
  clientId?: number;
  createdAt?: string;
  updatedAt?: string;
}

// =========================================================
// AUTHENTIFICATION & UTILISATEUR
// =========================================================

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null; // ✅ Login par téléphone
  role: Role;

  firstName?: string;
  lastName?: string;

  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string; // ISO alpha-2 — détermine la devise auto

  // Devise principale déduite du pays de résidence
  primaryCurrency?: Currency | string;

  gender?: "M" | "F";
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;

  jobTitle?: string;
  agencyName?: string;

  // Coordonnées bancaires
  ibanNumber?: string | null;
  bankName?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;

  // Fidélité
  loyaltyPoints?: number;
  loyaltyTier?: LoyaltyTier | string;

  // KYC
  kycLevel?: KycLevel;

  // Sécurité
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isActive?: boolean;
  isSuspended?: boolean;
  mfaEnabled?: boolean;
  lastLoginAt?: string | null;

  clientId: number;
  agencyId?: string;

  balance?: number; // Legacy — préférer wallets
  wallets?: Wallet[];

  // Relations
  client?: Client;
  agency?: Agency;
}

export type User = AuthUser;

// ─── Payloads Auth ───────────────────────────────────────

export interface LoginPayload {
  // Accepte email OU téléphone dans le champ identifier
  identifier?: string; // email ou numéro de téléphone
  email?: string;      // Rétrocompatibilité
  password: string;
}

export interface LoginStep1Response {
  // Retourné après vérification du mot de passe — avant OTP
  userId: string;
  otpSent: boolean;
  otpChannel: CommsType; // EMAIL ou SMS
  maskedRecipient: string; // "j***@gmail.com" ou "+224 6** ** ** 12"
}

export interface VerifyLoginOtpPayload {
  userId: string;
  code: string;
  deviceId?: string;
  trustDevice?: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantCode?: string;
  country?: string; // ISO alpha-2 — initialise primaryCurrency
  city?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
}

export interface ChangePasswordPayload {
  oldPass: string;
  newPass: string;
}

// ─── Appareils (Push FCM/APNS) ───────────────────────────

export interface UserDevice {
  id: string;
  userId: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  pushToken?: string | null;
  pushEnabled?: boolean;
  deviceId: string;
  deviceName?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  lastUsedAt?: string;
  trustedAt?: string | null;
  createdAt?: string;
}

export interface RegisterDevicePayload {
  deviceId: string;
  platform: DevicePlatform;
  pushToken?: string;
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

// ─── OTP ─────────────────────────────────────────────────

export interface OtpLog {
  id: string;
  purpose: OtpPurpose;
  channel: CommsType;
  recipient: string;
  isUsed: boolean;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

// =========================================================
// BÉNÉFICIAIRES
// =========================================================

export interface Beneficiary {
  id: string;
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  expectedCurrency?: Currency | string | null; // Devise déduite du pays
  bankName?: string | null;
  bankAccount?: string | null;
  bankIban?: string | null;
  bankBic?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;
  isFavorite?: boolean;
  transferCount?: number;
  userId: string;
  clientId?: number;
  createdAt?: string;
}

export interface CreateBeneficiaryPayload {
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  bankIban?: string | null;
  bankBic?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;
}

// =========================================================
// TRANSACTIONS
// =========================================================

export type TransactionStatus =
  | "PENDING"
  | "VALIDATED"
  | "PROCESSING"
  | "PAID"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED"
  | "ON_HOLD"
  | "EXPIRED";

export type PayoutMethod =
  | "CASH_PICKUP"
  | "BANK_DEPOSIT"
  | "MOBILE_MONEY"
  | "WALLET"
  | "IBAN_TRANSFER";

export type PaymentMethod =
  | "WALLET"
  | "ORANGE_MONEY"
  | "SENDWAVE"
  | "CARD"
  | "CASH"
  | "BANK_TRANSFER"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "PAYPAL";

export type TransactionType =
  | "TRANSFER"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "SERVICE_PAYMENT"
  | "INTERNAL_TRANSFER"
  | "FEE_COLLECTION"
  | "EXCHANGE"
  | "AGENCY_REFILL"
  | "REFUND"
  | "LOYALTY_CREDIT"
  | "SCHEDULED";

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface Transaction {
  id: string;
  reference: string;
  type?: TransactionType | string;
  paymentMethod?: PaymentMethod | string;

  amount: number;
  fees: number;
  total: number;

  // Multi-devise
  currency: Currency | string;           // Devise source
  targetCurrency?: Currency | string;    // Devise cible
  exchangeRate?: number;
  receivedAmount?: number;               // Montant après conversion

  // Commissions
  senderCommission?: number;
  payerCommission?: number;
  platformCommission?: number;

  status: TransactionStatus;
  payoutMethod: PayoutMethod;

  note?: string | null;
  pickupCode?: string | null;
  pickupExpiry?: string | null;

  // Fidélité
  loyaltyPointsEarned?: number;

  // Virement programmé
  scheduledTransferId?: string | null;

  // Provider
  providerRef?: string | null;
  providerMetadata?: Record<string, unknown> | null;

  // Participants
  senderId?: string;
  recipientId?: string | null;
  beneficiaryId?: string | null;
  agencyId?: string | null;

  // Relations
  sender?: AuthUser;
  beneficiary?: Beneficiary | null;
  agency?: Agency;
  withdrawal?: {
    id: string;
    status: WithdrawalStatus;
    method: PayoutMethod;
    code?: string;
    expiresAt?: string | null;
  } | null;

  // Horodatages
  createdAt: string;
  updatedAt?: string;
  validatedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
  expiresAt?: string | null;

  // Legacy
  senderFirstName?: string;
  senderLastName?: string;
}

export interface CreateTransactionPayload {
  amount: number;
  currency: Currency | string;
  targetCurrency?: Currency | string;
  beneficiaryId?: string;
  payoutMethod: PayoutMethod | string;
  paymentMethod?: PaymentMethod | string;
  note?: string;
  senderFirstName?: string;
  senderLastName?: string;
  senderPhone?: string;
  promotionCode?: string;
  scheduledTransferId?: string;
}

// =========================================================
// VIREMENTS PROGRAMMÉS
// =========================================================

export interface ScheduledTransfer {
  id: string;
  userId: string;
  clientId: number;
  beneficiaryId?: string | null;
  beneficiary?: Beneficiary | null;
  amount: number;
  currency: Currency | string;
  targetCurrency?: Currency | string | null;
  payoutMethod: PayoutMethod;
  note?: string | null;
  frequency: ScheduledFrequency;
  status: ScheduledStatus;
  nextExecutionAt: string;
  lastExecutedAt?: string | null;
  executionCount: number;
  maxExecutions?: number | null;
  failureReason?: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledTransferPayload {
  beneficiaryId?: string;
  amount: number;
  currency: Currency | string;
  targetCurrency?: Currency | string;
  payoutMethod: PayoutMethod | string;
  note?: string;
  frequency: ScheduledFrequency;
  startDate: string; // ISO datetime
  maxExecutions?: number;
}

// =========================================================
// TAUX DE CHANGE
// =========================================================

export interface ExchangeRate {
  id?: string;
  pair: string; // "EUR_GNF", "EUR_XOF", etc.
  rate: number;
  inverseRate?: number;
  changePercent?: number;
  source?: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface ExchangeRateHistory {
  id: string;
  pair: string;
  rate: number;
  recordedAt: string;
  source?: string;
}

// =========================================================
// ALERTES TAUX DE CHANGE
// =========================================================

export interface RateAlert {
  id: string;
  userId: string;
  pair: string;
  direction: RateAlertDirection;
  threshold: number;
  isTriggered: boolean;
  triggeredAt?: string | null;
  isActive: boolean;
  notifiedVia: CommsType[];
  createdAt: string;
}

export interface CreateRateAlertPayload {
  pair: string;
  direction: RateAlertDirection;
  threshold: number;
  notifiedVia?: CommsType[];
}

// =========================================================
// AGENCES
// =========================================================

export type AgencyType = "SUBSIDIARY" | "PARTNER";

export interface Agency {
  id: string | number;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  country?: string | null;      // ISO alpha-2 → devise auto
  primaryCurrency?: Currency | string; // Déduit du pays
  postalCode?: string | null;
  isActive?: boolean;
  isCertified?: boolean;
  type?: AgencyType;
  ibanNumber?: string | null;
  bankName?: string | null;
  bankBic?: string | null;
  clientId: number;
  createdAt?: string;
  managerName?: string;
  agents?: AuthUser[];
  balance?: number; // Legacy
  wallets?: Wallet[];
}

export interface CreateAgencyPayload {
  name: string;
  city: string;
  address: string;
  email: string;
  phone?: string;
  code?: string;
  country?: string; // ISO alpha-2 — initialise primaryCurrency
  postalCode?: string;
  managerName?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  status?: string;
  subscriptionType?: string;
  type?: AgencyType;
  ibanNumber?: string;
  bankName?: string;
  bankBic?: string;
}

// =========================================================
// SAAS CLIENTS (Sociétés)
// =========================================================

export type ClientSubscriptionStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "TRIAL"
  | string;

export type ClientSubscriptionType = "RENTAL" | "PURCHASE" | string;

export interface Client {
  id: number;
  name: string;
  code: string;
  country?: string | null;
  city?: string | null;
  defaultCurrency?: Currency | string | null;
  allowedCurrencies?: (Currency | string)[];
  subscriptionStatus?: ClientSubscriptionStatus;
  subscriptionType?: ClientSubscriptionType;
  subscriptionStart?: string | null;
  subscriptionEnd?: string | null;
  trialEndsAt?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  featureScheduledTransfers?: boolean;
  featureRateAlerts?: boolean;
  featureLoyaltyPoints?: boolean;
  createdAt?: string;
  wallets?: Wallet[];
}

// =========================================================
// TRÉSORERIE (Super Admin & Company Admin)
// =========================================================

export interface TreasurySnapshot {
  id: string;
  clientId?: number | null; // null = Super Admin global
  currency: Currency | string;
  date: string;
  totalSent: number;
  totalReceived: number;
  totalFees: number;
  totalCommission: number;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
  uniqueSenders: number;
}

// Vue groupée par devise pour les dashboards
export interface TreasuryOverview {
  currency: Currency | string;
  symbol: string;
  balance: number;
  totalSent: number;
  totalReceived: number;
  totalFees: number;
  transactionCount: number;
}

// =========================================================
// FIDÉLITÉ
// =========================================================

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  transactionId?: string | null;
  points: number; // positif = crédit, négatif = débit
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface LoyaltyConfig {
  id: string;
  clientId: number;
  pointsPerEuro: number;
  euroPerPoint: number;
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
  isActive: boolean;
}

// =========================================================
// NOTIFICATIONS IN-APP
// =========================================================

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  channels: NotificationChannel[];
  isRead: boolean;
  readAt?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  imageUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
  createdAt: string;
}

// =========================================================
// COMMUNICATIONS (Email, SMS, Push)
// =========================================================

export interface CommunicationLog {
  id: string;
  userId?: string | null;
  transactionId?: string | null;
  type: CommsType;
  recipient: string;
  subject?: string | null;
  status: CommsStatus;
  errorMsg?: string | null;
  retryCount: number;
  providerName?: string | null;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
}

// =========================================================
// KYC & AML
// =========================================================

export type KycStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type KycDocumentType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVER_LICENSE"
  | "RESIDENCE_PERMIT"
  | "SELFIE"
  | "PROOF_OF_ADDRESS"
  | "BANK_STATEMENT";

export interface KycDocument {
  id: string;
  userId: string;
  type: KycDocumentType;
  status: KycStatus;
  documentUrl: string;
  backUrl?: string | null;
  documentNumber?: string | null;
  expiryDate?: string | null;
  issuedCountry?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface SubmitKycPayload {
  type: KycDocumentType;
  documentUrl: string;
  backUrl?: string;
  documentNumber?: string;
  expiryDate?: string;
  issuedCountry?: string;
}

export interface AmlFlag {
  id: string;
  userId: string;
  transactionId?: string | null;
  reason: string;
  riskScore: number;
  isReviewed: boolean;
  resolution?: string | null;
  createdAt: string;
}

// =========================================================
// ALERTES
// =========================================================

export type AlertType =
  | "SUSPICIOUS_TRANSACTION"
  | "LARGE_WITHDRAWAL"
  | "MULTIPLE_FAILED_LOGIN"
  | "LOW_AGENCY_BALANCE"
  | "SUBSCRIPTION_EXPIRY"
  | "KYC_EXPIRED"
  | "AML_FLAG"
  | "RATE_ALERT_TRIGGERED"
  | "SCHEDULED_TRANSFER_FAILED"
  | "DEVICE_NEW_LOGIN";

export interface Alert {
  id: string;
  clientId?: number | null;
  userId?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
}

// =========================================================
// COMMISSIONS
// =========================================================

export interface CommissionConfig {
  id: string;
  clientId: number;
  sourceType: string;
  destType: string;
  currency?: string | null;
  senderShare: number;
  payerShare: number;
  platformShare: number;
  isActive: boolean;
  tiers?: CommissionTier[];
}

export interface CommissionTier {
  id: string;
  configId: string;
  minAmount: number;
  maxAmount?: number | null;
  senderShare: number;
  payerShare: number;
  platformShare: number;
  fixedFee?: number | null;
}

export interface CommissionRule {
  id?: string;
  sourceType: string;
  destType: string;
  currency?: string;
  senderShare: number;
  payerShare: number;
  platformShare: number;
  tiers?: Omit<CommissionTier, "id" | "configId">[];
}

// =========================================================
// RETRAITS
// =========================================================

export interface Withdrawal {
  id: string;
  transactionId: string;
  method: PayoutMethod;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt?: string | null;
  processedById?: string | null;
  recipientIban?: string | null;
  recipientBankName?: string | null;
  recipientMobileOp?: string | null;
  recipientMobileNum?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  clientId: number;
}

// =========================================================
// PROMOTIONS
// =========================================================

export type PromotionType =
  | "FREE_TRANSFER"
  | "REDUCED_FEE"
  | "BONUS_CREDIT"
  | "REFERRAL_BONUS"
  | "LOYALTY_DISCOUNT"
  | "FIRST_TRANSFER";

export interface Promotion {
  id: string;
  code: string;
  type: PromotionType;
  title: string;
  description?: string | null;
  discountValue: number;
  isPercentage: boolean;
  eligibleCurrencies?: (Currency | string)[];
  usageLimit?: number | null;
  usageCount: number;
  perUserLimit: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

// =========================================================
// COUNTRY CURRENCY MAP
// =========================================================

export interface CountryCurrency {
  countryCode: string;   // "FR", "GN", "GB", "US", "SN"
  countryName: string;
  currencyCode: Currency | string;
  currencyName: string;
  currencySymbol: string; // "€", "£", "$", "Fr"
  flagEmoji?: string;
  isSupported: boolean;
}

// =========================================================
// WEBHOOKS
// =========================================================

export interface WebhookEndpoint {
  id: string;
  clientId: number;
  url: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode?: number | null;
  status: WebhookStatus;
  attempts: number;
  createdAt: string;
}

// =========================================================
// API KEYS
// =========================================================

export interface ApiKey {
  id: string;
  clientId: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  ipWhitelist?: string[];
  createdAt: string;
}

// =========================================================
// AUDIT
// =========================================================

export type AuditAction =
  | "LOGIN"
  | "LOGIN_PHONE"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "OTP_REQUEST"
  | "OTP_VERIFY"
  | "TRANSACTION_CREATE"
  | "TRANSACTION_CANCEL"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "AGENCY_CREATE"
  | "KYC_SUBMIT"
  | "DEVICE_REGISTER"
  | string;

export interface AuditLog {
  id: string;
  userId?: string | null;
  clientId?: number | null;
  action: AuditAction;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  country?: string | null;
  successful: boolean;
  errorMsg?: string | null;
  createdAt: string;
}

// =========================================================
// LEDGER
// =========================================================

export interface LedgerEntry {
  id: string;
  walletId: string;
  transactionId?: string | null;
  type: LedgerEntryType;
  amount: number;
  currency: Currency | string;
  description?: string | null;
  balanceAfter: number;
  externalRef?: string | null;
  createdAt: string;
}

// =========================================================
// PAGINATION & RÉPONSES GÉNÉRIQUES
// =========================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}