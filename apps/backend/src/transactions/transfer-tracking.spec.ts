import { buildTrackingSteps, isFinalStatus } from './transfer-tracking';

const created = new Date('2026-11-19T08:00:00Z');
const validated = new Date('2026-11-19T08:05:00Z');
const paid = new Date('2026-11-19T12:00:00Z');
const states = (s: ReturnType<typeof buildTrackingSteps>) => s.map((x) => x.state);

describe('suivi d’un transfert', () => {
  it('envoi cash en attente de validation : première étape en cours', () => {
    const s = buildTrackingSteps({ kind: 'CASH_TRANSFER', status: 'PENDING', createdAt: created });
    expect(states(s)).toEqual(['current', 'todo', 'todo', 'todo']);
    expect(s[0]!.at).toBe(created.toISOString());
    expect(s[1]!.at).toBeNull();
  });

  it('envoi cash validé : disponible à retirer en cours, les deux premières étapes faites', () => {
    const s = buildTrackingSteps({ kind: 'CASH_TRANSFER', status: 'VALIDATED', createdAt: created, validatedAt: validated });
    expect(states(s)).toEqual(['done', 'done', 'current', 'todo']);
    expect(s[2]!.label).toBe('Disponible à retirer');
    expect(s[1]!.at).toBe(validated.toISOString());
  });

  it('envoi cash payé : tout est fait', () => {
    const s = buildTrackingSteps({ kind: 'CASH_TRANSFER', status: 'PAID', createdAt: created, validatedAt: validated, paidAt: paid });
    expect(states(s)).toEqual(['done', 'done', 'done', 'done']);
    expect(s[3]!.at).toBe(paid.toISOString());
  });

  it('wallet → wallet : deux étapes', () => {
    expect(states(buildTrackingSteps({ kind: 'WALLET_TRANSFER', status: 'PAID', createdAt: created, paidAt: paid }))).toEqual(['done', 'done']);
    expect(buildTrackingSteps({ kind: 'WALLET_TRANSFER', status: 'PAID', createdAt: created, paidAt: paid })).toHaveLength(2);
  });

  it('mobile money en cours : versement en cours', () => {
    const s = buildTrackingSteps({ kind: 'MOBILE_MONEY_TRANSFER', status: 'PROCESSING', createdAt: created, validatedAt: validated });
    expect(states(s)).toEqual(['done', 'done', 'current', 'todo']);
    expect(s[2]!.label).toBe('En cours de versement');
  });

  it('un échec remplace l’étape en cours et fige la suite', () => {
    const s = buildTrackingSteps({ kind: 'CASH_TRANSFER', status: 'EXPIRED', createdAt: created, validatedAt: validated });
    expect(states(s)).toEqual(['done', 'done', 'failed', 'todo']);
    expect(s[2]!.label).toBe('Code expiré');
    const c = buildTrackingSteps({ kind: 'CASH_TRANSFER', status: 'CANCELLED', createdAt: created, cancelledAt: validated });
    expect(states(c)).toEqual(['failed', 'todo', 'todo', 'todo']);
    expect(c[0]!.at).toBe(validated.toISOString());
  });

  it('pas de frise pour un dépôt ou un retrait', () => {
    expect(buildTrackingSteps({ kind: 'DEPOSIT', status: 'PAID', createdAt: created })).toEqual([]);
    expect(buildTrackingSteps({ kind: 'WITHDRAWAL', status: 'PAID', createdAt: created })).toEqual([]);
  });

  it('statuts finals', () => {
    expect(isFinalStatus('PAID')).toBe(true);
    expect(isFinalStatus('REFUNDED')).toBe(true);
    expect(isFinalStatus('VALIDATED')).toBe(false);
    expect(isFinalStatus('ON_HOLD')).toBe(false);
  });
});
