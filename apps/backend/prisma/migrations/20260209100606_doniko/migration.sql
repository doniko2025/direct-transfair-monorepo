/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'SERVICE_PAYMENT');

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('SUBSIDIARY', 'PARTNER');

-- CreateEnum
CREATE TYPE "CommissionSourceType" AS ENUM ('SUBSIDIARY', 'PARTNER', 'WALLET');

-- CreateEnum
CREATE TYPE "CommissionDestType" AS ENUM ('SUBSIDIARY', 'PARTNER');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "type" "AgencyType" NOT NULL DEFAULT 'SUBSIDIARY';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "receivedAmount" DECIMAL(12,2),
ADD COLUMN     "targetCurrency" TEXT,
ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'TRANSFER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpCode" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpType" TEXT;

-- CreateTable
CREATE TABLE "CommissionConfig" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "sourceType" "CommissionSourceType" NOT NULL,
    "destType" "CommissionDestType" NOT NULL,
    "senderShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payerShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformShare" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionConfig_clientId_sourceType_destType_key" ON "CommissionConfig"("clientId", "sourceType", "destType");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
