-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'INACTIVE';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activitySector" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "ownerAddress" TEXT,
ADD COLUMN     "ownerBirthDate" TEXT,
ADD COLUMN     "ownerBirthPlace" TEXT,
ADD COLUMN     "ownerCountry" TEXT,
ADD COLUMN     "ownerFirstName" TEXT,
ADD COLUMN     "ownerLastName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthCity" TEXT,
ADD COLUMN     "birthCountry" TEXT,
ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
