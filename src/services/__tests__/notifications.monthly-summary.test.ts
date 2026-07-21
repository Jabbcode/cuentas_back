import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/transaction.repository.js', () => ({
  aggregate: vi.fn(),
  groupExpensesByCategory: vi.fn(),
}));

vi.mock('../../repositories/category.repository.js', () => ({
  findMany: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';
import * as categoryRepo from '../../repositories/category.repository.js';
import { buildMonthlySummary } from '../notifications.service.js';

const mockedAggregate = transactionRepo.aggregate as unknown as ReturnType<typeof vi.fn>;
const mockedGroupExpensesByCategory =
  transactionRepo.groupExpensesByCategory as unknown as ReturnType<typeof vi.fn>;
const mockedFindMany = categoryRepo.findMany as unknown as ReturnType<typeof vi.fn>;

const range = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

describe('buildMonthlySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con transacciones: totales y desglose por categoría se calculan correctamente', async () => {
    mockedAggregate
      .mockResolvedValueOnce({ _sum: { amount: 150 } }) // expense
      .mockResolvedValueOnce({ _sum: { amount: 1000 } }); // income
    mockedGroupExpensesByCategory.mockResolvedValueOnce([
      { categoryId: 'cat-1', _sum: { amount: 100 } },
      { categoryId: 'cat-2', _sum: { amount: 50 } },
    ]);
    mockedFindMany.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Comida', icon: '🍔' },
      { id: 'cat-2', name: 'Transporte', icon: '🚗' },
    ]);

    const result = await buildMonthlySummary('user-1', range);

    expect(result.totalExpenses).toBe(150);
    expect(result.totalIncome).toBe(1000);
    expect(result.categoryBreakdown).toEqual([
      { name: 'Comida', icon: '🍔', spent: 100 },
      { name: 'Transporte', icon: '🚗', spent: 50 },
    ]);
  });

  it('categoría sin match en el mapa: usa "Sin categoría" e icon undefined', async () => {
    mockedAggregate
      .mockResolvedValueOnce({ _sum: { amount: 100 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });
    mockedGroupExpensesByCategory.mockResolvedValueOnce([
      { categoryId: 'cat-borrada', _sum: { amount: 100 } },
    ]);
    mockedFindMany.mockResolvedValueOnce([]);

    const result = await buildMonthlySummary('user-1', range);

    expect(result.categoryBreakdown).toEqual([
      { name: 'Sin categoría', icon: undefined, spent: 100 },
    ]);
  });

  it('sin transacciones: totales en 0 y breakdown vacío', async () => {
    mockedAggregate
      .mockResolvedValueOnce({ _sum: { amount: null } })
      .mockResolvedValueOnce({ _sum: { amount: null } });
    mockedGroupExpensesByCategory.mockResolvedValueOnce([]);
    mockedFindMany.mockResolvedValueOnce([]);

    const result = await buildMonthlySummary('user-1', range);

    expect(result.totalExpenses).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.categoryBreakdown).toEqual([]);
  });

  it('envía el where esperado ({ userId, type, date }) a aggregate y groupExpensesByCategory', async () => {
    mockedAggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockedGroupExpensesByCategory.mockResolvedValueOnce([]);
    mockedFindMany.mockResolvedValueOnce([]);

    await buildMonthlySummary('user-1', range);

    const expectedDate = { gte: range.start, lt: range.end };
    expect(mockedAggregate).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      type: 'expense',
      date: expectedDate,
    });
    expect(mockedAggregate).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      type: 'income',
      date: expectedDate,
    });
    expect(mockedGroupExpensesByCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'expense',
      date: expectedDate,
    });
  });
});
