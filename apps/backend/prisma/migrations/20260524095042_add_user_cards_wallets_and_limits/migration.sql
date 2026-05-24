/*
  Warnings:

  - The `primaryCurrency` column on the `agencies` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `expectedCurrency` column on the `beneficiaries` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `defaultCurrency` column on the `clients` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `allowedCurrencies` column on the `clients` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `commission_configs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `eligibleCurrencies` column on the `promotions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetCurrency` column on the `scheduled_transfers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetCurrency` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `primaryCurrency` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[providerRef]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `currencyCode` on the `country_currencies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `ledger_entries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `scheduled_transfers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `treasury_snapshots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `currency` on the `wallets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('XOF', 'EUR', 'USD', 'GNF', 'GBP');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('CLEAR', 'REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ComplianceCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SUPPORT_TICKET_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'COMPLIANCE_CASE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'COMPLIANCE_CASE_RESOLVE';

-- DropForeignKey
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_walletId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "deletedAt" TIMESTAMP(3),
DROP COLUMN "primaryCurrency",
ADD COLUMN     "primaryCurrency" "CurrencyCode" NOT NULL DEFAULT 'XOF',
ALTER COLUMN "creditLimit" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "beneficiaries" DROP COLUMN "expectedCurrency",
ADD COLUMN     "expectedCurrency" "CurrencyCode";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "featureCardPayments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "featureMobileWallets" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxMonthlyTransferAmount" DECIMAL(18,4),
ADD COLUMN     "maxYearlyTransferAmount" DECIMAL(18,4),
ADD COLUMN     "tenantId" INTEGER,
DROP COLUMN "defaultCurrency",
ADD COLUMN     "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'GNF',
ALTER COLUMN "maxDailyTransferAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "maxTransactionAmount" SET DATA TYPE DECIMAL(18,4),
DROP COLUMN "allowedCurrencies",
ADD COLUMN     "allowedCurrencies" "CurrencyCode"[] DEFAULT ARRAY['XOF', 'EUR', 'USD', 'GNF', 'GBP']::"CurrencyCode"[];

-- AlterTable
ALTER TABLE "commission_configs" ADD COLUMN     "description" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode";

-- AlterTable
ALTER TABLE "commission_tiers" ALTER COLUMN "minAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "maxAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "fixedFee" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "communication_logs" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "country_currencies" ADD COLUMN     "phonePrefix" TEXT,
ADD COLUMN     "region" TEXT,
DROP COLUMN "currencyCode",
ADD COLUMN     "currencyCode" "CurrencyCode" NOT NULL;

-- AlterTable
ALTER TABLE "exchange_rates" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "providerMetadata" JSONB,
ADD COLUMN     "spread" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "kyc_documents" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "counterpartWalletId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4),
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode" NOT NULL,
ALTER COLUMN "balanceAfter" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "promotions" ALTER COLUMN "minAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(18,4),
DROP COLUMN "eligibleCurrencies",
ADD COLUMN     "eligibleCurrencies" "CurrencyCode"[] DEFAULT ARRAY[]::"CurrencyCode"[];

-- AlterTable
ALTER TABLE "scheduled_transfers" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4),
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode" NOT NULL,
DROP COLUMN "targetCurrency",
ADD COLUMN     "targetCurrency" "CurrencyCode";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "direction" "TransactionDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "fees" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(18,4),
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode" NOT NULL,
DROP COLUMN "targetCurrency",
ADD COLUMN     "targetCurrency" "CurrencyCode",
ALTER COLUMN "receivedAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "senderCommission" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "payerCommission" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "platformCommission" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "treasury_snapshots" ADD COLUMN     "avgTransactionAmount" DECIMAL(18,4),
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "refundedAmount" DECIMAL(18,4),
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode" NOT NULL,
ALTER COLUMN "totalSent" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalReceived" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalFees" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalCommission" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "openingBalance" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "closingBalance" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "user_devices" ADD COLUMN     "fingerprintHash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'CLEAR',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "monthlySentAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "yearlySentAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
DROP COLUMN "primaryCurrency",
ADD COLUMN     "primaryCurrency" "CurrencyCode" NOT NULL DEFAULT 'XOF',
ALTER COLUMN "dailySentAmount" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "frozenReason" TEXT,
ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "currency",
ADD COLUMN     "currency" "CurrencyCode" NOT NULL,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "reservedBalance" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "webhook_deliveries" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "country" TEXT,
    "city" TEXT,
    "device" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL DEFAULT 'VISA',
    "cardholderName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "providerToken" TEXT,
    "providerName" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mobile_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "number" TEXT NOT NULL,
    "currency" "CurrencyCode",
    "alias" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mobile_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,
    "clientId" INTEGER,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ComplianceCaseStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" INTEGER,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_replies" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_history_userId_createdAt_idx" ON "login_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_cards_userId_idx" ON "user_cards"("userId");

-- CreateIndex
CREATE INDEX "user_mobile_wallets_userId_idx" ON "user_mobile_wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_mobile_wallets_userId_provider_number_key" ON "user_mobile_wallets"("userId", "provider", "number");

-- CreateIndex
CREATE INDEX "compliance_cases_status_idx" ON "compliance_cases"("status");

-- CreateIndex
CREATE INDEX "compliance_cases_clientId_idx" ON "compliance_cases"("clientId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_clientId_idx" ON "support_tickets"("clientId");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_ticket_replies_ticketId_idx" ON "support_ticket_replies"("ticketId");

-- CreateIndex
CREATE INDEX "beneficiaries_clientId_idx" ON "beneficiaries"("clientId");

-- CreateIndex
CREATE INDEX "clients_tenantId_idx" ON "clients"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_configs_clientId_sourceType_destType_currency_key" ON "commission_configs"("clientId", "sourceType", "destType", "currency");

-- CreateIndex
CREATE INDEX "country_currencies_currencyCode_idx" ON "country_currencies"("currencyCode");

-- CreateIndex
CREATE INDEX "exchange_rates_pair_isActive_idx" ON "exchange_rates"("pair", "isActive");

-- CreateIndex
CREATE INDEX "notifications_groupKey_idx" ON "notifications"("groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_providerRef_key" ON "transactions"("providerRef");

-- CreateIndex
CREATE INDEX "transactions_currency_targetCurrency_idx" ON "transactions"("currency", "targetCurrency");

-- CreateIndex
CREATE INDEX "transactions_isFlagged_idx" ON "transactions"("isFlagged");

-- CreateIndex
CREATE INDEX "treasury_snapshots_currency_date_idx" ON "treasury_snapshots"("currency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_snapshots_clientId_currency_date_key" ON "treasury_snapshots"("clientId", "currency", "date");

-- CreateIndex
CREATE INDEX "users_complianceStatus_idx" ON "users"("complianceStatus");

-- CreateIndex
CREATE INDEX "wallets_currency_idx" ON "wallets"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_currency_key" ON "wallets"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_agencyId_currency_key" ON "wallets"("agencyId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_clientId_currency_key" ON "wallets"("clientId", "currency");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mobile_wallets" ADD CONSTRAINT "user_mobile_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_cases" ADD CONSTRAINT "compliance_cases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_snapshots" ADD CONSTRAINT "treasury_snapshots_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_replies" ADD CONSTRAINT "support_ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
