// =========================================================
// DIRECT TRANSF'AIR — Types v4.5 (MISSING TYPES ADDED)
// =========================================================

// =========================================================
// UTILS
// =========================================================

export type ISODate = string;
export type CurrencyCode = Currency | (string & {});

// =========================================================
// ENUMS & BASE TYPES
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

export type CommsStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "DELIVERED"
  | "READ"
  | "BOUNCED";

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

export type ScheduledFrequency =
  | "ONCE"
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY";

export type ScheduledStatus =
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RateAlertDirection = "ABOVE" | "BELOW";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WebhookStatus = "PENDING" | "SUCCESS" | "FAILED" | "RETRYING";

export type LedgerEntryType =
  | "CREDIT"
  | "DEBIT"
  | "HOLD"
  | "UNHOLD"
  | "ADJUSTMENT";

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

export type ClientSubscriptionStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "TRIAL";

export type ClientSubscriptionType = "RENTAL" | "PURCHASE";

export type KycDocumentType =
  | "PASSPORT"
  | "ID_CARD"
  | "RESIDENCE_PERMIT"
  | "DRIVING_LICENSE"
  | "UTILITY_BILL"
  | "BANK_STATEMENT"
  | "OTHER";

export type KycDocumentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type CommissionType = "PERCENTAGE" | "FIXED" | "TIERED";

export type PromotionType = "PERCENTAGE" | "FIXED" | "FREE_FEES";

export type AmlFlagReason =
  | "HIGH_AMOUNT"
  | "FREQUENT_TRANSFERS"
  | "SUSPICIOUS_PATTERN"
  | "BLACKLISTED_COUNTRY"
  | "OTHER";

// =========================================================
// WALLET
// =========================================================

export interface Wallet {
  id: string;
  currency: CurrencyCode;
  balance: number;
  reservedBalance?: number;
  isDefault?: boolean;
  isActive?: boolean;
  userId?: string;
  agencyId?: string;
  clientId?: number;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

// =========================================================
// LEDGER
// =========================================================

export interface LedgerEntry {
  id: string;
  walletId: string;
  type: LedgerEntryType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: CurrencyCode;
  reference?: string;
  description?: string;
  transactionId?: string;
  createdAt: ISODate;
}

// =========================================================
// AUTH / LOGIN
// =========================================================

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface LoginStep1Response {
  userId: string;
  channels: Array<"EMAIL" | "PHONE">;
  message?: string;
}

export interface VerifyLoginOtpPayload {
  userId: string;
  code: string;
  deviceId?: string;
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

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  country?: string;
  role?: Role;
  referralCode?: string;
  [key: string]: unknown;
}

export interface ChangePasswordPayload {
  oldPassword?: string;
  currentPassword?: string;
  newPassword: string;
  password?: string;
}
// =========================================================
// USER
// =========================================================

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;

  firstName?: string;
  lastName?: string;

  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;

  primaryCurrency?: CurrencyCode;

  gender?: "M" | "F";
  nationality?: string;
  birthDate?: ISODate;
  birthPlace?: string;

  jobTitle?: string;
  agencyName?: string;

  ibanNumber?: string | null;
  bankName?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;

  loyaltyPoints?: number;
  loyaltyTier?: LoyaltyTier;

  kycLevel?: KycLevel;

  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isActive?: boolean;
  isSuspended?: boolean;
  mfaEnabled?: boolean;
  lastLoginAt?: ISODate | null;

  clientId: number;
  agencyId?: string;

  /** @deprecated */
  balance?: number;

  wallets?: Wallet[];

  client?: Client;
  agency?: Agency;
}

export type User = AuthUser;

export interface UserDevice {
  id: string;
  userId: string;
  platform: DevicePlatform;
  deviceName?: string;
  deviceId?: string;
  pushToken?: string;
  status: DeviceStatus;
  lastSeenAt?: ISODate;
  createdAt?: ISODate;
}

export interface RegisterDevicePayload {
  platform: DevicePlatform;
  deviceName?: string;
  deviceId?: string;
  pushToken?: string;
}

// =========================================================
// OTP / NOTIFICATIONS
// =========================================================

export interface OtpLog {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  channel: CommsType;
  status: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED";
  createdAt: ISODate;
  expiresAt?: ISODate;
  verifiedAt?: ISODate;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  channel?: NotificationChannel;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: ISODate;
}

// =========================================================
// TRANSACTION
// =========================================================

export interface Transaction {
  id: string;
  reference: string;
  amount: number;
  fees: number;
  total: number;
  currency: CurrencyCode;
  targetCurrency?: CurrencyCode;
  exchangeRate?: number;
  receivedAmount?: number;
  status: TransactionStatus;
  payoutMethod: PayoutMethod;
  senderId?: string;
  beneficiaryId?: string;

