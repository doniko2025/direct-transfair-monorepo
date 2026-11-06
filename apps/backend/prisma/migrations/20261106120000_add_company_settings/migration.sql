-- ✅ v5.7 — company_settings : paramètres métier d'une société (modes gratuits, taux de repli, répartition par défaut,
-- validité et protection des codes de retrait, seuils d'alerte de caisse).
-- Aucune ligne n'est créée ici : sans ligne, le serveur applique ses valeurs par défaut.

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_clientId_key" ON "company_settings"("clientId");

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
