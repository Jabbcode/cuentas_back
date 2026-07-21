import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/transaction.repository.js', () => ({
  aggregate: vi.fn(),
  groupExpensesByCategory: vi.fn(),
  groupTotalsByUser: vi.fn(),
  groupExpensesByUserAndCategory: vi.fn(),
}));

vi.mock('../../repositories/category.repository.js', () => ({
  findMany: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';
import * as categoryRepo from '../../repositories/category.repository.js';
import { buildMonthlySummary, buildMonthlySummariesBatch } from '../notifications.service.js';

const mockedAggregate = transactionRepo.aggregate as unknown as ReturnType<typeof vi.fn>;
const mockedGroupExpensesByCategory =
  transactionRepo.groupExpensesByCategory as unknown as ReturnType<typeof vi.fn>;
const mockedFindMany = categoryRepo.findMany as unknown as ReturnType<typeof vi.fn>;
const mockedGroupTotalsByUser = transactionRepo.groupTotalsByUser as unknown as ReturnType<
  typeof vi.fn
>;
const mockedGroupExpensesByUserAndCategory =
  transactionRepo.groupExpensesByUserAndCategory as unknown as ReturnType<typeof vi.fn>;

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

describe('buildMonthlySummariesBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batch básico: totales y desglose por categoría correctos para 2 usuarios', async () => {
    mockedGroupTotalsByUser.mockResolvedValueOnce([
      { userId: 'user-1', type: 'expense', _sum: { amount: 150 } },
      { userId: 'user-1', type: 'income', _sum: { amount: 1000 } },
      { userId: 'user-2', type: 'expense', _sum: { amount: 80 } },
      { userId: 'user-2', type: 'income', _sum: { amount: 500 } },
    ]);
    mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
      { userId: 'user-1', categoryId: 'cat-1', _sum: { amount: 100 } },
      { userId: 'user-1', categoryId: 'cat-2', _sum: { amount: 50 } },
      { userId: 'user-2', categoryId: 'cat-1', _sum: { amount: 80 } },
    ]);
    mockedFindMany.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Comida', icon: '🍔' },
      { id: 'cat-2', name: 'Transporte', icon: '🚗' },
    ]);

    const result = await buildMonthlySummariesBatch(['user-1', 'user-2'], range);

    expect(result.get('user-1')).toEqual({
      totalExpenses: 150,
      totalIncome: 1000,
      categoryBreakdown: [
        { name: 'Comida', icon: '🍔', spent: 100 },
        { name: 'Transporte', icon: '🚗', spent: 50 },
      ],
    });
    expect(result.get('user-2')).toEqual({
      totalExpenses: 80,
      totalIncome: 500,
      categoryBreakdown: [{ name: 'Comida', icon: '🍔', spent: 80 }],
    });
  });

  it('usuario sin transacciones: entrada pre-seeded con totales 0 y breakdown vacío', async () => {
    mockedGroupTotalsByUser.mockResolvedValueOnce([
      { userId: 'user-1', type: 'expense', _sum: { amount: 50 } },
    ]);
    mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([]);
    mockedFindMany.mockResolvedValueOnce([]);

    const result = await buildMonthlySummariesBatch(['user-1', 'user-sin-tx'], range);

    expect(result.get('user-sin-tx')).toEqual({
      totalExpenses: 0,
      totalIncome: 0,
      categoryBreakdown: [],
    });
  });

  it('categoría sin match en el mapa: usa "Sin categoría" e icon undefined', async () => {
    mockedGroupTotalsByUser.mockResolvedValueOnce([]);
    mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
      { userId: 'user-1', categoryId: 'cat-borrada', _sum: { amount: 30 } },
    ]);
    mockedFindMany.mockResolvedValueOnce([]);

    const result = await buildMonthlySummariesBatch(['user-1'], range);

    expect(result.get('user-1')?.categoryBreakdown).toEqual([
      { name: 'Sin categoría', icon: undefined, spent: 30 },
    ]);
  });

  it('top-10 por usuario: 12 categorías se recortan a 10, otro usuario con 3 conserva las 3', async () => {
    const manyCategories = Array.from({ length: 12 }, (_, i) => ({
      userId: 'user-1',
      categoryId: `cat-${i}`,
      _sum: { amount: 100 - i },
    }));
    const fewCategories = [0, 1, 2].map((i) => ({
      userId: 'user-2',
      categoryId: `cat-${i}`,
      _sum: { amount: 10 - i },
    }));

    mockedGroupTotalsByUser.mockResolvedValueOnce([]);
    mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
      ...manyCategories,
      ...fewCategories,
    ]);
    mockedFindMany.mockResolvedValueOnce([]);

    const result = await buildMonthlySummariesBatch(['user-1', 'user-2'], range);

    expect(result.get('user-1')?.categoryBreakdown).toHaveLength(10);
    expect(result.get('user-1')?.categoryBreakdown.map((c) => c.spent)).toEqual(
      manyCategories.slice(0, 10).map((c) => c._sum.amount)
    );
    expect(result.get('user-2')?.categoryBreakdown).toHaveLength(3);
  });

  it('userIds vacío: devuelve Map vacío y no llama a los repos', async () => {
    const result = await buildMonthlySummariesBatch([], range);

    expect(result.size).toBe(0);
    expect(mockedGroupTotalsByUser).not.toHaveBeenCalled();
    expect(mockedGroupExpensesByUserAndCategory).not.toHaveBeenCalled();
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('envía el where esperado a groupTotalsByUser y groupExpensesByUserAndCategory', async () => {
    mockedGroupTotalsByUser.mockResolvedValueOnce([]);
    mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([]);
    mockedFindMany.mockResolvedValueOnce([]);

    await buildMonthlySummariesBatch(['user-1', 'user-2'], range);

    const expectedDate = { gte: range.start, lt: range.end };
    expect(mockedGroupTotalsByUser).toHaveBeenCalledWith({
      userId: { in: ['user-1', 'user-2'] },
      date: expectedDate,
    });
    expect(mockedGroupExpensesByUserAndCategory).toHaveBeenCalledWith({
      userId: { in: ['user-1', 'user-2'] },
      date: expectedDate,
      type: 'expense',
    });
  });
});
