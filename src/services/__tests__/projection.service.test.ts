import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FixedExpense } from '@prisma/client';
import type {
  FixedExpensesService,
  FixedExpenseWithCategory,
  FixedExpensesSummary,
  AutoGenerateSummary,
} from '../fixed-expenses.service.port.js';
import { ProjectionServiceImpl } from '../projection.service.js';

function fakeFixedExpenseWithCategory(
  overrides: Partial<FixedExpenseWithCategory> = {}
): FixedExpenseWithCategory {
  return {
    id: 'fe-1',
    name: 'Gasto fijo',
    amount: 100,
    dueDay: 5,
    type: 'expense',
    category: { id: 'cat-1', name: 'Comida', icon: '🍔', color: '#f00' },
    ...overrides,
  } as unknown as FixedExpenseWithCategory;
}

function fakeFixedExpense(overrides: Partial<FixedExpense> = {}): FixedExpense {
  return {
    id: 'fe-1',
    name: 'Gasto fijo',
    amount: 100,
    dueDay: 5,
    type: 'expense',
    ...overrides,
  } as unknown as FixedExpense;
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

describe('ProjectionServiceImpl', () => {
  const today = new Date(2026, 6, 24); // 24 jul 2026 -> "próximo mes" = agosto 2026

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getNextMonthProjection', () => {
    it('calcula totales, agrupa por categoría y compara contra el mes actual', async () => {
      const service = new ProjectionServiceImpl(
        fakeFixedExpensesService({
          getActiveFixedExpensesWithCategory: async () => [
            fakeFixedExpenseWithCategory({ id: 'fe-1', amount: 100, type: 'expense' }),
            fakeFixedExpenseWithCategory({
              id: 'fe-2',
              amount: 50,
              type: 'expense',
              category: { id: 'cat-2', name: 'Ocio', icon: '🎮', color: '#0f0' },
            }),
            fakeFixedExpenseWithCategory({
              id: 'fe-3',
              amount: 1000,
              type: 'income',
              category: null,
            }),
          ],
          getActiveExpenseFixedExpenses: async () => [
            fakeFixedExpense({ id: 'fe-1', amount: 80, type: 'expense' }),
          ],
        })
      );

      const result = await service.getNextMonthProjection('user-1');

      expect(result.year).toBe(2026);
      expect(result.monthNumber).toBe(8);
      expect(result.totalExpenses).toBe(150);
      expect(result.totalIncome).toBe(1000);
      expect(result.netBalance).toBe(850);
      expect(result.expensesByCategory).toEqual([
        expect.objectContaining({ categoryId: 'cat-1', total: 100 }),
        expect.objectContaining({ categoryId: 'cat-2', total: 50 }),
      ]);
      expect(result.incomesByCategory).toEqual([
        expect.objectContaining({ categoryId: 'uncategorized', total: 1000 }),
      ]);
    });

    it('compara contra el resumen del mes actual (getActiveExpenseFixedExpenses)', async () => {
      const service = new ProjectionServiceImpl(
        fakeFixedExpensesService({
          getActiveFixedExpensesWithCategory: async () => [
            fakeFixedExpenseWithCategory({ amount: 150, type: 'expense' }),
          ],
          getActiveFixedExpenses: async () => [fakeFixedExpense({ amount: 100, type: 'expense' })],
        })
      );

      const result = await service.getNextMonthProjection('user-1');

      // currentMonthSummary solo usa getActiveFixedExpenses (sin categoría),
      // por eso su total (100) difiere del de next-month (150) aunque en
      // producción ambas listas provengan del mismo conjunto de gastos fijos.
      expect(result.totalExpenses).toBe(150);
      expect(result.comparison.expensesDiff).toBe(50);
      expect(result.comparison.expensesPercentage).toBe(50);
    });

    it('sin gastos fijos activos del mes actual: percentage queda en 0, sin división por cero', async () => {
      const service = new ProjectionServiceImpl(
        fakeFixedExpensesService({
          getActiveFixedExpensesWithCategory: async () => [
            fakeFixedExpenseWithCategory({ amount: 100, type: 'expense' }),
          ],
          getActiveFixedExpenses: async () => [],
        })
      );

      const result = await service.getNextMonthProjection('user-1');

      expect(result.comparison.expensesDiff).toBe(100);
      expect(result.comparison.expensesPercentage).toBe(0);
      expect(result.comparison.incomePercentage).toBe(0);
      expect(Number.isFinite(result.comparison.expensesPercentage)).toBe(true);
      expect(Number.isFinite(result.comparison.incomePercentage)).toBe(true);
    });

    it('sin gastos fijos activos en absoluto: todos los totales quedan en 0', async () => {
      const service = new ProjectionServiceImpl(fakeFixedExpensesService());

      const result = await service.getNextMonthProjection('user-1');

      expect(result.totalExpenses).toBe(0);
      expect(result.totalIncome).toBe(0);
      expect(result.netBalance).toBe(0);
      expect(result.expensesByCategory).toEqual([]);
      expect(result.incomesByCategory).toEqual([]);
      expect(result.comparison.expensesPercentage).toBe(0);
      expect(result.comparison.incomePercentage).toBe(0);
    });
  });
});
