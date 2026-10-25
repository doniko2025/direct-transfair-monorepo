-- apps/backend/prisma/migrations/20261025010000_add_must_change_password/migration.sql
-- Changement de mot de passe obligatoire à la première connexion (mot de passe temporaire envoyé par un tiers).
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
