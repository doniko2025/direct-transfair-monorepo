// apps/backend/src/beneficiaries/beneficiaries.delete-guard.spec.ts
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';

function make(counts: { tx?: number; scheduled?: number }) {
  const prisma: any = {
    beneficiary: {
      findFirst: jest.fn().mockResolvedValue({ id: 'b1', userId: 'u1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1', userId: 'u1' }),
      delete: jest.fn().mockResolvedValue({}),
    },
    transaction: { count: jest.fn().mockResolvedValue(counts.tx ?? 0) },
    scheduledTransfer: { count: jest.fn().mockResolvedValue(counts.scheduled ?? 0) },
  };
  const service = new (BeneficiariesService as any)(prisma) as BeneficiariesService;
  jest.spyOn(service as any, 'findOneForUser').mockResolvedValue({ id: 'b1', userId: 'u1' });
  return { service, prisma };
}

describe('BeneficiariesService.deleteForUser — virements programmés', () => {
  it('refuse si un virement programmé ACTIVE / PAUSED pointe sur ce bénéficiaire', async () => {
    const { service, prisma } = make({ scheduled: 1 });
    await expect(service.deleteForUser('b1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteForUser('b1', 'u1')).rejects.toThrow(/virement programmé/);
    expect(prisma.scheduledTransfer.count).toHaveBeenCalledWith({ where: { beneficiaryId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] } } });
    expect(prisma.beneficiary.delete).not.toHaveBeenCalled();
  });

  it('supprime quand rien ne le référence', async () => {
    const { service, prisma } = make({});
    await expect(service.deleteForUser('b1', 'u1')).resolves.toEqual({ deleted: true, id: 'b1' });
    expect(prisma.beneficiary.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });

  it('refuse toujours un bénéficiaire lié à des transactions', async () => {
    const { service } = make({ tx: 2 });
    await expect(service.deleteForUser('b1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
