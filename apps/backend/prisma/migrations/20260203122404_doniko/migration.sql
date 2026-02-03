-- AlterEnum
ALTER TYPE "ProviderStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WithdrawalStatus" ADD VALUE 'FAILED';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "cash" DECIMAL(12,2) NOT NULL DEFAULT 0;
