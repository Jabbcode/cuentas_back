import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Category } from '@prisma/client';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import type { FixedExpenseRepository } from '../../repositories/fixed-expense.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import type { TransactionsService } from '../transactions.service.port.js';
import { DashboardServiceImpl } from '../dashboard.service.js';

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Cuenta Test',
    type: 'bank',
    balance: 100,
    creditLimit: null,
    userId: 'user-1',
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
      throw new Error('not implemented');
    },
    findTransfersByAccount: async () => [],
    ...overrides,
  };
}

function fakeFixedExpenseRepo(
  overrides: Partial<FixedExpenseRepository> = {}
): FixedExpenseRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not implemented');
    },
    update: async () => {
      throw new Error('not implemented');
    },
    remove: async () => {
      throw new Error('not implemented');
    },
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
      throw new Error('not implemented');
    },
    update: async () => {
      throw new Error('not implemented');
    },
    remove: async () => {
      throw new Error('not implemented');
    },
    upsertSystemCategory: async () => ({}) as Category,
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
    createTransaction: async () => {
      throw new Error('not used in these tests');
    },
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
    findCardStatementTransactions: async () => [],
    findFixedExpensePaymentInMonth: async () => null,
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

describe('DashboardServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSummary (usa TransactionsService.getMonthlyTotalByType)', () => {
    it('suma el balance normal cuando no hay tarjetas de crédito', async () => {
      const getMonthlyTotalByType = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: 500 } }) // income
        .mockResolvedValueOnce({ _sum: { amount: 200 } }); // expense

      const service = new DashboardServiceImpl(
        fakeAccountRepo({
          findAllByUser: async () => [fakeAccount({ balance: 100 }), fakeAccount({ balance: 50 })],
        }),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo(),
        fakeTransactionsService({ getMonthlyTotalByType })
      );

      const summary = await service.getSummary('user-1');

      expect(summary.totalBalance).toBe(150);
      expect(summary.monthlyIncome).toBe(500);
      expect(summary.monthlyExpenses).toBe(200);
      expect(summary.monthlyNet).toBe(300);
    });

    it('con tarjeta de crédito: suma el crédito disponible (límite - usado) en vez del balance', async () => {
      const getMonthlyTotalByType = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const service = new DashboardServiceImpl(
        fakeAccountRepo({
          findAllByUser: async () => [
            fakeAccount({ balance: 100 }),
            fakeAccount({ type: 'credit_card', balance: -300, creditLimit: 1000 }),
          ],
        }),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo(),
        fakeTransactionsService({ getMonthlyTotalByType })
      );

      const summary = await service.getSummary('user-1');

      // available = 1000 - 300 = 700; total = 100 + 700
      expect(summary.totalBalance).toBe(800);
    });
  });

  describe('getByCategory (usa TransactionsService.getCategoryBreakdown)', () => {
    it('agrupa por categoría y calcula el porcentaje', async () => {
      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo({
          findMany: async () =>
            [
              { id: 'cat-1', name: 'Comida', icon: '🍔', color: '#f00', monthlyLimit: null },
              { id: 'cat-2', name: 'Ocio', icon: '🎮', color: '#0f0', monthlyLimit: null },
            ] as unknown as Category[],
        }),
        fakeTransactionsService({
          getCategoryBreakdown: async () =>
            [
              { categoryId: 'cat-1', type: 'expense', _sum: { amount: 75 }, _count: { _all: 1 } },
              { categoryId: 'cat-2', type: 'expense', _sum: { amount: 25 }, _count: { _all: 1 } },
            ] as never,
        })
      );

      const result = await service.getByCategory('user-1');

      expect(result).toEqual([
        expect.objectContaining({ id: 'cat-1', total: 75, percentage: 75 }),
        expect.objectContaining({ id: 'cat-2', total: 25, percentage: 25 }),
      ]);
    });

    it('sin transacciones del período, devuelve un array vacío', async () => {
      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo(),
        fakeTransactionsService({ getCategoryBreakdown: async () => [] })
      );

      await expect(service.getByCategory('user-1')).resolves.toEqual([]);
    });
  });

  describe('getFixedVsVariable (usa TransactionsService.getVariableExpenseTotal)', () => {
    it('combina gastos fijos configurados con transacciones variables', async () => {
      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo({
          findAllByUser: async () => [
            { amount: 60 } as unknown as Awaited<
              ReturnType<FixedExpenseRepository['findAllByUser']>
            >[number],
          ],
        }),
        fakeCategoryRepo(),
        fakeTransactionsService({
          getVariableExpenseTotal: async () => ({ _sum: { amount: 40 } }),
        })
      );

      const result = await service.getFixedVsVariable('user-1');

      expect(result).toEqual({
        fixed: 60,
        variable: 40,
        total: 100,
        fixedPercentage: 60,
        variablePercentage: 40,
      });
    });
  });
});
