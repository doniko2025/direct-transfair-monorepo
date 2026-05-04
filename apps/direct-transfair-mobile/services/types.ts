// =========================================================
// DIRECT TRANSF'AIR — Types v4.4 (FUSION COMPLETE)
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
  oldPassword: string;
  newPassword: string;
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
  clientId: number;
  wallets?: Wallet[];
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