  senderCommission?: number;
  loyaltyPointsEarned?: number;

  createdAt: ISODate;
  updatedAt?: ISODate;
}

export interface CreateTransactionPayload {
  amount: number;
  currency: CurrencyCode;
  beneficiaryId?: string;
  payoutMethod: PayoutMethod;
  note?: string;
  promoCode?: string;
  [key: string]: unknown;
}

// =========================================================
// EXCHANGE
// =========================================================

export interface ExchangeRate {
  id?: string;
  pair: string;
  rate: number;
  inverseRate?: number;
  changePercent?: number;
  updatedAt?: ISODate;
}

export interface ExchangeRateHistory {
  pair: string;
  rate: number;
  recordedAt: ISODate;
}

// =========================================================
// BENEFICIARY
// =========================================================

export interface Beneficiary {
  id: string | number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  country: string;
  city?: string | null;
  address?: string | null;
  relationship?: string | null;
  notes?: string | null;
  phoneDialCode?: string | null;
  phoneNumber?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;
  userId?: string;
  clientId?: number;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export interface CreateBeneficiaryPayload {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  country: string;
  city?: string | null;
  address?: string | null;
  relationship?: string | null;
  notes?: string | null;
  phoneDialCode?: string | null;
  phoneNumber?: string | null;
  mobileMoneyOperator?: string | null;
  mobileMoneyNumber?: string | null;
}

// =========================================================
// AGENCY / CLIENT
// =========================================================

export interface Agency {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  primaryCurrency?: CurrencyCode;
  isActive?: boolean;
  isCertified?: boolean;
  clientName?: string | null;   // ✅ AJOUTER
  clientCode?: string | null;   // ✅ AJOUTER
  clientId: number;
  type?: string;
  wallets?: Wallet[];
  // ✅ AJOUT — agents renvoyés par agencies.service.ts dans findOne/findAllByClient
  agents?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    role: string;
    isActive?: boolean;
    primaryCurrency?: CurrencyCode;
    wallets?: Wallet[];
    balance?: number;
  }>;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}
 

export interface CreateAgencyPayload {
  name: string;
  code?: string;
  address: string;
  phone?: string;
  email?: string;
  adminEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  managerName?: string;
  country?: string;
  currency?: string;
  primaryCurrency?: string;
  city?: string;
  subscriptionType?: ClientSubscriptionType;
  status?: string;
  [key: string]: unknown;
}

export interface Client {
  id: number;
  name: string;
  code: string;
  country?: string | null;
  city?: string | null;
  defaultCurrency?: CurrencyCode | null;
  allowedCurrencies?: CurrencyCode[];
  subscriptionStatus?: ClientSubscriptionStatus;
  subscriptionType?: ClientSubscriptionType;
  subscriptionStart?: ISODate | null;
  subscriptionEnd?: ISODate | null;
  trialEndsAt?: ISODate | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  activitySector?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerBirthDate?: ISODate | null;
  ownerBirthPlace?: string | null;
  ownerCountry?: string | null;
  ownerAddress?: string | null;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminPassword?: string | null;
  featureScheduledTransfers?: boolean;
  featureRateAlerts?: boolean;
  featureLoyaltyPoints?: boolean;
  createdAt?: ISODate;
  wallets?: Wallet[];
}

// =========================================================
// EXTRA DOMAIN (v4.3)
// =========================================================

export interface Withdrawal {
  id: string;
  transactionId?: string;
  amount: number;
  currency: CurrencyCode;
  code?: string;
  status: TransactionStatus;
  agencyId?: string;
  userId?: string;
  paidAt?: ISODate;
  createdAt: ISODate;
}

export interface ScheduledTransfer {
  id: string;
  userId: string;
  beneficiaryId: string;
  amount: number;
  currency: CurrencyCode;
  frequency: ScheduledFrequency;
  status: ScheduledStatus;
  nextRunAt?: ISODate;
  createdAt: ISODate;
}

export interface CreateScheduledTransferPayload {
  beneficiaryId: string;
  amount: number;
  currency: CurrencyCode;
  frequency: ScheduledFrequency;
  startDate?: ISODate;
  note?: string;
}

export interface RateAlert {
  id: string;
  userId: string;
  pair: string;
  targetRate: number;
  direction: RateAlertDirection;
  isTriggered: boolean;
  createdAt: ISODate;
  triggeredAt?: ISODate;
}

export interface CreateRateAlertPayload {
  pair: string;
  targetRate: number;
  direction: RateAlertDirection;
}

// =========================================================
// KYC
// =========================================================

