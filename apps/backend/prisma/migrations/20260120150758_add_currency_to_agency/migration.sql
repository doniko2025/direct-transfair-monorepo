-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'XOF';
