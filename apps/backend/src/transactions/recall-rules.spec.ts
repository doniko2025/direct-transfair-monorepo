// Rappel d'un envoi wallet → wallet : conditions d'éligibilité, délai, montant rendu.
import { assessRecall } from './recall-rules';

const NOW = new Date('2026-11-09T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const paid = (over: Record<string, unknown> = {}) => ({
  type: 'TRANSFER', status: 'PAID', payoutMethod: 'WALLET', recipientId: 'u2', paidAt: daysAgo(3), createdAt: daysAgo(3),
  amount: 10_000, fees: 150, total: 10_150, ...over,
});
const opts = (over: Record<string, unknown> = {}) => ({ windowDays: 30, returnFees: true, now: NOW, ...over });

describe('assessRecall', () => {
  it('envoi wallet payé dans le délai : rappelable, total rendu si les frais sont rendus', () => {
    expect(assessRecall(paid(), opts())).toEqual({ ok: true, refundAmount: 10_150, refundsFees: true });
  });

  it('frais conservés : seul le montant est rendu', () => {
    expect(assessRecall(paid(), opts({ returnFees: false }))).toEqual({ ok: true, refundAmount: 10_000, refundsFees: false });
  });

  it('Mobile Money et envoi programmé sont rappelables aussi', () => {
    expect(assessRecall(paid({ payoutMethod: 'MOBILE_MONEY', type: 'SCHEDULED' }), opts()).ok).toBe(true);
  });

  it('envoi cash retiré en agence, ou sans destinataire wallet : hors plateforme', () => {
    expect(assessRecall(paid({ payoutMethod: 'CASH_PICKUP', recipientId: null }), opts())).toMatchObject({ ok: false, reason: expect.stringMatching(/hors plateforme/) });
    expect(assessRecall(paid({ recipientId: null }), opts()).ok).toBe(false);
  });

  it('autre type (dépôt, B2B, marchand…) ou statut non payé : refusé', () => {
    expect(assessRecall(paid({ type: 'MERCHANT_PAYMENT' }), opts()).ok).toBe(false);
    expect(assessRecall(paid({ type: 'DEPOSIT' }), opts()).ok).toBe(false);
    expect(assessRecall(paid({ status: 'VALIDATED' }), opts())).toMatchObject({ ok: false, reason: expect.stringMatching(/VALIDATED/) });
    expect(assessRecall(paid({ status: 'REFUNDED' }), opts()).ok).toBe(false);
  });

  it('délai : 0 = rappel fermé ; passé le délai = refusé ; la limite exacte passe encore', () => {
    expect(assessRecall(paid(), opts({ windowDays: 0 }))).toMatchObject({ ok: false, reason: expect.stringMatching(/fermé/) });
    expect(assessRecall(paid({ paidAt: daysAgo(31) }), opts())).toMatchObject({ ok: false, reason: expect.stringMatching(/30 jours/) });
    expect(assessRecall(paid({ paidAt: daysAgo(30) }), opts()).ok).toBe(true);
  });

  it('sans date de paiement, la date de création sert de repère', () => {
    expect(assessRecall(paid({ paidAt: null, createdAt: daysAgo(40) }), opts()).ok).toBe(false);
  });
});
