-- ✅ v5.5 — transfer_limits : plafonds d'envoi par société, niveau KYC et devise.
-- Aucune ligne n'est créée ici : sans ligne, le serveur applique ses plafonds par défaut.

-- CreateTable
CREATE TABLE "transfer_limits" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "kycLevel" "KycLevel" NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "perTransaction" DECIMAL(18,4),
    "daily" DECIMAL(18,4),
    "monthly" DECIMAL(18,4),
    "yearly" DECIMAL(18,4),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_limits_clientId_kycLevel_currency_key" ON "transfer_limits"("clientId", "kycLevel", "currency");

-- AddForeignKey
ALTER TABLE "transfer_limits" ADD CONSTRAINT "transfer_limits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