export interface KycDocument {
  id: string;
  userId: string;
  type: KycDocumentType;
  status: KycDocumentStatus;
  fileUrl?: string;
  fileName?: string;
  rejectionReason?: string;
  expiresAt?: ISODate;
  reviewedAt?: ISODate;
  reviewedBy?: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
}

export interface SubmitKycPayload {
  type: KycDocumentType;
  fileUrl: string;
  fileName?: string;
  expiresAt?: ISODate;
  [key: string]: unknown;
}

// =========================================================
// TREASURY
// =========================================================

export interface TreasuryOverview {
  currency: CurrencyCode;
  symbol?: string;

  // ✅ Champs réels du backend
  balance: number;
  reservedBalance: number;
  availableBalance: number;

  totalSentToday?: number;
  totalReceivedToday?: number;
  totalFeesToday?: number;
  transactionCountToday?: number;

  // Anciens champs conservés pour rétrocompatibilité
  totalBalance?: number;
  clientBalance?: number;
  agencyBalance?: number;
  userBalance?: number;
  pendingTransactions?: number;
  date?: ISODate;

  // Snapshot fields
  closingBalance?: number;
  openingBalance?: number;
  totalSent?: number;
  totalReceived?: number;
  totalFees?: number;
}

// ✅ AJOUT — TreasurySnapshot manquant
export interface TreasurySnapshot {
  id?: string;
  currency: CurrencyCode;
  date?: ISODate;
  openingBalance: number;
  closingBalance: number;
  totalSent: number;
  totalReceived: number;
  totalFees: number;
  totalCommission: number;
  clientId?: number;
  createdAt?: ISODate;
}

// =========================================================
// COMMISSIONS
// =========================================================

export interface CommissionRule {
  id?: string;
  name?: string;
  type: CommissionType;
  value: number;
  minAmount?: number;
  maxAmount?: number;
  currency?: CurrencyCode;
  targetCurrency?: CurrencyCode;
  agencyId?: string;
  clientId?: number;
  isActive?: boolean;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

// =========================================================
// LOYALTY
// =========================================================

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  points: number;
  type: "EARNED" | "REDEEMED" | "EXPIRED" | "ADJUSTED";
  description?: string;
  transactionId?: string;
  createdAt: ISODate;
}

export interface LoyaltyConfig {
  pointsPerUnit: number;
  currency: CurrencyCode;
  minRedeemPoints: number;
  pointValue: number;
  tiers: Array<{
    tier: LoyaltyTier;
    minPoints: number;
    bonusMultiplier: number;
  }>;
}

// =========================================================
// PROMOTIONS
// =========================================================

export interface Promotion {
  id: string;
  code: string;
  type: PromotionType;
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  currency?: CurrencyCode;
  usageLimit?: number;
  usageCount?: number;
  isActive: boolean;
  startsAt?: ISODate;
  expiresAt?: ISODate;
  createdAt: ISODate;
}

// =========================================================
// AML
// =========================================================

export interface AmlFlag {
  id: string;
  userId: string;
  transactionId?: string;
  reason: AmlFlagReason;
  description?: string;
  severity: AlertSeverity;
  isReviewed: boolean;
  resolution?: string;
  reviewedBy?: string;
  reviewedAt?: ISODate;
  createdAt: ISODate;
}

// =========================================================
// ALERTS (Admin)
// =========================================================

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  type?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: ISODate;
  metadata?: Record<string, unknown>;
  createdAt: ISODate;
}

// =========================================================
// COMMUNICATIONS
// =========================================================

export interface CommunicationLog {
  id: string;
  userId?: string;
  type: CommsType;
  status: CommsStatus;
  recipient: string;
  subject?: string;
  body?: string;
  provider?: string;
  errorMessage?: string;
  sentAt?: ISODate;
  deliveredAt?: ISODate;
  createdAt: ISODate;
}

// =========================================================
// AUDIT LOGS
// =========================================================

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: ISODate;
}

// =========================================================
// WEBHOOKS
// =========================================================

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  clientId?: number;
  createdAt: ISODate;
  updatedAt?: ISODate;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  statusCode?: number;
  responseBody?: string;
  attempt: number;
  deliveredAt?: ISODate;
  createdAt: ISODate;
}

// =========================================================
// API KEYS
// =========================================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  ipWhitelist?: string[];
  isActive: boolean;
  lastUsedAt?: ISODate;
  expiresAt?: ISODate;
  createdAt: ISODate;
}

// =========================================================
// COUNTRY CURRENCY
// =========================================================

export interface CountryCurrency {
  countryCode: string;
  countryName: string;
  currencyCode: CurrencyCode;
  currencyName?: string;
}

// =========================================================
// GENERIC
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