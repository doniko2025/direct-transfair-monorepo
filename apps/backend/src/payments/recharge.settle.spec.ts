// apps/backend/src/payments/recharge.settle.spec.ts
// Audit argent (v1.5) — GET /payments/recharge/:id/status ne règle QUE les vraies recharges de l'utilisateur.
// Faille corrigée : un agent obtenait un second crédit (sur son wallet personnel) du montant d'un dépôt en agence qu'il avait fait.
import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { TransactionDirection as Dir, TransactionStatus as S, TransactionType as T } from '@prisma/client';
import { RechargeService } from './recharge.service';

type Row = Record<string, any>;

/** Petite base en mémoire : findFirst applique réellement le filtre demandé (égalités simples). */
function setup(rows: Row[]) {
  const prisma: any = {
    transaction: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
        rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null),
    },
  };
  const wallets: any = {
    getOrCreateWallet: jest.fn().mockImplementation(async (p: any) => ({ id: `wallet-${p.userId}` })),
    creditOnce: jest.fn().mockResolvedValue(true),
  };
  const settings: any = {};
  const service = new RechargeService(prisma, wallets, {} as any, {} as any, settings);
  return { service, wallets, prisma };
}

// Dépôt en agence : l'AGENT est expéditeur, le client destinataire, direction par défaut (OUTBOUND).
const agentDeposit: Row = {
  id: 'dep1', type: T.DEPOSIT, status: S.PAID, senderId: 'agent1', recipientId: 'client1',
  direction: Dir.OUTBOUND, amount: 50000, currency: 'XOF', paymentMethod: 'CASH',
};
// Vraie recharge : l'utilisateur est expéditeur ET destinataire, direction INBOUND.
const realRecharge: Row = {
  id: 'rec1', type: T.DEPOSIT, status: S.PAID, senderId: 'client1', recipientId: 'client1',
  direction: Dir.INBOUND, amount: 20000, currency: 'XOF', paymentMethod: 'ORANGE_MONEY',
};

describe('RechargeService.checkAndSettle — pas de crédit sur un dépôt d\'agence', () => {
  it('un agent qui interroge SON dépôt en agence : introuvable, aucun crédit', async () => {
    const { service, wallets } = setup([agentDeposit, realRecharge]);
    await expect(service.checkAndSettle('agent1', 'dep1')).rejects.toBeInstanceOf(NotFoundException);
    expect(wallets.creditOnce).not.toHaveBeenCalled();
  });

  it('le client qui reçoit le dépôt ne peut pas non plus le régler comme une recharge', async () => {
    const { service, wallets } = setup([agentDeposit]);
    await expect(service.checkAndSettle('client1', 'dep1')).rejects.toBeInstanceOf(NotFoundException);
    expect(wallets.creditOnce).not.toHaveBeenCalled();
  });

  it('la recharge d\'un autre utilisateur reste introuvable', async () => {
    const { service, wallets } = setup([realRecharge]);
    await expect(service.checkAndSettle('someone-else', 'rec1')).rejects.toBeInstanceOf(NotFoundException);
    expect(wallets.creditOnce).not.toHaveBeenCalled();
  });

  it('une vraie recharge payée est créditée une fois, sur le wallet de son propriétaire', async () => {
    const { service, wallets } = setup([realRecharge]);
    const tx = await service.checkAndSettle('client1', 'rec1');
    expect(tx.id).toBe('rec1');
    expect(wallets.creditOnce).toHaveBeenCalledTimes(1);
    expect(wallets.creditOnce).toHaveBeenCalledWith('wallet-client1', 20000, expect.any(String), 'rec1');
  });

  it('une recharge pas encore payée n\'est pas créditée', async () => {
    const { service, wallets } = setup([{ ...realRecharge, status: S.VALIDATED }]);
    await service.checkAndSettle('client1', 'rec1');
    expect(wallets.creditOnce).not.toHaveBeenCalled();
  });
});
