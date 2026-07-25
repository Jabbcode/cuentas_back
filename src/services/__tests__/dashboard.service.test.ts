import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Category } from '@prisma/client';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import type { FixedExpenseRepository } from '../../repositories/fixed-expense.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import { DashboardServiceImpl } from '../dashboard.service.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  aggregate: vi.fn(),
  groupByCategory: vi.fn(),
  findMany: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';

const mockedAggregate = transactionRepo.aggregate as unknown as ReturnType<typeof vi.fn>;
const mockedGroupByCategory = transactionRepo.groupByCategory as unknown as ReturnType<
  typeof vi.fn
>;

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

describe('DashboardServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSummary', () => {
    it('suma el balance normal cuando no hay tarjetas de crédito', async () => {
      mockedAggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } }) // income
        .mockResolvedValueOnce({ _sum: { amount: 200 } }); // expense

      const service = new DashboardServiceImpl(
        fakeAccountRepo({
          findAllByUser: async () => [fakeAccount({ balance: 100 }), fakeAccount({ balance: 50 })],
        }),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo()
      );

      const summary = await service.getSummary('user-1');

      expect(summary.totalBalance).toBe(150);
      expect(summary.monthlyIncome).toBe(500);
      expect(summary.monthlyExpenses).toBe(200);
      expect(summary.monthlyNet).toBe(300);
    });

    it('con tarjeta de crédito: suma el crédito disponible (límite - usado) en vez del balance', async () => {
      mockedAggregate
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
        fakeCategoryRepo()
      );

      const summary = await service.getSummary('user-1');

      // available = 1000 - 300 = 700; total = 100 + 700
      expect(summary.totalBalance).toBe(800);
    });
  });

  describe('getByCategory', () => {
    it('agrupa por categoría y calcula el porcentaje', async () => {
      mockedGroupByCategory.mockResolvedValue([
        { categoryId: 'cat-1', _sum: { amount: 75 } },
        { categoryId: 'cat-2', _sum: { amount: 25 } },
      ]);
      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo({
          findMany: async () =>
            [
              { id: 'cat-1', name: 'Comida', icon: '🍔', color: '#f00', monthlyLimit: null },
              { id: 'cat-2', name: 'Ocio', icon: '🎮', color: '#0f0', monthlyLimit: null },
            ] as unknown as Category[],
        })
      );

      const result = await service.getByCategory('user-1');

      expect(result).toEqual([
        expect.objectContaining({ id: 'cat-1', total: 75, percentage: 75 }),
        expect.objectContaining({ id: 'cat-2', total: 25, percentage: 25 }),
      ]);
    });

    it('sin transacciones del período, devuelve un array vacío', async () => {
      mockedGroupByCategory.mockResolvedValue([]);

      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo(),
        fakeCategoryRepo()
      );

      await expect(service.getByCategory('user-1')).resolves.toEqual([]);
    });
  });

  describe('getFixedVsVariable', () => {
    it('combina gastos fijos configurados con transacciones variables', async () => {
      mockedAggregate.mockResolvedValue({ _sum: { amount: 40 } });

      const service = new DashboardServiceImpl(
        fakeAccountRepo(),
        fakeFixedExpenseRepo({
          findAllByUser: async () => [
            { amount: 60 } as unknown as Awaited<
              ReturnType<FixedExpenseRepository['findAllByUser']>
            >[number],
          ],
        }),
        fakeCategoryRepo()
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
