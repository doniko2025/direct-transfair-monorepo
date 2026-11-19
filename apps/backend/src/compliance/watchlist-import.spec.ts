import { MAX_IMPORT_LINES, parseWatchlistLines } from './watchlist-import';

describe('parseWatchlistLines', () => {
  it('lit nom, alias, pays, année et référence', () => {
    const r = parseWatchlistLines('Ibrahima Sory Conde ; Sory Conde | I. S. Conde ; GN ; 1970 ; LST-12');
    expect(r.errors).toEqual([]);
    expect(r.entries).toEqual([{ fullName: 'Ibrahima Sory Conde', aliases: ['Sory Conde', 'I. S. Conde'], country: 'GN', birthYear: 1970, reference: 'LST-12' }]);
  });
  it('accepte la tabulation, ignore vides et commentaires', () => {
    const r = parseWatchlistLines('# liste\n\nFatoumata Bah\t\tSN');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]?.country).toBe('SN');
  });
  it('signale nom trop court, année invalide et doublon avec leur numéro de ligne', () => {
    const r = parseWatchlistLines('Al\nAminata Sow ;; ML ; 1800\nBoubacar Sylla\nboubacar sylla');
    expect(r.entries.map((e) => e.fullName)).toEqual(['Boubacar Sylla']);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 4]);
  });
  it('limite le nombre de lignes', () => {
    const text = Array.from({ length: MAX_IMPORT_LINES + 5 }, (_, i) => `Personne Numero${i}`).join('\n');
    const r = parseWatchlistLines(text);
    expect(r.entries).toHaveLength(MAX_IMPORT_LINES);
    expect(r.errors).toHaveLength(1);
  });
});
