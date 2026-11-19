import { OfficialListsService } from './official-lists.service';

const UN = (names: string[]) => `<CONSOLIDATED_LIST><INDIVIDUALS>${names.map((n, i) => `<INDIVIDUAL><DATAID>${i + 1}</DATAID><FIRST_NAME>${n}</FIRST_NAME><SECOND_NAME>Test</SECOND_NAME><UN_LIST_TYPE>X</UN_LIST_TYPE><REFERENCE_NUMBER>R${i}</REFERENCE_NUMBER></INDIVIDUAL>`).join('')}</INDIVIDUALS></CONSOLIDATED_LIST>`;

function build(existing: any[] = [], sync: any = null) {
  const state = { sync, entries: existing.map((e) => ({ ...e })) };
  const prisma: any = {
    officialListSync: {
      upsert: jest.fn().mockImplementation(async (a: any) => { state.sync = { ...(state.sync ?? { entryCount: 0 }), ...a.create, ...a.update }; return state.sync; }),
      findUnique: jest.fn().mockImplementation(async () => state.sync),
      update: jest.fn().mockImplementation(async (a: any) => { state.sync = { ...state.sync, ...a.data }; return state.sync; }),
    },
    officialListEntry: {
      findMany: jest.fn().mockImplementation(async () => state.entries),
      createMany: jest.fn().mockImplementation(async (a: any) => { a.data.forEach((d: any, i: number) => state.entries.push({ id: `n${state.entries.length + i}`, ...d })); return { count: a.data.length }; }),
      update: jest.fn().mockImplementation(async (a: any) => { const e = state.entries.find((x) => x.id === a.where.id); Object.assign(e, a.data); return e; }),
      updateMany: jest.fn().mockImplementation(async (a: any) => { state.entries.filter((e) => a.where.id.in.includes(e.id)).forEach((e) => Object.assign(e, a.data)); return { count: 1 }; }),
    },
    complianceSettings: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  };
  return { svc: new OfficialListsService(prisma), prisma, state };
}

const serve = (body: string, status = 200) => jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(body, { status }));

afterEach(() => jest.restoreAllMocks());

describe('OfficialListsService.sync', () => {
  it('première synchronisation : crée les fiches et enregistre l’état', async () => {
    serve(UN(['Alpha', 'Bravo']));
    const { svc, state } = build();
    const r = await svc.sync('UN');
    expect(r).toMatchObject({ status: 'OK', entryCount: 2, added: 2, updated: 0, removed: 0 });
    expect(state.entries).toHaveLength(2);
    expect(state.sync).toMatchObject({ status: 'OK', entryCount: 2, error: null });
    expect(state.sync.contentHash).toHaveLength(64);
  });

  it('même fichier qu’à la veille : rien n’est écrit', async () => {
    serve(UN(['Alpha', 'Bravo']));
    const { svc, prisma } = build();
    await svc.sync('UN');
    prisma.officialListEntry.createMany.mockClear();
    const r = await svc.sync('UN');
    expect(r.status).toBe('UNCHANGED');
    expect(prisma.officialListEntry.createMany).not.toHaveBeenCalled();
  });

  it('une fiche retirée est désactivée (jamais supprimée), une nouvelle est ajoutée', async () => {
    const { svc, state } = build();
    serve(UN(['Alpha', 'Bravo']));
    await svc.sync('UN');
    serve(UN(['Alpha', 'Charlie']));
    const r = await svc.sync('UN');
    expect(r).toMatchObject({ status: 'OK', added: 0, updated: 1 }); // « Bravo » (id 2) devient « Charlie » : même identifiant, nom modifié
    expect(state.entries.every((e) => e.isActive)).toBe(true);
    serve(UN(['Alpha']));
    const r2 = await svc.sync('UN', { force: true });
    expect(r2).toMatchObject({ status: 'OK', removed: 1 });
    expect(state.entries.filter((e) => !e.isActive)).toHaveLength(1);
    expect(state.entries).toHaveLength(2);
  });

  it('fichier vide ou illisible : REFUSÉ, la liste en place reste intacte', async () => {
    const { svc, state } = build();
    serve(UN(['Alpha', 'Bravo']));
    await svc.sync('UN');
    serve('<html>Maintenance</html>');
    const r = await svc.sync('UN');
    expect(r.status).toBe('ERROR');
    expect(r.error).toMatch(/Aucune fiche/);
    expect(state.entries.every((e) => e.isActive)).toBe(true);
    expect(state.sync).toMatchObject({ status: 'ERROR' });
    expect(state.sync.entryCount).toBe(2);
  });

  it('erreur réseau / serveur : état ERROR, aucune écriture de fiches, ne lève pas', async () => {
    serve('Service indisponible', 503);
    const { svc, prisma } = build();
    const r = await svc.sync('UN');
    expect(r.status).toBe('ERROR');
    expect(r.error).toMatch(/503/);
    expect(prisma.officialListEntry.createMany).not.toHaveBeenCalled();
  });

  it('UE sans adresse configurée : ignorée proprement', async () => {
    const { svc } = build();
    expect((await svc.sync('EU')).status).toBe('SKIPPED');
  });

  it('refuse une adresse http', async () => {
    process.env.OFFICIAL_LIST_UN_URL = 'http://exemple.test/liste.xml';
    try {
      const { svc } = build();
      const r = await svc.sync('UN');
      expect(r.status).toBe('ERROR');
      expect(r.error).toMatch(/https/);
    } finally { delete process.env.OFFICIAL_LIST_UN_URL; }
  });

  it('syncAllInUse ne télécharge que les listes activées par une société', async () => {
    const f = serve(UN(['Alpha']));
    const { svc, prisma } = build();
    prisma.complianceSettings.findMany.mockImplementation(async (a: any) => (a.where.officialLists.has === 'UN' ? [{ clientId: 5 }] : []));
    const out = await svc.syncAllInUse();
    expect(out.map((r) => r.provider)).toEqual(['UN']);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
