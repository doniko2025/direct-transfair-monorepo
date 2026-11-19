import { findMatches, jaroWinkler, nameSimilarity, normalizeName } from './name-matching';

describe('normalizeName', () => {
  it('retire accents, casse, ponctuation et tirets', () => {
    expect(normalizeName("  Mamadou-Saïdou  N'DIAYE ")).toBe('mamadou saidou n diaye');
  });
});

describe('jaroWinkler', () => {
  it('vaut 1 pour deux textes identiques et 0 sans rien en commun', () => {
    expect(jaroWinkler('diallo', 'diallo')).toBe(1);
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });
});

describe('nameSimilarity', () => {
  it("ignore l'ordre des mots et les accents", () => {
    expect(nameSimilarity('Diallo Mamadou', 'mamadou DIALLO')).toBe(100);
    expect(nameSimilarity('Aïssatou Barry', 'Aissatou Barry')).toBe(100);
  });
  it('tolère une faute de frappe ou une translittération proche', () => {
    expect(nameSimilarity('Mohamed Camara', 'Mohammed Camara')).toBeGreaterThanOrEqual(93);
  });
  it('tolère un deuxième prénom mais pas un autre nom de famille', () => {
    expect(nameSimilarity('Mamadou Saliou Diallo', 'Mamadou Diallo')).toBeGreaterThanOrEqual(88);
    expect(nameSimilarity('Mamadou Diallo', 'Mamadou Bah')).toBeLessThan(80);
  });
  it('un nom seul ne correspond pas à un nom complet (nom de famille très répandu)', () => {
    expect(nameSimilarity('Diallo', 'Mamadou Diallo')).toBe(0);
    expect(nameSimilarity('Diallo', 'Diallo')).toBe(100);
  });
  it('vaut 0 pour un nom vide', () => {
    expect(nameSimilarity('', 'Mamadou Diallo')).toBe(0);
  });
});

describe('findMatches', () => {
  const entries = [
    { id: 'w1', kind: 'SANCTION', fullName: 'Ibrahima Sory Conde', aliases: ['Sory Conde'], reference: 'LST-1' },
    { id: 'w2', kind: 'PEP', fullName: 'Fatoumata Bah', aliases: [] },
  ];
  it('trouve par le nom ou par un alias et classe par score', () => {
    const r = findMatches(
      [{ role: 'SENDER', name: 'Sory Condé' }, { role: 'BENEFICIARY', name: 'Fatoumata Bah' }],
      entries, 88,
    );
    expect(r.map((m) => m.entryId).sort()).toEqual(['w1', 'w2']);
    const byId = new Map(r.map((m) => [m.entryId, m]));
    expect(byId.get('w1')?.matchedOn).toBe('Sory Conde');
    expect(byId.get('w1')?.reference).toBe('LST-1');
    expect(r[0]?.score).toBeGreaterThanOrEqual(r[1]?.score ?? 0);
  });
  it('ne signale rien sous le seuil', () => {
    expect(findMatches([{ role: 'SENDER', name: 'Aminata Sow' }], entries, 88)).toEqual([]);
  });
});

describe('NameIndex', () => {
  const entries = [
    { id: 'a', kind: 'SANCTION', fullName: 'Mohammed Camara', aliases: ['Moh Camara'], source: 'UN' },
    { id: 'b', kind: 'SANCTION', fullName: 'Ibrahima Sory Conde', aliases: [], source: 'OFAC' },
    { id: 'c', kind: 'SANCTION', fullName: 'Aliou Bah', aliases: [], source: 'EU' },
    { id: 'd', kind: 'SANCTION', fullName: 'Kaba', aliases: [], source: 'UN' },
  ];
  const { NameIndex } = jest.requireActual('./name-matching') as typeof import('./name-matching');

  it('donne les mêmes résultats que la comparaison complète', () => {
    const idx = new NameIndex(entries);
    for (const name of ['Mohamed Camara', 'Sory Condé', 'Camara Mohammed', 'Aliou Ba', 'Kaba', 'Quelqu un Dautre']) {
      const subj = [{ role: 'SENDER', name }];
      const full = findMatches(subj, entries, 85).map((m) => `${m.entryId}:${m.score}`).sort();
      const fast = idx.query(subj, 85).map((m) => `${m.entryId}:${m.score}`).sort();
      expect(fast).toEqual(full);
    }
  });
  it('porte la source de la fiche', () => {
    const idx = new NameIndex(entries);
    expect(idx.query([{ role: 'SENDER', name: 'Mohamed Camara' }], 88)[0]?.source).toBe('UN');
  });
  it('reste rapide sur 20 000 fiches', () => {
    const syn = Array.from({ length: 20_000 }, (_, i) => ({ id: `s${i}`, kind: 'SANCTION', fullName: `Prenom${i % 977} Nom${(i * 7) % 1999}`, aliases: [`Alias${i % 311} Nom${i % 503}`] }));
    syn.push({ id: 'target', kind: 'SANCTION', fullName: 'Ousmane Baldé Sylla', aliases: [] });
    const idx = new NameIndex(syn);
    const t0 = Date.now();
    const r = idx.query([{ role: 'SENDER', name: 'Ousmane Balde Sylla' }, { role: 'BENEFICIARY', name: 'Fatou Diop' }], 90);
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(r.some((m) => m.entryId === 'target' && m.score >= 96)).toBe(true);
  });
});
