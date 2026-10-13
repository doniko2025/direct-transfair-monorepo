// apps/backend/src/portal-domains/providers/providers.spec.ts
// Clients Cloudflare / Vercel : authentification, idempotence, erreurs. `fetch` est simulé.
import 'reflect-metadata';

import { CloudflareClient, ProviderError } from './cloudflare.client';
import { VercelClient } from './vercel.client';

const ENV = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_EMAIL', 'CLOUDFLARE_GLOBAL_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'VERCEL_API_TOKEN', 'VERCEL_TEAM_ID', 'PORTAL_VERCEL_PROJECT_ID'] as const;
const saved: Record<string, string | undefined> = {};
const realFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  ENV.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  fetchMock = jest.fn();
  global.fetch = fetchMock as any;
});
afterEach(() => {
  ENV.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  global.fetch = realFetch;
});

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('CloudflareClient', () => {
  it('refuse de partir sans identifiants', async () => {
    await expect(new CloudflareClient().findZone('x.com')).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('jeton d’API : en-tête Bearer ; clé globale en repli', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    fetchMock.mockResolvedValue(reply(200, { success: true, result: [] }));
    await new CloudflareClient().findZone('x.com');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');

    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_EMAIL = 'a@b.c'; process.env.CLOUDFLARE_GLOBAL_KEY = 'gk';
    await new CloudflareClient().findZone('x.com');
    expect(fetchMock.mock.calls[1][1].headers['X-Auth-Key']).toBe('gk');
  });

  it('ensureZone : réutilise la zone existante, sinon la crée dans le compte configuré', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [{ id: 'z1', name: 'x.com', status: 'active', name_servers: [] }] }));
    expect((await new CloudflareClient().ensureZone('x.com')).id).toBe('z1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [] }));
    await expect(new CloudflareClient().ensureZone('y.com')).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);

    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [] }));
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: { id: 'z2', name: 'y.com', status: 'pending', name_servers: ['n1', 'n2'] } }));
    const z = await new CloudflareClient().ensureZone('y.com');
    expect(z.name_servers).toEqual(['n1', 'n2']);
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toMatchObject({ name: 'y.com', account: { id: 'acc' }, type: 'full' });
  });

  it('upsertRecord : crée, met à jour si la valeur change, ne fait rien si identique ; jamais proxifié', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    const cf = new CloudflareClient();
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [] })).mockResolvedValueOnce(reply(200, { success: true, result: {} }));
    await cf.upsertRecord('z', 'A', 'x.com', '1.1.1.1');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).proxied).toBe(false);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [{ id: 'r1', content: '1.1.1.1' }] }));
    await cf.upsertRecord('z', 'A', 'x.com', '1.1.1.1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, result: [{ id: 'r1', content: '9.9.9.9' }] })).mockResolvedValueOnce(reply(200, { success: true, result: {} }));
    await cf.upsertRecord('z', 'A', 'x.com', '1.1.1.1');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
  });

  it('erreur API : message utile, sans jamais citer le jeton', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'super-secret-token';
    fetchMock.mockResolvedValue(reply(403, { success: false, errors: [{ code: 9109, message: 'Invalid access token' }] }));
    const err = await new CloudflareClient().findZone('x.com').catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toContain('Invalid access token');
    expect(err.message).not.toContain('super-secret-token');
  });

  it('réseau coupé : ProviderError lisible', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(new CloudflareClient().findZone('x.com')).rejects.toThrow(/injoignable/);
  });
});

describe('VercelClient', () => {
  beforeEach(() => { process.env.VERCEL_API_TOKEN = 'vt'; process.env.PORTAL_VERCEL_PROJECT_ID = 'prj_portal'; });

  it('utilise le projet des portails et l’équipe configurée', async () => {
    process.env.VERCEL_TEAM_ID = 'team_1';
    fetchMock.mockResolvedValue(reply(200, { name: 'x.com', verified: true }));
    await new VercelClient().addDomain('x.com');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.vercel.com/v10/projects/prj_portal/domains?teamId=team_1');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer vt');
  });

  it('addDomain : déjà présent sur ce projet ⇒ relit le domaine ; pris ailleurs ⇒ erreur explicite', async () => {
    fetchMock.mockResolvedValueOnce(reply(409, { error: { message: 'exists' } })).mockResolvedValueOnce(reply(200, { name: 'x.com', verified: true }));
    expect((await new VercelClient().addDomain('x.com')).verified).toBe(true);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(reply(409, { error: { message: 'in use' } })).mockResolvedValueOnce(reply(404, { error: { message: 'nf' } }));
    await expect(new VercelClient().addDomain('x.com')).rejects.toThrow(/autre projet/);
  });

  it('isMisconfigured : lit la configuration ; indisponible ⇒ ne bloque pas', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { misconfigured: true }));
    expect(await new VercelClient().isMisconfigured('x.com')).toBe(true);
    fetchMock.mockResolvedValueOnce(reply(500, {}));
    expect(await new VercelClient().isMisconfigured('x.com')).toBe(false);
  });

  it('removeDomain : 404 ignoré, autres erreurs propagées', async () => {
    fetchMock.mockResolvedValueOnce(reply(404, {}));
    await expect(new VercelClient().removeDomain('x.com')).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(reply(500, { error: { message: 'down' } }));
    await expect(new VercelClient().removeDomain('x.com')).rejects.toThrow(/down/);
  });

  it('sans configuration : erreur claire, aucun appel réseau', async () => {
    delete process.env.PORTAL_VERCEL_PROJECT_ID;
    await expect(new VercelClient().getDomain('x.com')).rejects.toThrow(/PORTAL_VERCEL_PROJECT_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
