-- Photo de profil du client : une ligne par utilisateur, octets stockés en base (comme les pièces KYC), jamais dans la fiche utilisateur.

CREATE TABLE IF NOT EXISTS "user_photos" (
  "userId"    TEXT         NOT NULL,
  "mimeType"  TEXT         NOT NULL,
  "sizeBytes" INTEGER      NOT NULL,
  "sha256"    TEXT         NOT NULL,
  "data"      BYTEA        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_photos_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
