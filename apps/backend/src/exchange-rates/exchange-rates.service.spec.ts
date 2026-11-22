// apps/backend/src/exchange-rates/exchange-rates.service.spec.ts
// @types/jest requis : pnpm add -D @types/jest (dans apps/backend)
import { Test, TestingModule }  from '@nestjs/testing';
import { NotFoundException }    from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { PrismaService }        from '../prisma/prisma.service';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;

  const mockPrisma = {
    exchangeRate: {
      findMany:   jest.fn().mockResolvedValue([]),
      findFirst:  jest.fn().mockResolvedValue(null),
      upsert:     jest.fn().mockResolvedValue({ id: 'cuid1', pair: 'EUR_XOF', rate: 655.957 }),
    },
    exchangeRateHistory: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn().mockResolvedValue({ id: 'cuid2' }),
    },
    client: { findUnique: jest.fn().mockResolvedValue({ fxMarginPct: 0 }) },   // marge de change de la société (v2.1)
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
    jest.resetAllMocks();   // les valeurs posées par un test ne fuient pas dans le suivant
    mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
    mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'cuid1', pair: 'EUR_XOF', rate: 655.957 });
    mockPrisma.exchangeRateHistory.findMany.mockResolvedValue([]);
    mockPrisma.exchangeRateHistory.create.mockResolvedValue({ id: 'cuid2' });
    mockPrisma.client.findUnique.mockResolvedValue({ fxMarginPct: 0 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const CO = 7; // société de test

  it('findAll() filtre sur la société ET sur isActive:true', async () => {
    await service.findAll(CO);
    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: CO, isActive: true } }),
    );
  });

  it('findAll() ajoute la marge de change de la société à chaque ligne', async () => {
    mockPrisma.exchangeRate.findMany.mockResolvedValue([{ pair: 'EUR_GNF', rate: 10500 }]);
    mockPrisma.client.findUnique.mockResolvedValue({ fxMarginPct: '1.50' });
    await expect(service.findAll(CO)).resolves.toEqual([{ pair: 'EUR_GNF', rate: 10500, fxMarginPct: 1.5 }]);
  });

  it('convert() retient la marge de change : 10 700 avec 2 % de marge → 10 486', async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ pair: 'EUR_GNF', rate: 10700 });
    mockPrisma.client.findUnique.mockResolvedValue({ fxMarginPct: 2 });
    const result = await service.convert(1, 'EUR', 'GNF', CO);
    expect(result.rate).toBeCloseTo(10486, 6);
    expect(result.convertedAmount).toBeCloseTo(10486, 2);
  });

  it('convert() par la paire inverse retient aussi la marge (le client reçoit moins, jamais plus)', async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ pair: 'EUR_GNF', rate: 10000 });
    mockPrisma.client.findUnique.mockResolvedValue({ fxMarginPct: 2 });
    const result = await service.convert(10000, 'GNF', 'EUR', CO);
    expect(result.rate).toBeCloseTo(0.0001 * 0.98, 12);
  });

  it('findAll() sans société : aucun taux publié, aucune requête', async () => {
    await expect(service.findAll(null)).resolves.toEqual([]);
    expect(mockPrisma.exchangeRate.findMany).not.toHaveBeenCalled();
  });

  it('findByPair() lève NotFoundException si absent', async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
    await expect(service.findByPair('EUR_UNKNOWN', CO)).rejects.toThrow(NotFoundException);
  });

  it('findByPair() cherche dans les taux de la société uniquement', async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 });
    await service.findByPair('eur_xof', CO);
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledWith({ where: { clientId: CO, pair: 'EUR_XOF' } });
  });

  it('convert() retourne rate=1 si from === to', async () => {
    const result = await service.convert(100, 'XOF', 'XOF', CO);
    expect(result).toEqual({ amount: 100, rate: 1, convertedAmount: 100 });
    expect(mockPrisma.exchangeRate.findFirst).not.toHaveBeenCalled();
  });

  it('convert() utilise la paire directe de la société', async () => {
    mockPrisma.exchangeRate.findFirst.mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 });
    const result = await service.convert(1, 'EUR', 'XOF', CO);
    expect(result.rate).toBeCloseTo(655.957);
    expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledWith({ where: { clientId: CO, pair: 'EUR_XOF' } });
  });

  it('convert() sans société : aucun taux, NotFoundException', async () => {
    await expect(service.convert(1, 'EUR', 'XOF', null)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.exchangeRate.findFirst).not.toHaveBeenCalled();
  });

  it('upsert() écrit le taux de LA société (clé société + paire)', async () => {
    await service.upsert(CO, 'EUR_XOF', 660);
    expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId_pair: { clientId: CO, pair: 'EUR_XOF' } },
        create: expect.objectContaining({ clientId: CO, pair: 'EUR_XOF', rate: 660 }),
      }),
    );
  });

  it('upsert() crée un historique lié au taux (rateId)', async () => {
    await service.upsert(CO, 'EUR_XOF', 660);
    expect(mockPrisma.exchangeRateHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rateId: 'cuid1', pair: 'EUR_XOF', rate: 660 }),
      }),
    );
  });
});
