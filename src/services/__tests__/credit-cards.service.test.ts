import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Account, CreditCardPayment } from '@prisma/client';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import type { CreditCardPaymentRepository } from '../../repositories/credit-card-payment.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import { CreditCardsServiceImpl } from '../credit-cards.service.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('../../repositories/fixed-expense.repository.js', () => ({
  findFirst: vi.fn(),
}));

vi.mock('../transactions.service.js', () => ({
  createTransaction: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';
import * as fixedExpenseRepo from '../../repositories/fixed-expense.repository.js';
import { createTransaction } from '../transactions.service.js';

const mockedFindMany = transactionRepo.findMany as unknown as ReturnType<typeof vi.fn>;
const mockedFindFirstTx = transactionRepo.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockedFindFirstFixedExpense = fixedExpenseRepo.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const mockedCreateTransaction = createTransaction as unknown as ReturnType<typeof vi.fn>;

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'card-1',
    name: 'Tarjeta Test',
    type: 'credit_card',
    balance: 0,
    currency: 'EUR',
    userId: 'user-1',
    creditLimit: 1000,
    cutoffDay: 5,
    paymentDueDay: 20,
    paymentAccountId: null,
    ...overrides,
  } as unknown as Account;
}

function fakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findCreditCardsByUser: async () => [],
    countByUser: async () => 0,
    create: async () => fakeAccount(),
    update: async () => fakeAccount(),
    updateBalance: async () => fakeAccount(),
    decrementBalance: async () => fakeAccount(),
    remove: async () => fakeAccount(),
    createTransfer: async () => {
      throw new Error('not used in these tests');
    },
    findTransfersByAccount: async () => [],
    ...overrides,
  };
}

function fakeCreditCardPaymentRepo(
  overrides: Partial<CreditCardPaymentRepository> = {}
): CreditCardPaymentRepository {
  return {
    findFirst: async () => null,
    findMany: async () => [],
    create: async () =>
      ({ id: 'payment-1', accountId: 'card-1', amount: 50 }) as unknown as CreditCardPayment,
    ...overrides,
  };
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not used in these tests');
    },
    update: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => {
      throw new Error('not used in these tests');
    },
    upsertSystemCategory: async () => ({ id: 'category-payment' }) as never,
    ...overrides,
  };
}

function buildService(
  overrides: {
    accountRepo?: Partial<AccountRepository>;
    creditCardPaymentRepo?: Partial<CreditCardPaymentRepository>;
    categoryRepo?: Partial<CategoryRepository>;
  } = {}
) {
  return new CreditCardsServiceImpl(
    fakeAccountRepo(overrides.accountRepo),
    fakeCreditCardPaymentRepo(overrides.creditCardPaymentRepo),
    fakeCategoryRepo(overrides.categoryRepo)
  );
}

describe('CreditCardsServiceImpl', () => {
  const today = new Date(2026, 5, 10); // 10 jun 2026 — cutoffDay=5 -> lastCutoff=5 jun

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(today);
    mockedFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCreditCardStatement', () => {
    it('lanza NotFoundError si la cuenta no existe', async () => {
      const service = buildService({ accountRepo: { findByIdAndUser: async () => null } });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'Cuenta no encontrada o no es una tarjeta de crédito'
      );
    });

    it('lanza NotFoundError si la cuenta no es una tarjeta de crédito', async () => {
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => fakeAccount({ type: 'bank' }) },
      });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'Cuenta no encontrada o no es una tarjeta de crédito'
      );
    });

    it('lanza ValidationError si no tiene fechas de corte/pago configuradas', async () => {
      const service = buildService({
        accountRepo: {
          findByIdAndUser: async () => fakeAccount({ cutoffDay: null, paymentDueDay: null }),
        },
      });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'La tarjeta no tiene configuradas las fechas de corte y pago'
      );
    });

    it('éxito: devuelve el statement calculado', async () => {
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => fakeAccount() },
      });

      const statement = await service.getCreditCardStatement('card-1', 'user-1');

      expect(statement.account.id).toBe('card-1');
      expect(statement.creditLimit).toBe(1000);
    });
  });

  describe('payCreditCardStatement', () => {
    it('lanza ConflictError si el período cerrado ya está pagado', async () => {
      const account = fakeAccount();
      const previousCutoffUTC = new Date(Date.UTC(2026, 4, 5));
      const closedPeriodEndUTC = new Date(Date.UTC(2026, 5, 4));
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => account },
        creditCardPaymentRepo: {
          findMany: async () => [
            {
              periodStart: previousCutoffUTC,
              periodEnd: closedPeriodEndUTC,
            } as unknown as CreditCardPayment,
          ],
        },
      });

      await expect(
        service.payCreditCardStatement('card-1', 'user-1', {
          amount: 50,
          paymentAccountId: 'card-1',
        })
      ).rejects.toThrow('El estado de cuenta ya está pagado');
    });

    it('éxito con cuenta de pago igual a la tarjeta: crea 1 transacción y registra el pago', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue(null);
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => fakeAccount() },
      });

      const payment = await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'card-1',
      });

      expect(payment.id).toBe('payment-1');
      expect(mockedCreateTransaction).toHaveBeenCalledTimes(1);
    });

    it('éxito con cuenta de pago distinta a la tarjeta: crea 2 transacciones', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue(null);
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => fakeAccount() },
      });

      await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'account-bank',
      });

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
    });

    it('con gasto fijo asociado y sin pago este mes: crea una tercera transacción', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue({
        id: 'fe-1',
        name: 'Pago Tarjeta',
        categoryId: 'category-1',
      });
      mockedFindFirstTx.mockResolvedValue(null);
      const service = buildService({
        accountRepo: { findByIdAndUser: async () => fakeAccount() },
      });

      await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'card-1',
      });

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
    });
  });
});
