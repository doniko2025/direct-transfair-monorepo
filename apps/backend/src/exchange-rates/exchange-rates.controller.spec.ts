// apps/backend/src/exchange-rates/exchange-rates.controller.spec.ts
// @types/jest requis : pnpm add -D @types/jest (dans apps/backend)
import { Test, TestingModule }     from '@nestjs/testing';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService }    from './exchange-rates.service';
import { JwtAuthGuard }            from '../auth/jwt-auth.guard';

describe('ExchangeRatesController', () => {
  let controller: ExchangeRatesController;

  const mockService = {
    findAll:    jest.fn().mockResolvedValue([]),
    findByPair: jest.fn().mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 }),
    getHistory: jest.fn().mockResolvedValue([]),
    convert:    jest.fn().mockResolvedValue({ amount: 100, rate: 655.957, convertedAmount: 65596 }),
    upsert:     jest.fn().mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeRatesController],
      providers:   [{ provide: ExchangeRatesService, useValue: mockService }],
    })
      // La garde JWT a ses propres dépendances (JwtService, Prisma) : on la neutralise ici,
      // son comportement est couvert par les tests d'intégration de l'authentification.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExchangeRatesController>(ExchangeRatesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getAll() retourne la liste des taux', async () => {
    const result = await controller.getAll();
    expect(result).toEqual([]);
    expect(mockService.findAll).toHaveBeenCalledTimes(1);
  });

  it('getOne() appelle findByPair avec la bonne paire', async () => {
    await controller.getOne('EUR_XOF');
    expect(mockService.findByPair).toHaveBeenCalledWith('EUR_XOF');
  });

  it('convert() retourne le montant converti', async () => {
    const result = await controller.convert({ amount: 100, from: 'EUR', to: 'XOF' });
    expect(result).toHaveProperty('convertedAmount');
  });

  it('update() appelle upsert avec la paire et le taux', async () => {
    await controller.update('EUR_XOF', { rate: 660 });
    expect(mockService.upsert).toHaveBeenCalledWith('EUR_XOF', 660);
  });

  it('update() normalise la paire (EUR/XOF → EUR_XOF)', async () => {
    await controller.update('eur/xof', { rate: 660 });
    expect(mockService.upsert).toHaveBeenCalledWith('EUR_XOF', 660);
  });

  it.each([0, -5, NaN, Infinity, 'abc', null, undefined, 1e12])('update() refuse le taux %p', (rate) => {
    expect(() => controller.update('EUR_XOF', { rate: rate as number })).toThrow();
    expect(mockService.upsert).not.toHaveBeenCalled();
  });

  it.each(['EUR_EUR', 'EUR_JPY', 'foo', ''])('update() refuse la paire %p', (pair) => {
    expect(() => controller.update(pair, { rate: 1 })).toThrow();
    expect(mockService.upsert).not.toHaveBeenCalled();
  });
});
