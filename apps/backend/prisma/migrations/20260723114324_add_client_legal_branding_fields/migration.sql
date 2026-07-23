-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "capitalSocial" TEXT,
ADD COLUMN     "legalCompanyName" TEXT,
ADD COLUMN     "mediatorName" TEXT,
ADD COLUMN     "mediatorUrl" TEXT,
ADD COLUMN     "regulatorAcronym" TEXT,
ADD COLUMN     "regulatorLicenseNumber" TEXT,
ADD COLUMN     "regulatorLicenseType" TEXT,
ADD COLUMN     "regulatorName" TEXT,
ADD COLUMN     "regulatoryFrameworkLabel" TEXT,
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "termsEffectiveDate" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT DEFAULT '1.0',
ADD COLUMN     "whatsappNumber" TEXT;
