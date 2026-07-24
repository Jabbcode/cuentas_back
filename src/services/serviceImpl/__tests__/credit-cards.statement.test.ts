import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Account, CreditCardPayment, Transaction } from '@prisma/client';
import { buildStatement } from '../credit-cards.service.js';

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'card-1',
    name: 'Tarjeta Test',
    type: 'credit_card',
    balance: 0,
    initialBalance: 0,
    currency: 'EUR',
    color: null,
    userId: 'user-1',
    creditLimit: 1000,
    cutoffDay: 5,
    paymentDueDay: 20,
    paymentAccountId: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Account;
}

function fakeTx(date: Date, amount: number): Transaction {
  return { date, amount } as unknown as Transaction;
}

function fakePayment(periodStart: Date, periodEnd: Date): CreditCardPayment {
  return { periodStart, periodEnd } as unknown as CreditCardPayment;
}

describe('buildStatement', () => {
  const today = new Date(2026, 5, 10); // 10 jun 2026 — cutoffDay=5 -> lastCutoff=5 jun, previousCutoff=5 may

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con transacciones en ambos períodos calcula los balances correctos', () => {
    const account = fakeAccount();
    const transactions = [
      fakeTx(new Date(2026, 4, 10), 100), // periodo cerrado (mayo)
      fakeTx(new Date(2026, 5, 7), 50), // periodo actual (junio, tras el corte del 5)
    ];

    const statement = buildStatement(account, transactions, [], today);

    expect(statement.closedPeriod.balance).toBe(100);
    expect(statement.currentPeriod.balance).toBe(50);
  });

  it('período cerrado pagado: isPaid true y available no descuenta el cerrado', () => {
    const account = fakeAccount();
    const transactions = [
      fakeTx(new Date(2026, 4, 10), 100), // cerrado
      fakeTx(new Date(2026, 5, 7), 50), // actual
    ];
    // previousCutoffUTC = 2026-05-05T00:00Z, closedPeriodEndUTC = 2026-06-04T00:00Z
    const payments = [fakePayment(new Date(Date.UTC(2026, 4, 5)), new Date(Date.UTC(2026, 5, 4)))];

    const statement = buildStatement(account, transactions, payments, today);

    expect(statement.closedPeriod.isPaid).toBe(true);
    // available = creditLimit - currentBalance (el cerrado, ya pagado, no descuenta)
    expect(statement.available).toBe(1000 - 50);
  });

  it('sin transacciones: balances en 0 y sin alertas', () => {
    const account = fakeAccount();

    const statement = buildStatement(account, [], [], today);

    expect(statement.currentPeriod.balance).toBe(0);
    expect(statement.closedPeriod.balance).toBe(0);
    expect(statement.available).toBe(1000);
    expect(statement.alerts).toEqual([]);
  });

  it('uso >= 90% del límite genera alerta de severidad error', () => {
    const account = fakeAccount({ creditLimit: 100 });
    const transactions = [fakeTx(new Date(2026, 5, 7), 95)]; // periodo actual

    const statement = buildStatement(account, transactions, [], today);

    expect(statement.usagePercentage).toBe(95);
    expect(statement.alerts).toContainEqual(
      expect.objectContaining({ type: 'high_usage', severity: 'error' })
    );
  });
});
