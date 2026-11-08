import { parseNotificationSpace, spaceOfAction } from './notification-space';

describe('comptes séparés — notifications', () => {
  it('reconnaît les écrans du compte marchand', () => {
    expect(spaceOfAction('/merchant')).toBe('merchant');
    expect(spaceOfAction('/merchant/payment?id=abc')).toBe('merchant');
    expect(spaceOfAction('/merchant/payouts')).toBe('merchant');
  });

  it('range tout le reste côté client (y compris l’administration des marchands)', () => {
    expect(spaceOfAction('/wallet')).toBe('client');
    expect(spaceOfAction('/pay/requests')).toBe('client');
    expect(spaceOfAction('/merchants/payouts')).toBe('client');
    expect(spaceOfAction(null)).toBe('client');
    expect(spaceOfAction(undefined)).toBe('client');
  });

  it('ignore une valeur inconnue', () => {
    expect(parseNotificationSpace('client')).toBe('client');
    expect(parseNotificationSpace('merchant')).toBe('merchant');
    expect(parseNotificationSpace('autre')).toBeUndefined();
  });
});
