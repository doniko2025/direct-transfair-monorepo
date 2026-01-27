-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_beneficiaryId_fkey";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "recipientId" TEXT,
ALTER COLUMN "beneficiaryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
