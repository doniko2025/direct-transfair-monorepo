// apps/backend/src/exchange-rates/exchange-rates.controller.spec.ts
// @types/jest requis : pnpm add -D @types/jest (dans apps/backend)
import { Test, TestingModule }     from '@nestjs/testing';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService }    from './exchange-rates.service';
import { JwtAuthGuard }            from '../auth/jwt-auth.guard';

describe('ExchangeRatesController', () => {
  let controller: ExchangeRatesController;

  const mockService = {
    clientIdByCode: jest.fn().mockResolvedValue(null),
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

  const req = (clientId: number | null = 3) => ({ user: { id: 'u1', role: 'COMPANY_ADMIN', clientId } }) as any;

  it('getAll() retourne les taux de la société désignée par son code', async () => {
    mockService.clientIdByCode.mockResolvedValueOnce(3);
    const result = await controller.getAll('FLASH');
    expect(result).toEqual([]);
    expect(mockService.clientIdByCode).toHaveBeenCalledWith('FLASH');
    expect(mockService.findAll).toHaveBeenCalledWith(3);
  });

  it('getOne() appelle findByPair avec la bonne paire et la société', async () => {
    mockService.clientIdByCode.mockResolvedValueOnce(3);
    await controller.getOne('EUR_XOF', 'FLASH');
    expect(mockService.findByPair).toHaveBeenCalledWith('EUR_XOF', 3);
  });

  it('convert() retourne le montant converti', async () => {
    const result = await controller.convert({ amount: 100, from: 'EUR', to: 'XOF' }, 'FLASH');
    expect(result).toHaveProperty('convertedAmount');
  });

  it('update() appelle upsert avec la société du jeton, la paire et le taux', async () => {
    await controller.update(req(3), 'EUR_XOF', { rate: 660 });
    expect(mockService.upsert).toHaveBeenCalledWith(3, 'EUR_XOF', 660);
  });

  it('update() normalise la paire (EUR/XOF → EUR_XOF)', async () => {
    await controller.update(req(3), 'eur/xof', { rate: 660 });
    expect(mockService.upsert).toHaveBeenCalledWith(3, 'EUR_XOF', 660);
  });

  it('update() sans société rattachée → 403, rien d\'écrit', () => {
    expect(() => controller.update(req(null), 'EUR_XOF', { rate: 660 })).toThrow();
    expect(mockService.upsert).not.toHaveBeenCalled();
  });

  it.each([0, -5, NaN, Infinity, 'abc', null, undefined, 1e12])('update() refuse le taux %p', (rate) => {
    expect(() => controller.update(req(), 'EUR_XOF', { rate: rate as number })).toThrow();
    expect(mockService.upsert).not.toHaveBeenCalled();
  });

  it.each(['EUR_EUR', 'EUR_JPY', 'foo', ''])('update() refuse la paire %p', (pair) => {
    expect(() => controller.update(req(), pair, { rate: 1 })).toThrow();
    expect(mockService.upsert).not.toHaveBeenCalled();
  });
});
