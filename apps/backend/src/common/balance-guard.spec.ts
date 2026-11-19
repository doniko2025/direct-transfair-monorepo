import { ConflictException } from '@nestjs/common';
import { assertNoFunds, fundedByCurrency } from './balance-guard';

describe('balance-guard (audit argent I5)', () => {
  it('ne signale rien quand tout est à zéro', () => {
    expect(() => assertNoFunds([{ currency: 'XOF', balance: 0, reservedBalance: 0 }, { currency: 'EUR', balance: '0.0000' }], "L'agence", '')).not.toThrow();
  });

  it('regroupe par devise et refuse (409 BALANCE_NOT_EMPTY)', () => {
    const ws = [{ currency: 'XOF', balance: 1000, reservedBalance: 0 }, { currency: 'XOF', balance: 500, reservedBalance: 200 }, { currency: 'EUR', balance: 0, reservedBalance: 5 }];
    expect(fundedByCurrency(ws)).toEqual([{ currency: 'EUR', balance: 0, reserved: 5 }, { currency: 'XOF', balance: 1500, reserved: 200 }]);
    try {
      assertNoFunds(ws, "L'agence", 'Pour couper l’accès, suspendez-la.');
      throw new Error('aurait dû refuser');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'BALANCE_NOT_EMPTY', balances: [{ currency: 'EUR' }, { currency: 'XOF', balance: 1500 }] });
      expect(String((e as ConflictException).message)).toContain('suspendez');
    }
  });

  it('un solde négatif est aussi un solde à régler', () => {
    expect(() => assertNoFunds([{ currency: 'GNF', balance: -50 }], 'La société', '')).toThrow(ConflictException);
  });
});
