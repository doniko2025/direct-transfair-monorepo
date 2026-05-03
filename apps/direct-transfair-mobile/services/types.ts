// apps/direct-transfair-mobile/services/types.ts

// =========================================================
// DIRECT TRANSF'AIR — Types v4.1 (safe refactor)
// =========================================================

// =========================================================
// UTILS TYPES
// =========================================================

export type ISODate = string;

// Permet extension sans casser autocomplete
export type CurrencyCode = Currency | (string & {});

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
// AUTH USER
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

  /** @deprecated use wallets */
  balance?: number;
  wallets?: Wallet[];

  client?: Client;
  agency?: Agency;
}

export type User = AuthUser;

// =========================================================
// TRANSACTION
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

  createdAt: ISODate;
  updatedAt?: ISODate;
}

// =========================================================
// AGENCY (FIX ID)
// =========================================================

export interface Agency {
  id: string; // ✅ FIX
  name: string;
  city: string;
  address: string;

  phone?: string | null;
  email?: string | null;

  country?: string | null;
  primaryCurrency?: CurrencyCode;

  isActive?: boolean;

  clientId: number;

  wallets?: Wallet[];
}

// =========================================================
// CLIENT (FIX MERGE)
// =========================================================

export type ClientSubscriptionStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "TRIAL";

export type ClientSubscriptionType = "RENTAL" | "PURCHASE";

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

  // merged fields
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