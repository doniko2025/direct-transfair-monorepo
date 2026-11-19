import { ForbiddenException } from '@nestjs/common';
import { assertSendPin, sendRequiresPin } from './send-pin';

describe('assertSendPin (audit argent I1)', () => {
  const pins = { assertPin: jest.fn() };
  beforeEach(() => pins.assertPin.mockReset());

  it('exige le code pour un client', () => {
    expect(sendRequiresPin('USER')).toBe(true);
    expect(sendRequiresPin('AGENT')).toBe(false);
  });

  it('refuse un client sans code', async () => {
    await expect(assertSendPin(pins, { id: 'u1', role: 'USER' }, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(assertSendPin(pins, { id: 'u1', role: 'USER' }, '')).rejects.toMatchObject({ response: { code: 'PIN_REQUIRED' } });
    expect(pins.assertPin).not.toHaveBeenCalled();
  });

  it('vérifie le code d’un client', async () => {
    pins.assertPin.mockResolvedValue(undefined);
    await assertSendPin(pins, { id: 'u1', role: 'USER' }, '482913');
    expect(pins.assertPin).toHaveBeenCalledWith('u1', '482913');
  });

  it('propage un code faux', async () => {
    pins.assertPin.mockRejectedValue(new ForbiddenException('Code secret incorrect.'));
    await expect(assertSendPin(pins, { id: 'u1', role: 'USER' }, '111222')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('dispense les comptes web', async () => {
    await assertSendPin(pins, { id: 'a1', role: 'AGENT' }, undefined);
    expect(pins.assertPin).not.toHaveBeenCalled();
  });

  it('refuse un appel non authentifié', async () => {
    await expect(assertSendPin(pins, undefined, '482913')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
