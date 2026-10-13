// apps/backend/src/agent-desk/agent-desk.threshold.spec.ts
// L'aperçu d'un envoi cash utilise le seuil réglé par l'admin de la société (et non plus 500 000 codé en dur).
import { AgentDeskService } from './agent-desk.service';

function build(threshold: number) {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'g1', firstName: 'A', lastName: 'B', agencyId: 'ag1', clientId: 7, isActive: true, deletedAt: null }) },
    wallet: { findMany: jest.fn().mockResolvedValue([{ id: 'w1', currency: 'XOF', balance: 10_000_000, reservedBalance: 0, isDefault: true, isFrozen: false }]) },
  };
  const feeSchedule: any = { quote: jest.fn().mockResolvedValue({ fees: 100, total: 0, feeRatePct: 1, source: 'DEFAULT', rule: null }) };
  const rates: any = { convert: jest.fn().mockResolvedValue(1) };
  const thresholds: any = { thresholdFor: jest.fn().mockResolvedValue(threshold) };
  return { service: new AgentDeskService(prisma, feeSchedule, rates, thresholds), thresholds };
}

describe('AgentDeskService.sendPreview — seuil de validation de la société', () => {
  it('lit le seuil de la société de l\'agent dans la devise de la caisse', async () => {
    const { service, thresholds } = build(200_000);
    await service.sendPreview('g1', 100_000, 'GN');
    expect(thresholds.thresholdFor).toHaveBeenCalledWith(7, 'XOF');
  });

  it('au-dessus du seuil réglé : validation requise', async () => {
    const { service } = build(200_000);
    const res = await service.sendPreview('g1', 300_000, 'GN');
    expect(res).toMatchObject({ needsValidation: true, validationThreshold: 200_000 });
  });

  it('sous le seuil réglé (même au-dessus de 500 000 par défaut) : pas de validation', async () => {
    const { service } = build(2_000_000);
    const res = await service.sendPreview('g1', 600_000, 'GN');
    expect(res).toMatchObject({ needsValidation: false, validationThreshold: 2_000_000 });
  });

  it('au seuil exact : pas de validation', async () => {
    const { service } = build(300_000);
    const res = await service.sendPreview('g1', 300_000, 'GN');
    expect(res.needsValidation).toBe(false);
  });
});
