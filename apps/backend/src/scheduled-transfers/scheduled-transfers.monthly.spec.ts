// apps/backend/src/scheduled-transfers/scheduled-transfers.monthly.spec.ts
// Audit (point faible) — MONTHLY ne déborde plus sur le mois suivant (31 janv. → 28/29 févr., pas 3 mars).
import 'reflect-metadata';
import { ScheduledTransfersService } from './scheduled-transfers.service';

const next = (iso: string, frequency = 'MONTHLY', anchorDay?: number) => {
  const service: any = Object.create(ScheduledTransfersService.prototype);
  return service.calculateNextDate(new Date(iso), frequency, anchorDay) as Date | null;
};
const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

describe('ScheduledTransfersService.calculateNextDate — MONTHLY', () => {
  it('31 janvier → 28 février (année non bissextile), pas le 3 mars', () => {
    expect(ymd(next('2027-01-31T12:00:00'))).toBe('2027-02-28');
  });
  it('31 janvier → 29 février (année bissextile)', () => {
    expect(ymd(next('2028-01-31T12:00:00'))).toBe('2028-02-29');
  });
  it('30 janvier → 28 février ; 31 mars → 30 avril', () => {
    expect(ymd(next('2027-01-30T12:00:00'))).toBe('2027-02-28');
    expect(ymd(next('2027-03-31T12:00:00'))).toBe('2027-04-30');
  });
  it('jour ordinaire inchangé, passage d\'année correct', () => {
    expect(ymd(next('2027-05-15T12:00:00'))).toBe('2027-06-15');
    expect(ymd(next('2027-12-31T12:00:00'))).toBe('2028-01-31');
  });
  it('l\'heure est conservée ; les autres fréquences sont inchangées', () => {
    expect(next('2027-01-31T09:30:00')!.getHours()).toBe(9);
    expect(ymd(next('2027-01-31T12:00:00', 'DAILY'))).toBe('2027-02-01');
    expect(ymd(next('2027-01-31T12:00:00', 'WEEKLY'))).toBe('2027-02-07');
    expect(next('2027-01-31T12:00:00', 'ONCE')).toBeNull();
  });
});

describe('MONTHLY — jour d\'ancrage', () => {
  it('un virement du 31 retombe sur le 31 dès que le mois le permet (31 janv. → 28 févr. → 31 mars → 30 avr. → 31 mai)', () => {
    const service: any = Object.create(ScheduledTransfersService.prototype);
    let d: Date = new Date('2027-01-31T12:00:00');
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) { d = service.calculateNextDate(d, 'MONTHLY', 31) as Date; seen.push(ymd(d)); }
    expect(seen).toEqual(['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  });
  it('sans ancre (anciens virements), le jour de l\'échéance courante sert de base, comme avant', () => {
    expect(ymd(next('2027-02-28T12:00:00'))).toBe('2027-03-28');
  });
  it('une ancre invalide est ignorée', () => {
    expect(ymd(next('2027-01-15T12:00:00', 'MONTHLY', 0))).toBe('2027-02-15');
    expect(ymd(next('2027-01-15T12:00:00', 'MONTHLY', 45))).toBe('2027-02-15');
  });
});
