/*
  Warnings:

  - The primary key for the `Client` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `dbUrl` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `jwtSecret` on the `Client` table. All the data in the column will be lost.
  - The `id` column on the `Client` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Client" DROP CONSTRAINT "Client_pkey",
DROP COLUMN "dbUrl",
DROP COLUMN "jwtSecret",
ADD COLUMN     "dbHost" TEXT,
ADD COLUMN     "dbPort" INTEGER,
ADD COLUMN     "dbSchema" TEXT,
ADD COLUMN     "dbUser" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Client_pkey" PRIMARY KEY ("id");
