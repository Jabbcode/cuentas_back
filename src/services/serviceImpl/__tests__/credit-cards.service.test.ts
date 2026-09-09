import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Account, CreditCardPayment, Category } from '@prisma/client';
import type { AccountsService } from '../../interfaces/accounts.service.port.js';
import type { CreditCardPaymentRepository } from '../../../repositories/interfaces/credit-card-payment.repository.port.js';
import type {
  CategoriesService,
  CategorySpending,
} from '../../interfaces/categories.service.port.js';
import type { FixedExpenseRepository } from '../../../repositories/interfaces/fixed-expense.repository.port.js';
import type { TransactionsService } from '../../interfaces/transactions.service.port.js';
import { CreditCardsServiceImpl } from '../credit-cards.service.js';

const mockedFindFirstFixedExpense = vi.fn();
const mockedCreateTransaction = vi.fn();
const mockedFindCardStatementTransactions = vi.fn();
const mockedFindFixedExpensePaymentInMonth = vi.fn();

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

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => {
      throw new Error('not used in these tests');
    },
    findAccountById: async () => null,
    getCreditCards: async () => [],
    getConfiguredCreditCards: async () => [],
    countByUser: async () => 0,
    createAccount: async () => fakeAccount(),
    updateAccount: async () => fakeAccount(),
    deleteAccount: async () => fakeAccount(),
    transferFunds: async () => {
      throw new Error('not used in these tests');
    },
    getTransfersByAccount: async () => [],
    updateAccountBalance: async () => undefined,
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

function fakeCategoriesService(overrides: Partial<CategoriesService> = {}): CategoriesService {
  return {
    getCategories: async () => [],
    getCategoryById: async () => {
      throw new Error('not used in these tests');
    },
    createCategory: async () => {
      throw new Error('not used in these tests');
    },
    updateCategory: async () => {
      throw new Error('not used in these tests');
    },
    deleteCategory: async () => {
      throw new Error('not used in these tests');
    },
    getCategorySpending: async () => ({}) as CategorySpending,
    hydrateCategoriesByIds: async () => [],
    hydrateUserCategoriesByIds: async () => [],
    getOrCreateSystemCategory: async () => ({ id: 'category-payment' }) as unknown as Category,
    countByUser: async () => 0,
    ...overrides,
  };
}

function fakeFixedExpenseRepo(
  overrides: Partial<FixedExpenseRepository> = {}
): FixedExpenseRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: mockedFindFirstFixedExpense,
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
    ...overrides,
  };
}

function fakeTransactionsService(
  overrides: Partial<TransactionsService> = {}
): TransactionsService {
  return {
    getTransactions: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionById: async () => {
      throw new Error('not used in these tests');
    },
    createTransaction: mockedCreateTransaction,
    updateTransaction: async () => {
      throw new Error('not used in these tests');
    },
    deleteTransaction: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionSummary: async () => [],
    getReceiptItems: async () => [],
    countByCategory: async () => 0,
    findMonthlyCategoryExpenses: async () => [],
    findCardStatementTransactions: mockedFindCardStatementTransactions,
    findFixedExpensePaymentInMonth: mockedFindFixedExpensePaymentInMonth,
    resyncTransactionsForFixedExpense: async () => ({ count: 0 }),
    getMonthlyTotalByType: async () => ({ _sum: { amount: null } }),
    getVariableExpenseTotal: async () => ({ _sum: { amount: null } }),
    getCategoryBreakdown: async () => [],
    findTransactionsSince: async () => [],
    getTopExpenseCategories: async () => [],
    getUserTotalsByType: async () => [],
    getExpensesByUserAndCategory: async () => [],
    countByUser: async () => 0,
    getFirstTransactionDate: async () => null,
    findByImageHash: async () => null,
    findSimilarByAmountAndDate: async () => [],
    ...overrides,
  };
}

function buildService(
  overrides: {
    accountsService?: Partial<AccountsService>;
    creditCardPaymentRepo?: Partial<CreditCardPaymentRepository>;
    categoriesService?: Partial<CategoriesService>;
    transactionsService?: Partial<TransactionsService>;
    fixedExpenseRepo?: Partial<FixedExpenseRepository>;
  } = {}
) {
  return new CreditCardsServiceImpl(
    fakeAccountsService(overrides.accountsService),
    fakeCreditCardPaymentRepo(overrides.creditCardPaymentRepo),
    fakeCategoriesService(overrides.categoriesService),
    fakeTransactionsService(overrides.transactionsService),
    fakeFixedExpenseRepo(overrides.fixedExpenseRepo)
  );
}

