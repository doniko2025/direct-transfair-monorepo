-- Lot 7 — vérification d'identité (KYC) des clients wallet et identité des expéditeurs de passage (envois au comptoir).
--
--  1. users                : suivi des rappels de vérification (compteur + date du dernier rappel) et date de validation.
--  2. kyc_files            : contenu des pièces (recto, verso, selfie), lié à kyc_documents (supprimé avec lui).
--  3. counter_customers    : expéditeur de passage d'un envoi au comptoir (pièce d'identité contrôlée par l'agent).
--  4. transactions         : lien vers l'expéditeur de passage.
-- Aucune donnée existante n'est modifiée ou supprimée.

-- 1. users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kycReminderCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kycLastReminderAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kycVerifiedAt"     TIMESTAMP(3);

-- 2. kyc_documents (index de la file de validation) et kyc_files
CREATE INDEX IF NOT EXISTS "kyc_documents_status_createdAt_idx" ON "kyc_documents"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "kyc_files" (
  "id"         TEXT         NOT NULL,
  "documentId" TEXT         NOT NULL,
  "kind"       TEXT         NOT NULL,
  "mimeType"   TEXT         NOT NULL,
  "sizeBytes"  INTEGER      NOT NULL,
  "sha256"     TEXT         NOT NULL,
  "data"       BYTEA        NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kyc_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kyc_files_documentId_kind_key" ON "kyc_files"("documentId", "kind");
ALTER TABLE "kyc_files" DROP CONSTRAINT IF EXISTS "kyc_files_documentId_fkey";
ALTER TABLE "kyc_files" ADD CONSTRAINT "kyc_files_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "kyc_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. counter_customers
CREATE TABLE IF NOT EXISTS "counter_customers" (
  "id"          TEXT            NOT NULL,
  "clientId"    INTEGER         NOT NULL,
  "phone"       TEXT            NOT NULL,
  "firstName"   TEXT            NOT NULL,
  "lastName"    TEXT            NOT NULL,
  "birthDate"   TIMESTAMP(3)    NOT NULL,
  "idType"      "KycDocumentType" NOT NULL,
  "idNumber"    TEXT            NOT NULL,
  "idCountry"   TEXT,
  "idExpiry"    TIMESTAMP(3)    NOT NULL,
  "createdById" TEXT            NOT NULL,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)    NOT NULL,
  CONSTRAINT "counter_customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "counter_customers_clientId_idNumber_key" ON "counter_customers"("clientId", "idNumber");
CREATE INDEX IF NOT EXISTS "counter_customers_clientId_phone_idx" ON "counter_customers"("clientId", "phone");
ALTER TABLE "counter_customers" DROP CONSTRAINT IF EXISTS "counter_customers_clientId_fkey";
ALTER TABLE "counter_customers" ADD CONSTRAINT "counter_customers_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "counterCustomerId" TEXT;
CREATE INDEX IF NOT EXISTS "transactions_counterCustomerId_createdAt_idx" ON "transactions"("counterCustomerId", "createdAt");
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_counterCustomerId_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counterCustomerId_fkey"
  FOREIGN KEY ("counterCustomerId") REFERENCES "counter_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
