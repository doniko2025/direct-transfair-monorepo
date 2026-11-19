// apps/backend/src/common/production-readiness.ts
// =========================================================
// CONTRÔLE DE MISE EN PRODUCTION (audit argent) — fonction pure, lue au démarrage.
// Plusieurs interrupteurs de développement créent ou laissent passer de l'argent sans paiement réel. Ils sont OUVERTS par défaut
// pour ne pas casser la phase de test ; ce contrôle les rend impossibles à oublier :
//   • NODE_ENV=production : chaque point à risque est écrit dans les journaux, bien visible, au démarrage ;
//   • STRICT_PRODUCTION=true : l'API REFUSE de démarrer tant qu'un point « critique » reste ouvert.
// Aucun comportement métier ne change ici : seuls les journaux (et, sur demande, le refus de démarrer) sont concernés.
// =========================================================

export type ReadinessLevel = 'critical' | 'warning';

export interface ReadinessIssue {
  level: ReadinessLevel;
  variable: string;
  message: string;
  fix: string;
}

const isOn = (v: string | undefined): boolean => String(v ?? '').trim().toLowerCase() === 'true';
const isOff = (v: string | undefined): boolean => String(v ?? '').trim().toLowerCase() === 'false';

export function checkProductionReadiness(env: NodeJS.ProcessEnv = process.env): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (!isOff(env.ALLOW_SELF_FUNDING)) {
    issues.push({
      level: 'critical', variable: 'ALLOW_SELF_FUNDING',
      message: "Un administrateur de société peut s'ajouter de l'argent sans paiement (fund-self, inject, inject-all), puis l'envoyer.",
      fix: 'ALLOW_SELF_FUNDING=false',
    });
  }
  if (!isOn(env.BLOCK_SIMULATED_RECHARGES)) {
    issues.push({
      level: 'critical', variable: 'BLOCK_SIMULATED_RECHARGES',
      message: "Les recharges carte / Orange Money / Sendwave sont simulées : tout client peut créditer son portefeuille sans payer.",
      fix: 'BLOCK_SIMULATED_RECHARGES=true (tant qu’aucun vrai prestataire de paiement n’est branché)',
    });
  }
  if (isOn(env.ALLOW_SIMULATED_PAYMENTS)) {
    issues.push({
      level: 'critical', variable: 'ALLOW_SIMULATED_PAYMENTS',
      message: "POST /payments/initiate est rouvert : l'expéditeur peut marquer lui-même son envoi « payé ».",
      fix: 'Supprimer ALLOW_SIMULATED_PAYMENTS',
    });
  }
  if (String(env.KYC_ENFORCEMENT ?? 'on').trim().toLowerCase() === 'off') {
    issues.push({
      level: 'critical', variable: 'KYC_ENFORCEMENT',
      message: "Le blocage des envois sans identité vérifiée est coupé.",
      fix: 'Supprimer KYC_ENFORCEMENT (ou la mettre à on)',
    });
  }
  if (isOn(env.WEBHOOK_ALLOW_HTTP) || isOn(env.OFFICIAL_LISTS_ALLOW_HTTP)) {
    issues.push({
      level: 'warning', variable: 'WEBHOOK_ALLOW_HTTP / OFFICIAL_LISTS_ALLOW_HTTP',
      message: 'Des adresses http:// (non chiffrées) sont autorisées pour les webhooks ou les listes officielles.',
      fix: 'Remettre ces variables à false',
    });
  }
  if (String(env.CORS_ALLOW_LOCALHOST ?? 'true').trim().toLowerCase() !== 'false') {
    issues.push({
      level: 'warning', variable: 'CORS_ALLOW_LOCALHOST',
      message: 'Les pages servies depuis localhost sont autorisées à appeler l’API.',
      fix: 'CORS_ALLOW_LOCALHOST=false',
    });
  }
  if (isOn(env.SWAGGER_ENABLED)) {
    issues.push({
      level: 'warning', variable: 'SWAGGER_ENABLED',
      message: 'La documentation interactive de l’API est publique.',
      fix: 'Supprimer SWAGGER_ENABLED',
    });
  }
  const db = String(env.DATABASE_URL ?? '');
  if (db && !/sslmode=(require|verify-ca|verify-full)|ssl=true/i.test(db) && !/@(localhost|127\.0\.0\.1|postgres|db)(:|\/)/i.test(db)) {
    issues.push({
      level: 'warning', variable: 'DATABASE_URL',
      message: 'La connexion à la base ne demande pas SSL (sslmode=require).',
      fix: 'Ajouter ?sslmode=require à DATABASE_URL (si le fournisseur le permet)',
    });
  }
  return issues;
}

/**
 * Écrit le contrôle dans les journaux. Retourne les points critiques ; lève une erreur si STRICT_PRODUCTION=true et qu'il en reste.
 * Hors production, ne fait rien (le développement garde ses raccourcis).
 */
export function enforceProductionReadiness(
  env: NodeJS.ProcessEnv = process.env,
  log: { warn: (m: string) => void; error: (m: string) => void; log: (m: string) => void } = console as never,
): ReadinessIssue[] {
  if (String(env.NODE_ENV ?? '').trim().toLowerCase() !== 'production') return [];
  const issues = checkProductionReadiness(env);
  const critical = issues.filter((i) => i.level === 'critical');
  if (issues.length === 0) {
    log.log('✅ [PRODUCTION] Contrôle de mise en production : aucun point à risque.');
    return critical;
  }
  for (const i of issues) {
    const line = `${i.level === 'critical' ? '🚨' : '⚠️ '} [PRODUCTION] ${i.variable} — ${i.message} → ${i.fix}`;
    if (i.level === 'critical') log.error(line); else log.warn(line);
  }
  if (isOn(env.STRICT_PRODUCTION) && critical.length > 0) {
    throw new Error(
      `STRICT_PRODUCTION=true : démarrage refusé, ${critical.length} point(s) critique(s) ouvert(s) : ${critical.map((i) => i.variable).join(', ')}.`,
    );
  }
  if (critical.length > 0) {
    log.error(`🚨 [PRODUCTION] ${critical.length} point(s) critique(s) ouvert(s). Pour refuser le démarrage tant qu'ils le sont : STRICT_PRODUCTION=true.`);
  }
  return critical;
}
