import { checkProductionReadiness, enforceProductionReadiness } from './production-readiness';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const SAFE = { ALLOW_SELF_FUNDING: 'false', BLOCK_SIMULATED_RECHARGES: 'true', CORS_ALLOW_LOCALHOST: 'false', DATABASE_URL: 'postgresql://u:p@db.example.com/x?sslmode=require' };
const sink = () => ({ lines: [] as string[], warn(m: string) { this.lines.push(m); }, error(m: string) { this.lines.push(m); }, log(m: string) { this.lines.push(m); } });

describe('checkProductionReadiness', () => {
  it('configuration saine : aucun point', () => {
    expect(checkProductionReadiness(env(SAFE))).toEqual([]);
  });
  it('valeurs par défaut (phase de test) : les deux interrupteurs d’argent sont critiques', () => {
    const crit = checkProductionReadiness(env({})).filter((i) => i.level === 'critical').map((i) => i.variable);
    expect(crit).toEqual(['ALLOW_SELF_FUNDING', 'BLOCK_SIMULATED_RECHARGES']);
  });
  it('paiements simulés rouverts et KYC coupé : critiques', () => {
    const crit = checkProductionReadiness(env({ ...SAFE, ALLOW_SIMULATED_PAYMENTS: 'true', KYC_ENFORCEMENT: 'off' })).map((i) => i.variable);
    expect(crit).toEqual(['ALLOW_SIMULATED_PAYMENTS', 'KYC_ENFORCEMENT']);
  });
  it('http autorisé, localhost, swagger, base sans SSL : avertissements', () => {
    const w = checkProductionReadiness(env({ ...SAFE, WEBHOOK_ALLOW_HTTP: 'true', CORS_ALLOW_LOCALHOST: 'true', SWAGGER_ENABLED: 'true', DATABASE_URL: 'postgresql://u:p@db.example.com/x' }));
    expect(w.every((i) => i.level === 'warning')).toBe(true);
    expect(w.map((i) => i.variable)).toEqual(['WEBHOOK_ALLOW_HTTP / OFFICIAL_LISTS_ALLOW_HTTP', 'CORS_ALLOW_LOCALHOST', 'SWAGGER_ENABLED', 'DATABASE_URL']);
  });
  it('base locale (docker) : pas d’avertissement SSL', () => {
    expect(checkProductionReadiness(env({ ...SAFE, DATABASE_URL: 'postgresql://u:p@localhost:5432/x' }))).toEqual([]);
  });
});

describe('enforceProductionReadiness', () => {
  it('hors production : silencieux, ne refuse jamais', () => {
    const log = sink();
    expect(enforceProductionReadiness(env({ NODE_ENV: 'development', STRICT_PRODUCTION: 'true' }), log)).toEqual([]);
    expect(log.lines).toEqual([]);
  });
  it('production sans STRICT : journalise et démarre', () => {
    const log = sink();
    const crit = enforceProductionReadiness(env({ NODE_ENV: 'production' }), log);
    expect(crit).toHaveLength(2);
    expect(log.lines.join('\n')).toContain('ALLOW_SELF_FUNDING');
  });
  it('production + STRICT_PRODUCTION=true avec un point critique : refuse de démarrer', () => {
    expect(() => enforceProductionReadiness(env({ NODE_ENV: 'production', STRICT_PRODUCTION: 'true' }), sink())).toThrow(/démarrage refusé.*ALLOW_SELF_FUNDING/);
  });
  it('production + STRICT_PRODUCTION=true, tout est fermé : démarre', () => {
    const log = sink();
    expect(enforceProductionReadiness(env({ ...SAFE, NODE_ENV: 'production', STRICT_PRODUCTION: 'true' }), log)).toEqual([]);
    expect(log.lines[0]).toContain('aucun point à risque');
  });
});
