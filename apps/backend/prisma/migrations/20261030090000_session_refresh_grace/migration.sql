-- apps/backend/prisma/migrations/20261030090000_session_refresh_grace/migration.sql
-- Rotation tolérante du refresh token : le token précédent reste acceptable quelques instants (réponse réseau perdue).
ALTER TABLE "user_sessions" ADD COLUMN "previousRefreshToken" TEXT;
ALTER TABLE "user_sessions" ADD COLUMN "refreshRotatedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "user_sessions_previousRefreshToken_key" ON "user_sessions"("previousRefreshToken");
