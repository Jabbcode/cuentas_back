import { describe, it, expect } from 'vitest';
import {
  assertCreditCardLimit,
  CreditCardBalanceInfo,
  resolveCreditLimitAt,
  CreditLimitEntry,
} from '../credit-card-limit.utils.js';
import { ConflictError, ValidationError } from '../../errors.js';

function fakeAccount(overrides: Partial<CreditCardBalanceInfo> = {}): CreditCardBalanceInfo {
  return {
    type: 'credit_card',
    creditLimit: 1000,
    balance: 0,
    initialBalance: 0,
    ...overrides,
  };
}

describe('assertCreditCardLimit', () => {
  it('gasto que supera el límite lanza ConflictError', () => {
    const account = fakeAccount({ creditLimit: 100, balance: -50, initialBalance: 0 });

    expect(() => assertCreditCardLimit(account, 60, 'expense')).toThrow(ConflictError);
  });

  it('gasto dentro del límite no lanza', () => {
    const account = fakeAccount({ creditLimit: 100, balance: -50, initialBalance: 0 });

    expect(() => assertCreditCardLimit(account, 40, 'expense')).not.toThrow();
  });

  it('tarjeta sin creditLimit configurado lanza ValidationError', () => {
    const account = fakeAccount({ creditLimit: null });

    expect(() => assertCreditCardLimit(account, 10, 'expense')).toThrow(ValidationError);
  });

  it('tipo resultante income no valida', () => {
    const account = fakeAccount({ creditLimit: 100, balance: -90, initialBalance: 0 });

    expect(() => assertCreditCardLimit(account, 500, 'income')).not.toThrow();
  });

  it('cuenta que no es credit_card no valida', () => {
    const account = fakeAccount({ type: 'bank', creditLimit: null });

    expect(() => assertCreditCardLimit(account, 500, 'expense')).not.toThrow();
  });

  it('respeta initialBalance distinto de 0 al calcular el uso resultante', () => {
    // initialBalance = 500, balance actual = 500 (uso actual = 0), gasto de N -> uso resultante = N
    const account = fakeAccount({ creditLimit: 1000, balance: 500, initialBalance: 500 });

    expect(() => assertCreditCardLimit(account, 900, 'expense')).not.toThrow();
    expect(() => assertCreditCardLimit(account, 1200, 'expense')).toThrow(ConflictError);
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
