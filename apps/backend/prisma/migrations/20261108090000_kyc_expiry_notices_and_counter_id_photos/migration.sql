-- Lot 8 — rappels d'expiration des pièces, photo de la pièce des clients de passage, journalisation des consultations.
--
--  1. kyc_documents        : dernier seuil d'alerte d'expiration envoyé (30 puis 7 jours avant la date).
--  2. counter_customers    : date de la dernière photo de pièce prise par un agent.
--  3. counter_id_files     : contenu des photos (recto, verso), supprimé avec la fiche.
--  4. AuditAction          : KYC_VIEW (consultation), KYC_REMIND (relance manuelle), KYC_COUNTER_ID (photo de pièce au comptoir).
-- Aucune donnée existante n'est modifiée ou supprimée.

-- 1. kyc_documents
ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "expiryNoticeDays" INTEGER;

-- 2. counter_customers
ALTER TABLE "counter_customers" ADD COLUMN IF NOT EXISTS "idPhotoAt" TIMESTAMP(3);

-- 3. counter_id_files
CREATE TABLE IF NOT EXISTS "counter_id_files" (
  "id"                TEXT         NOT NULL,
  "counterCustomerId" TEXT         NOT NULL,
  "kind"              TEXT         NOT NULL,
  "mimeType"          TEXT         NOT NULL,
  "sizeBytes"         INTEGER      NOT NULL,
  "sha256"            TEXT         NOT NULL,
  "data"              BYTEA        NOT NULL,
  "capturedById"      TEXT         NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counter_id_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "counter_id_files_counterCustomerId_kind_key" ON "counter_id_files"("counterCustomerId", "kind");
ALTER TABLE "counter_id_files" DROP CONSTRAINT IF EXISTS "counter_id_files_counterCustomerId_fkey";
ALTER TABLE "counter_id_files" ADD CONSTRAINT "counter_id_files_counterCustomerId_fkey"
  FOREIGN KEY ("counterCustomerId") REFERENCES "counter_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. valeurs d'enum (ADD VALUE ne peut pas être utilisé dans la même transaction que la valeur ajoutée : rien ne l'utilise ici)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KYC_VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KYC_REMIND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KYC_COUNTER_ID';
