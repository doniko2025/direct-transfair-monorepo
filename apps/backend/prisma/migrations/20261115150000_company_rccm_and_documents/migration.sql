-- Société : numéro RCCM (repris dans le contrat) + documents légaux fournis à la création.
ALTER TABLE "clients" ADD COLUMN "rccmNumber" TEXT;

CREATE TABLE "client_documents" (
  "id"           TEXT NOT NULL,
  "clientId"     INTEGER NOT NULL,
  "kind"         TEXT NOT NULL,
  "label"        TEXT,
  "mimeType"     TEXT NOT NULL,
  "sizeBytes"    INTEGER NOT NULL,
  "sha256"       TEXT NOT NULL,
  "data"         BYTEA NOT NULL,
  "uploadedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_documents_clientId_kind_idx" ON "client_documents"("clientId", "kind");

ALTER TABLE "client_documents"
  ADD CONSTRAINT "client_documents_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
