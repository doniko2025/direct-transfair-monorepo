-- Pièce justificative du RCCM d'un commerce (photo ou PDF), consultable par l'administrateur de la société.
CREATE TABLE IF NOT EXISTS "merchant_rccm_documents" (
    "merchantId" TEXT NOT NULL,
    "mimeType"   TEXT NOT NULL,
    "sizeBytes"  INTEGER NOT NULL,
    "sha256"     TEXT NOT NULL,
    "data"       BYTEA NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_rccm_documents_pkey" PRIMARY KEY ("merchantId")
);

DO $$ BEGIN
  ALTER TABLE "merchant_rccm_documents"
    ADD CONSTRAINT "merchant_rccm_documents_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
