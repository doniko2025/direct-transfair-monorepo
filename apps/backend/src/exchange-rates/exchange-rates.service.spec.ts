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
      findUnique: jest.fn().mockResolvedValue(null),
      upsert:     jest.fn().mockResolvedValue({ id: 'cuid1', pair: 'EUR_XOF', rate: 655.957 }),
    },
    exchangeRateHistory: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn().mockResolvedValue({ id: 'cuid2' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() filtre sur isActive:true', async () => {
    await service.findAll();
    expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('findByPair() lève NotFoundException si absent', async () => {
    mockPrisma.exchangeRate.findUnique.mockResolvedValue(null);
    await expect(service.findByPair('EUR_UNKNOWN')).rejects.toThrow(NotFoundException);
  });

  it('convert() retourne rate=1 si from === to', async () => {
    const result = await service.convert(100, 'XOF', 'XOF');
    expect(result).toEqual({ amount: 100, rate: 1, convertedAmount: 100 });
    expect(mockPrisma.exchangeRate.findUnique).not.toHaveBeenCalled();
  });

  it('convert() utilise la paire directe', async () => {
    mockPrisma.exchangeRate.findUnique.mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 });
    const result = await service.convert(1, 'EUR', 'XOF');
    expect(result.rate).toBeCloseTo(655.957);
  });

  it('upsert() crée un historique lié au taux (rateId)', async () => {
    await service.upsert('EUR_XOF', 660);
    expect(mockPrisma.exchangeRateHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rateId: 'cuid1', pair: 'EUR_XOF', rate: 660 }),
      }),
    );
  });
});