-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'ORANGE_MONEY', 'SENDWAVE', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DIRECT', 'ORANGE_MONEY', 'SENDWAVE');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'WALLET',
ADD COLUMN     "provider" "PaymentProvider",
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "providerStatus" "ProviderStatus" DEFAULT 'PENDING';