describe('CreditCardsServiceImpl', () => {
  const today = new Date(2026, 5, 10); // 10 jun 2026 — cutoffDay=5 -> lastCutoff=5 jun

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(today);
    mockedFindCardStatementTransactions.mockResolvedValue([]);
    mockedFindFixedExpensePaymentInMonth.mockResolvedValue(null);
    mockedFindFirstFixedExpense.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCreditCardStatement (usa AccountsService.findAccountById + TransactionsService.findCardStatementTransactions)', () => {
    it('lanza NotFoundError si la cuenta no existe', async () => {
      const service = buildService({ accountsService: { findAccountById: async () => null } });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'Cuenta no encontrada o no es una tarjeta de crédito'
      );
    });

    it('lanza NotFoundError si la cuenta no es una tarjeta de crédito', async () => {
      const service = buildService({
        accountsService: { findAccountById: async () => fakeAccount({ type: 'bank' }) },
      });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'Cuenta no encontrada o no es una tarjeta de crédito'
      );
    });

    it('lanza ValidationError si no tiene fechas de corte/pago configuradas', async () => {
      const service = buildService({
        accountsService: {
          findAccountById: async () => fakeAccount({ cutoffDay: null, paymentDueDay: null }),
        },
      });

      await expect(service.getCreditCardStatement('card-1', 'user-1')).rejects.toThrow(
        'La tarjeta no tiene configuradas las fechas de corte y pago'
      );
    });

    it('éxito: devuelve el statement calculado, consultando 1 sola tarjeta', async () => {
      const service = buildService({
        accountsService: { findAccountById: async () => fakeAccount() },
      });

      const statement = await service.getCreditCardStatement('card-1', 'user-1');

      expect(statement.account.id).toBe('card-1');
      expect(statement.creditLimit).toBe(1000);
      expect(mockedFindCardStatementTransactions).toHaveBeenCalledWith(
        'user-1',
        ['card-1'],
        expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) })
      );
    });
  });

  describe('getCreditCardsSummary', () => {
    it('sin tarjetas con fechas configuradas: devuelve el resumen vacío sin consultar transacciones', async () => {
      const service = buildService({
        accountsService: {
          getCreditCards: async () => [
            fakeAccount({ id: 'card-1', cutoffDay: null }),
            fakeAccount({ id: 'card-2', paymentDueDay: null }),
          ],
        },
      });

      const summary = await service.getCreditCardsSummary('user-1');

      expect(summary).toEqual({ totalToPay: 0, upcomingPayments: [], alerts: [], cards: [] });
      expect(mockedFindCardStatementTransactions).not.toHaveBeenCalled();
    });

    it('suma totalToPay solo de los períodos cerrados no pagados', async () => {
      mockedFindCardStatementTransactions.mockResolvedValue([
        { accountId: 'card-1', date: new Date(2026, 4, 10), amount: 200 }, // cerrado, card-1
        { accountId: 'card-2', date: new Date(2026, 4, 10), amount: 300 }, // cerrado, card-2
      ]);
      const service = buildService({
        accountsService: {
          getCreditCards: async () => [
            fakeAccount({ id: 'card-1', name: 'Visa' }),
            fakeAccount({ id: 'card-2', name: 'Mastercard' }),
          ],
        },
        creditCardPaymentRepo: {
          // card-2 ya pagó su período cerrado
          findMany: async () => [
            {
              accountId: 'card-2',
              periodStart: new Date(Date.UTC(2026, 4, 5)),
              periodEnd: new Date(Date.UTC(2026, 5, 4)),
            } as unknown as CreditCardPayment,
          ],
        },
      });

      const summary = await service.getCreditCardsSummary('user-1');

      expect(summary.totalToPay).toBe(200);
      expect(summary.cards).toHaveLength(2);
    });

    it('reparte transacciones y pagos por cuenta antes de construir cada statement', async () => {
      mockedFindCardStatementTransactions.mockResolvedValue([
        { accountId: 'card-1', date: new Date(2026, 4, 10), amount: 111 },
        { accountId: 'card-2', date: new Date(2026, 4, 10), amount: 222 },
      ]);
      const service = buildService({
        accountsService: {
          getCreditCards: async () => [
            fakeAccount({ id: 'card-1' }),
            fakeAccount({ id: 'card-2' }),
          ],
        },
      });

      const summary = await service.getCreditCardsSummary('user-1');
      const card1 = summary.cards.find((c) => c.account.id === 'card-1');
      const card2 = summary.cards.find((c) => c.account.id === 'card-2');

      expect(card1?.closedPeriod.balance).toBe(111);
      expect(card2?.closedPeriod.balance).toBe(222);
    });

    it('upcomingPayments queda ordenado por daysUntilDue ascendente', async () => {
      const service = buildService({
        accountsService: {
          getCreditCards: async () => [
            fakeAccount({ id: 'card-1', name: 'Lejano', paymentDueDay: 20 }), // due 20 jun -> 10 días
            fakeAccount({ id: 'card-2', name: 'Cercano', paymentDueDay: 12 }), // due 12 jun -> 2 días
          ],
        },
        creditCardPaymentRepo: { findMany: async () => [] },
      });
      mockedFindCardStatementTransactions.mockResolvedValue([
        { accountId: 'card-1', date: new Date(2026, 4, 10), amount: 50 },
        { accountId: 'card-2', date: new Date(2026, 4, 10), amount: 60 },
      ]);

      const summary = await service.getCreditCardsSummary('user-1');

      expect(summary.upcomingPayments.map((p) => p.accountId)).toEqual(['card-2', 'card-1']);
    });

    it('las alertas quedan ordenadas por severidad: error, warning, info', async () => {
      const service = buildService({
        accountsService: {
          getCreditCards: async () => [
            fakeAccount({ id: 'card-info', cutoffDay: 12 }), // solo genera cutoff_soon (info)
            fakeAccount({ id: 'card-error', paymentDueDay: 12 }), // payment_due_soon (error)
          ],
        },
      });

      const summary = await service.getCreditCardsSummary('user-1');
      const types = summary.alerts.map((a) => a.severity);

      expect(types.indexOf('error')).toBeLessThan(types.indexOf('info'));
    });
  });

  describe('payCreditCardStatement', () => {
    it('lanza ConflictError si el período cerrado ya está pagado', async () => {
      const account = fakeAccount();
      const previousCutoffUTC = new Date(Date.UTC(2026, 4, 5));
      const closedPeriodEndUTC = new Date(Date.UTC(2026, 5, 4));
      const service = buildService({
        accountsService: { findAccountById: async () => account },
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
        accountsService: { findAccountById: async () => fakeAccount() },
      });

      const payment = await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'card-1',
      });

      expect(payment.id).toBe('payment-1');
      expect(mockedCreateTransaction).toHaveBeenCalledTimes(1);
    });

    it('persiste periodStart/periodEnd normalizados a UTC — reproduce el bug pre-existente en timezones != UTC y confirma el fix', async () => {
      const originalTZ = process.env.TZ;
      process.env.TZ = 'America/Los_Angeles'; // UTC-7/8: si no se normaliza, esto se detecta
      try {
        mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
        mockedFindFirstFixedExpense.mockResolvedValue(null);
        const createCalls: unknown[] = [];
        const service = buildService({
          accountsService: { findAccountById: async () => fakeAccount() },
          creditCardPaymentRepo: {
            create: async (data) => {
              createCalls.push(data);
              return { id: 'payment-1' } as unknown as CreditCardPayment;
            },
          },
        });

        await service.payCreditCardStatement('card-1', 'user-1', {
          amount: 50,
          paymentAccountId: 'card-1',
        });

        const call = createCalls[0] as { periodStart: Date; periodEnd: Date };
        // Sin el fix, periodStart/periodEnd quedan en medianoche LOCAL (America/Los_Angeles),
        // que en UTC cae a media mañana del mismo día, no a medianoche UTC.
        expect(call.periodStart.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
        expect(call.periodEnd.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
      } finally {
        process.env.TZ = originalTZ;
      }
    });

    it('éxito con cuenta de pago distinta a la tarjeta: crea 2 transacciones', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue(null);
      const service = buildService({
        accountsService: { findAccountById: async () => fakeAccount() },
      });

      await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'account-bank',
      });

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
    });

    it('con gasto fijo asociado y sin pago este mes: crea una tercera transacción (usa TransactionsService.findFixedExpensePaymentInMonth)', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue({
        id: 'fe-1',
        name: 'Pago Tarjeta',
        categoryId: 'category-1',
      });
      mockedFindFixedExpensePaymentInMonth.mockResolvedValue(null);
      const service = buildService({
        accountsService: { findAccountById: async () => fakeAccount() },
      });

      await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'card-1',
      });

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
      expect(mockedFindFixedExpensePaymentInMonth).toHaveBeenCalledWith(
        'fe-1',
        expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) })
      );
    });

    it('con gasto fijo asociado y pago ya existente este mes: no crea la tercera transacción', async () => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
      mockedFindFirstFixedExpense.mockResolvedValue({
        id: 'fe-1',
        name: 'Pago Tarjeta',
        categoryId: 'category-1',
      });
      mockedFindFixedExpensePaymentInMonth.mockResolvedValue({ id: 'existing-tx' });
      const service = buildService({
        accountsService: { findAccountById: async () => fakeAccount() },
      });

      await service.payCreditCardStatement('card-1', 'user-1', {
        amount: 50,
        paymentAccountId: 'card-1',
      });

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
