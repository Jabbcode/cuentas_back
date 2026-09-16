import { describe, it, expect } from 'vitest';
import {
  assertCreditCardPeriodLimit,
  CreditCardPeriodLimitInfo,
  resolveCreditLimitAt,
  CreditLimitEntry,
} from '../credit-card-limit.utils.js';
import { ConflictError, ValidationError } from '../../errors.js';

function fakeCard(overrides: Partial<CreditCardPeriodLimitInfo> = {}): CreditCardPeriodLimitInfo {
  return {
    type: 'credit_card',
    periodLimit: 1000,
    periodUsed: 0,
    periodStart: new Date(2026, 5, 5),
    periodEnd: new Date(2026, 6, 4),
    ...overrides,
  };
}

describe('assertCreditCardPeriodLimit', () => {
  it('gasto que supera el límite del período lanza ConflictError', () => {
    const card = fakeCard({ periodLimit: 100, periodUsed: 50 });

    expect(() => assertCreditCardPeriodLimit(card, 60, 'expense')).toThrow(ConflictError);
  });

  it('gasto justo en el límite del período no lanza', () => {
    const card = fakeCard({ periodLimit: 100, periodUsed: 50 });

    expect(() => assertCreditCardPeriodLimit(card, 50, 'expense')).not.toThrow();
  });

  it('gasto dentro del límite del período no lanza', () => {
    const card = fakeCard({ periodLimit: 100, periodUsed: 50 });

    expect(() => assertCreditCardPeriodLimit(card, 40, 'expense')).not.toThrow();
  });

  it('periodLimit null (tarjeta sin límite configurado) lanza ValidationError', () => {
    const card = fakeCard({ periodLimit: null });

    expect(() => assertCreditCardPeriodLimit(card, 10, 'expense')).toThrow(ValidationError);
  });

  it('tipo resultante income no valida', () => {
    const card = fakeCard({ periodLimit: 100, periodUsed: 90 });

    expect(() => assertCreditCardPeriodLimit(card, 500, 'income')).not.toThrow();
  });

  it('cuenta que no es credit_card no valida', () => {
    const card = fakeCard({ type: 'bank', periodLimit: null });

    expect(() => assertCreditCardPeriodLimit(card, 500, 'expense')).not.toThrow();
  });

  it('el mensaje de error nombra el período afectado y su límite', () => {
    const card = fakeCard({
      periodLimit: 100,
      periodUsed: 50,
      periodStart: new Date(2026, 5, 5),
      periodEnd: new Date(2026, 6, 4),
    });

    expect(() => assertCreditCardPeriodLimit(card, 60, 'expense')).toThrow(/2026-06-05/);
    expect(() => assertCreditCardPeriodLimit(card, 60, 'expense')).toThrow(/2026-07-04/);
    expect(() => assertCreditCardPeriodLimit(card, 60, 'expense')).toThrow(/100/);
  });

  it('no depende del saldo total de la cuenta: un período distinto con deuda alta no bloquea este gasto', () => {
    // periodUsed refleja solo el uso de ESTE período, no la deuda acumulada de otros
    const card = fakeCard({ periodLimit: 1000, periodUsed: 100 });

    expect(() => assertCreditCardPeriodLimit(card, 200, 'expense')).not.toThrow();
  });
});

describe('resolveCreditLimitAt', () => {
  function entry(creditLimit: number, effectiveFrom: string): CreditLimitEntry {
    return { creditLimit, effectiveFrom: new Date(effectiveFrom) };
  }

  it('lista vacía devuelve el fallback', () => {
    expect(resolveCreditLimitAt([], new Date('2026-06-01'), 1000)).toBe(1000);
  });

  it('at anterior a todas las entradas devuelve el fallback', () => {
    const entries = [entry(500, '2026-06-01'), entry(800, '2026-07-01')];
    expect(resolveCreditLimitAt(entries, new Date('2026-05-01'), 1000)).toBe(1000);
  });

  it('con varias entradas devuelve la más reciente con effectiveFrom <= at', () => {
    const entries = [entry(500, '2026-06-01'), entry(800, '2026-07-01'), entry(1200, '2026-09-01')];
    expect(resolveCreditLimitAt(entries, new Date('2026-07-15'), 2000)).toBe(800);
  });

  it('at exactamente igual a effectiveFrom de una entrada la incluye', () => {
    const entries = [entry(500, '2026-06-01'), entry(800, '2026-07-01')];
    expect(resolveCreditLimitAt(entries, new Date('2026-07-01'), 2000)).toBe(800);
  });

  it('at posterior a todas las entradas devuelve la última', () => {
    const entries = [entry(500, '2026-06-01'), entry(800, '2026-07-01')];
    expect(resolveCreditLimitAt(entries, new Date('2026-12-01'), 2000)).toBe(800);
  });
});
