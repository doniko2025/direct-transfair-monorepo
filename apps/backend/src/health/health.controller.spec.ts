// apps/backend/src/health/health.controller.spec.ts
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

const make = (queryRaw: jest.Mock) => new HealthController({ $queryRaw: queryRaw } as any);

describe('HealthController', () => {
  it('répond ok quand la base répond', async () => {
    const q = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const res = await make(q).check();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('up');
    expect(typeof res.uptimeSeconds).toBe('number');
    expect(q).toHaveBeenCalledTimes(1);
  });

  it('renvoie 503 quand la base est injoignable', async () => {
    const q = jest.fn().mockRejectedValue(new Error('connection refused'));
    await expect(make(q).check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ne renvoie aucune donnée métier', async () => {
    const q = jest.fn().mockResolvedValue([]);
    const res = await make(q).check();
    expect(Object.keys(res).sort()).toEqual(['db', 'status', 'time', 'uptimeSeconds']);
  });
});
