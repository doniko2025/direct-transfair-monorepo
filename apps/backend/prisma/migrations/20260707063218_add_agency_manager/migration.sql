/*
  Warnings:

  - A unique constraint covering the columns `[managerId]` on the table `agencies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "primaryColor" SET DEFAULT '#059669',
ALTER COLUMN "secondaryColor" SET DEFAULT '#10B981';

-- CreateIndex
CREATE UNIQUE INDEX "agencies_managerId_key" ON "agencies"("managerId");

-- CreateIndex
CREATE INDEX "clients_subdomain_idx" ON "clients"("subdomain");

-- CreateIndex
CREATE INDEX "clients_customDomain_idx" ON "clients"("customDomain");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
