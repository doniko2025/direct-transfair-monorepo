/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "code" TEXT,
ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agency_code_key" ON "Agency"("code");
