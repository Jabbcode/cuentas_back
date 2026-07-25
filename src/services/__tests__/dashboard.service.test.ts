import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Category, FixedExpense } from '@prisma/client';
import type { AccountsService } from '../accounts.service.port.js';
import type {
  FixedExpensesService,
  FixedExpensesSummary,
  AutoGenerateSummary,
} from '../fixed-expenses.service.port.js';
import type { CategoriesService, CategorySpending } from '../categories.service.port.js';
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
  } as AccountsService;
}

function fakeFixedExpensesService(
  overrides: Partial<FixedExpensesService> = {}
): FixedExpensesService {
  return {
    getFixedExpenses: async () => [],
    getFixedExpenseById: async () => {
      throw new Error('not used in these tests');
    },
    createFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    updateFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    deleteFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    payFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    getFixedExpensesSummary: async () => ({}) as FixedExpensesSummary,
    reorderFixedExpenses: async () => ({ success: true }),
    autoGenerateFixedExpenseTransactions: async () => ({}) as AutoGenerateSummary,
    getActiveFixedExpenses: async () => [],
    getActiveFixedExpensesWithCategory: async () => [],
    getActiveExpenseFixedExpenses: async () => [],
    countByUser: async () => 0,
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
    getOrCreateSystemCategory: async () => ({}) as Category,
    countByUser: async () => 0,
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
        fakeAccountsService({
          getAccounts: async () => [fakeAccount({ balance: 100 }), fakeAccount({ balance: 50 })],
        }),
        fakeFixedExpensesService(),
        fakeCategoriesService(),
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
        fakeAccountsService({
          getAccounts: async () => [
            fakeAccount({ balance: 100 }),
            fakeAccount({ type: 'credit_card', balance: -300, creditLimit: 1000 }),
          ],
        }),
        fakeFixedExpensesService(),
        fakeCategoriesService(),
        fakeTransactionsService({ getMonthlyTotalByType })
      );

      const summary = await service.getSummary('user-1');

      // available = 1000 - 300 = 700; total = 100 + 700
      expect(summary.totalBalance).toBe(800);
    });
  });

  describe('getByCategory (usa TransactionsService.getCategoryBreakdown + CategoriesService.hydrateCategoriesByIds)', () => {
    it('agrupa por categoría y calcula el porcentaje', async () => {
      const service = new DashboardServiceImpl(
        fakeAccountsService(),
        fakeFixedExpensesService(),
        fakeCategoriesService({
          hydrateCategoriesByIds: async () =>
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
        fakeAccountsService(),
        fakeFixedExpensesService(),
        fakeCategoriesService(),
        fakeTransactionsService({ getCategoryBreakdown: async () => [] })
      );

      await expect(service.getByCategory('user-1')).resolves.toEqual([]);
    });
  });

  describe('getFixedVsVariable (usa TransactionsService.getVariableExpenseTotal + FixedExpensesService.getActiveExpenseFixedExpenses)', () => {
    it('combina gastos fijos configurados con transacciones variables', async () => {
      const service = new DashboardServiceImpl(
        fakeAccountsService(),
        fakeFixedExpensesService({
          getActiveExpenseFixedExpenses: async () => [{ amount: 60 } as unknown as FixedExpense],
        }),
        fakeCategoriesService(),
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
