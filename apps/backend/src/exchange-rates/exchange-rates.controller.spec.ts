// apps/backend/src/exchange-rates/exchange-rates.controller.spec.ts
// @types/jest requis : pnpm add -D @types/jest (dans apps/backend)
import { Test, TestingModule }     from '@nestjs/testing';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService }    from './exchange-rates.service';

describe('ExchangeRatesController', () => {
  let controller: ExchangeRatesController;

  const mockService = {
    clientIdByCode: jest.fn().mockResolvedValue(null),
    findAll:    jest.fn().mockResolvedValue([]),
    findByPair: jest.fn().mockResolvedValue({ pair: 'EUR_XOF', rate: 655.957 }),
    getHistory: jest.fn().mockResolvedValue([]),
    convert:    jest.fn().mockResolvedValue({ amount: 100, rate: 655.957, convertedAmount: 65596 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeRatesController],
      providers:   [{ provide: ExchangeRatesService, useValue: mockService }],
    }).compile();

    controller = module.get<ExchangeRatesController>(ExchangeRatesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

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

  it('n\'expose aucune route d\'écriture de taux (réservée à /rates-admin)', () => {
    expect((controller as any).update).toBeUndefined();
  });
});
