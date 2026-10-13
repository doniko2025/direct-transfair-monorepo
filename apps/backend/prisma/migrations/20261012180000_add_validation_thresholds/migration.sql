-- ✅ v5.4 — validation_thresholds : seuil de validation d'un envoi cash, par société et par devise.
-- Aucune ligne n'est créée ici : sans ligne, le serveur applique 500 000 (comportement inchangé).

-- CreateTable
CREATE TABLE "validation_thresholds" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "validation_thresholds_clientId_currency_key" ON "validation_thresholds"("clientId", "currency");

-- AddForeignKey
ALTER TABLE "validation_thresholds" ADD CONSTRAINT "validation_thresholds_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
