import { merchantSideWhere, parseSpace, spaceWhere } from './transactions.space';

describe('comptes séparés — filtre de l’historique', () => {
  it('ne filtre pas sans compte précisé ou avec une valeur inconnue', () => {
    expect(parseSpace(undefined)).toBeUndefined();
    expect(parseSpace('tout')).toBeUndefined();
    expect(spaceWhere(undefined, 'u1')).toBeNull();
  });

  it('compte marchand : paiements encaissés et retraits du commerce, rien d’autre', () => {
    expect(spaceWhere(parseSpace('merchant'), 'u1')).toEqual({
      OR: [
        { type: 'MERCHANT_PAYMENT', recipientId: 'u1' },
        { type: 'MERCHANT_PAYOUT', senderId: 'u1' },
        { type: 'MERCHANT_REFUND', senderId: 'u1' },
      ],
    });
  });

  it('un remboursement est du côté marchand pour celui qui rembourse, du côté client pour celui qui le reçoit', () => {
    const w = merchantSideWhere('merchant') as { OR: object[] };
    expect(w.OR).toContainEqual({ type: 'MERCHANT_REFUND', senderId: 'merchant' });
    expect(w.OR).not.toContainEqual({ type: 'MERCHANT_REFUND', recipientId: 'client' });
  });

  it('compte client : exactement le complément du compte marchand', () => {
    expect(spaceWhere(parseSpace('client'), 'u1')).toEqual({ NOT: merchantSideWhere('u1') });
  });
});
