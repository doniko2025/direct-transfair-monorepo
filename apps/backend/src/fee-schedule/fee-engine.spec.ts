
describe('roundToCurrency — demi-valeurs (audit argent M1)', () => {
  const { roundToCurrency } = require('./fee-engine');
  it.each([
    [1.005, 'EUR', 1.01], [2.675, 'EUR', 2.68], [10.075, 'EUR', 10.08], [100.005, 'USD', 100.01], [1234.565, 'GBP', 1234.57],
    [0.5, 'XOF', 1], [1.5, 'XOF', 2], [2.5, 'GNF', 3], [149.5, 'XOF', 150], [1.004, 'EUR', 1],
  ])('%p %s → %p', (v: number, cur: string, expected: number) => {
    expect(roundToCurrency(v, cur)).toBe(expected);
  });
  it('reste stable sur les grands montants et les valeurs négatives', () => {
    expect(roundToCurrency(999_999_999.995, 'EUR')).toBe(1_000_000_000);
    expect(roundToCurrency(-1.005, 'EUR')).toBe(-1.01);
    expect(roundToCurrency(0, 'EUR')).toBe(0);
  });
});
