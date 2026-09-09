import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../lib/errors.js';
import type { TransactionRepository } from '../../../repositories/interfaces/transaction.repository.port.js';
import type { CategoryRepository } from '../../../repositories/interfaces/category.repository.port.js';
import type { AccountsService } from '../../interfaces/accounts.service.port.js';
import { TransactionsServiceImpl } from '../transactions.service.js';

function fakeTransactionRepo(
  overrides: Partial<TransactionRepository> = {}
): TransactionRepository {
  return {
    findMany: async () => [],
    count: async () => 0,
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    updateMany: async () => ({ count: 0 }),
    groupByCategory: async () => [],
    groupExpensesByCategory: async () => [],
    groupTotalsByUser: async () => [],
    groupExpensesByUserAndCategory: async () => [],
    aggregate: async () => ({ _sum: { amount: null } }),
    findReceiptItems: async () => [],
    countByUser: async () => 0,
    findFirstByUser: async () => null,
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

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => {
      throw new Error('not used in these tests');
    },
    createAccount: async () => {
      throw new Error('not used in these tests');
    },
    updateAccount: async () => {
      throw new Error('not used in these tests');
    },
    deleteAccount: async () => {
      throw new Error('not used in these tests');
    },
    transferFunds: async () => {
      throw new Error('not used in these tests');
    },
    getTransfersByAccount: async () => [],
    updateAccountBalance: async () => undefined,
    ...overrides,
  };
}

function buildService(
  overrides: {
    transactionRepo?: Partial<TransactionRepository>;
    categoryRepo?: Partial<CategoryRepository>;
    accountsService?: Partial<AccountsService>;
  } = {}
) {
  return new TransactionsServiceImpl(
    fakeTransactionRepo(overrides.transactionRepo),
    fakeAccountsService(overrides.accountsService),
    fakeCategoryRepo(overrides.categoryRepo),
    {} as PrismaClient
  );
}

describe('TransactionsServiceImpl.getTransactions', () => {
  it('siempre filtra por userId y aplica limit/offset por defecto', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = buildService({ transactionRepo: { findMany, count: async () => 0 } });

    await service.getTransactions('user-1', {});

    const [where, options] = findMany.mock.calls[0];
    expect(where).toEqual({ userId: 'user-1' });
    expect(options).toMatchObject({ take: 50, skip: 0 });
  });

  it('categoryIds tiene prioridad sobre categoryId cuando ambos están presentes', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = buildService({ transactionRepo: { findMany } });

    await service.getTransactions('user-1', {
      categoryId: 'cat-solo',
      categoryIds: ['cat-a', 'cat-b'],
    });

    const [where] = findMany.mock.calls[0];
    expect(where.categoryId).toEqual({ in: ['cat-a', 'cat-b'] });
  });

  it('usa categoryId cuando categoryIds no viene', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = buildService({ transactionRepo: { findMany } });

    await service.getTransactions('user-1', { categoryId: 'cat-solo' });

    const [where] = findMany.mock.calls[0];
    expect(where.categoryId).toBe('cat-solo');
  });

  it('construye el rango de fecha y de monto correctamente', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = buildService({ transactionRepo: { findMany } });

    await service.getTransactions('user-1', {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      minAmount: 10,
      maxAmount: 100,
      type: 'expense',
      accountId: 'account-1',
    });

    const [where] = findMany.mock.calls[0];
    expect(where.date).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
    expect(where.amount).toEqual({ gte: 10, lte: 100 });
    expect(where.type).toBe('expense');
    expect(where.accountId).toBe('account-1');
  });

  it('devuelve total, limit y offset junto a las transacciones', async () => {
    const service = buildService({
      transactionRepo: {
        findMany: async () => [{ id: 'tx-1' }] as never,
        count: async () => 7,
      },
    });

    await expect(service.getTransactions('user-1', { limit: 10, offset: 5 })).resolves.toEqual({
      transactions: [{ id: 'tx-1' }],
      total: 7,
      limit: 10,
      offset: 5,
    });
  });
});

describe('TransactionsServiceImpl.getTransactionSummary', () => {
  it('construye el where con fecha, accountId y type cuando se pasan', async () => {
    const groupByCategory = vi.fn().mockResolvedValue([]);
    const service = buildService({ transactionRepo: { groupByCategory } });

    await service.getTransactionSummary('user-1', {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      accountId: 'account-1',
      type: 'expense',
    });

    expect(groupByCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
      accountId: 'account-1',
      type: 'expense',
    });
  });

  it('agrupa por categoría, separa income/expense y calcula netTotal', async () => {
    const service = buildService({
      transactionRepo: {
        groupByCategory: async () =>
          [
            { categoryId: 'cat-1', type: 'expense', _sum: { amount: 100 }, _count: { _all: 2 } },
            { categoryId: 'cat-1', type: 'income', _sum: { amount: 30 }, _count: { _all: 1 } },
          ] as never,
      },
      categoryRepo: {
        findMany: async () => [{ id: 'cat-1', name: 'Comida', icon: null, color: null }] as never,
      },
    });

    const result = await service.getTransactionSummary('user-1', {});

    expect(result).toEqual([
      {
        category: { id: 'cat-1', name: 'Comida', icon: null, color: null },
        expenseTotal: 100,
        incomeTotal: 30,
        count: 3,
        netTotal: -70,
      },
    ]);
  });

  it('ordena las categorías por expenseTotal descendente', async () => {
    const service = buildService({
      transactionRepo: {
        groupByCategory: async () =>
          [
            { categoryId: 'cat-low', type: 'expense', _sum: { amount: 10 }, _count: { _all: 1 } },
            { categoryId: 'cat-high', type: 'expense', _sum: { amount: 500 }, _count: { _all: 1 } },
          ] as never,
      },
      categoryRepo: {
        findMany: async () =>
          [
            { id: 'cat-low', name: 'Baja', icon: null, color: null },
            { id: 'cat-high', name: 'Alta', icon: null, color: null },
          ] as never,
      },
    });

    const result = await service.getTransactionSummary('user-1', {});

    expect(result.map((r) => r.category.id)).toEqual(['cat-high', 'cat-low']);
  });

  it('devuelve [] sin consultar categorías cuando no hay filas', async () => {
    const findManyCategories = vi.fn().mockResolvedValue([]);
    const service = buildService({
      transactionRepo: { groupByCategory: async () => [] },
      categoryRepo: { findMany: findManyCategories },
    });

    await expect(service.getTransactionSummary('user-1', {})).resolves.toEqual([]);
    expect(findManyCategories).not.toHaveBeenCalled();
  });

  it('ignora filas sin categoryId', async () => {
    const service = buildService({
      transactionRepo: {
        groupByCategory: async () =>
          [
            { categoryId: null, type: 'expense', _sum: { amount: 100 }, _count: { _all: 1 } },
          ] as never,
      },
    });

    await expect(service.getTransactionSummary('user-1', {})).resolves.toEqual([]);
  });
});

describe('TransactionsServiceImpl.getReceiptItems', () => {
  it('lanza NotFoundError si la transacción no existe o no pertenece al usuario', async () => {
    const service = buildService({
      transactionRepo: { findByIdAndUser: async () => null },
    });

    await expect(service.getReceiptItems('tx-1', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('devuelve los items del recibo cuando la transacción existe', async () => {
    const service = buildService({
      transactionRepo: {
        findByIdAndUser: async () => ({ id: 'tx-1' }) as never,
        findReceiptItems: async () => [{ id: 'item-1' }] as never,
      },
    });

    await expect(service.getReceiptItems('tx-1', 'user-1')).resolves.toEqual([{ id: 'item-1' }]);
  });
});

describe('TransactionsServiceImpl — consultas de negocio filtran siempre por userId', () => {
  const range = { gte: new Date('2026-01-01'), lt: new Date('2026-02-01') };

  it('countByCategory filtra por categoryId', async () => {
    const count = vi.fn().mockResolvedValue(3);
    await buildService({ transactionRepo: { count } }).countByCategory('cat-1');
    expect(count).toHaveBeenCalledWith({ categoryId: 'cat-1' });
  });

  it('findMonthlyCategoryExpenses filtra por userId, categoryId, tipo y rango', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await buildService({ transactionRepo: { findMany } }).findMonthlyCategoryExpenses(
      'user-1',
      'cat-1',
      range
    );
    expect(findMany).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      userId: 'user-1',
      type: 'expense',
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('findCardStatementTransactions filtra por userId y las cuentas dadas', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const rangeGteLte = { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') };
    await buildService({ transactionRepo: { findMany } }).findCardStatementTransactions(
      'user-1',
      ['acc-1', 'acc-2'],
      rangeGteLte
    );
    const [where] = findMany.mock.calls[0];
    expect(where).toMatchObject({
      accountId: { in: ['acc-1', 'acc-2'] },
      userId: 'user-1',
      type: 'expense',
    });
  });

  it('resyncTransactionsForFixedExpense filtra por userId y fixedExpenseId', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    await buildService({ transactionRepo: { updateMany } }).resyncTransactionsForFixedExpense(
      'user-1',
      'fe-1',
      { description: 'x' }
    );
    expect(updateMany).toHaveBeenCalledWith(
      { fixedExpenseId: 'fe-1', userId: 'user-1' },
      { description: 'x' }
    );
  });

  it('getMonthlyTotalByType filtra por userId, tipo y rango', async () => {
    const aggregate = vi.fn().mockResolvedValue({ _sum: { amount: null } });
    await buildService({ transactionRepo: { aggregate } }).getMonthlyTotalByType(
      'user-1',
      'income',
      range
    );
    expect(aggregate).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'income',
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('getVariableExpenseTotal excluye transacciones ligadas a un gasto fijo', async () => {
    const aggregate = vi.fn().mockResolvedValue({ _sum: { amount: null } });
    await buildService({ transactionRepo: { aggregate } }).getVariableExpenseTotal('user-1', range);
    expect(aggregate).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'expense',
      fixedExpenseId: null,
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('getCategoryBreakdown omite el filtro de tipo cuando no se pasa', async () => {
    const groupByCategory = vi.fn().mockResolvedValue([]);
    await buildService({ transactionRepo: { groupByCategory } }).getCategoryBreakdown(
      'user-1',
      range
    );
    expect(groupByCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('getCategoryBreakdown incluye el tipo cuando se pasa', async () => {
    const groupByCategory = vi.fn().mockResolvedValue([]);
    await buildService({ transactionRepo: { groupByCategory } }).getCategoryBreakdown(
      'user-1',
      range,
      'income'
    );
    expect(groupByCategory).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'income',
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('findTransactionsSince filtra por userId y fecha', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const since = new Date('2026-01-01');
    await buildService({ transactionRepo: { findMany } }).findTransactionsSince('user-1', since);
    expect(findMany).toHaveBeenCalledWith({ userId: 'user-1', date: { gte: since } });
  });

  it('getTopExpenseCategories pasa el take al repositorio', async () => {
    const groupExpensesByCategory = vi.fn().mockResolvedValue([]);
    await buildService({ transactionRepo: { groupExpensesByCategory } }).getTopExpenseCategories(
      'user-1',
      range,
      5
    );
    expect(groupExpensesByCategory).toHaveBeenCalledWith(
      { userId: 'user-1', type: 'expense', date: { gte: range.gte, lt: range.lt } },
      5
    );
  });

  it('getUserTotalsByType filtra por la lista de userIds', async () => {
    const groupTotalsByUser = vi.fn().mockResolvedValue([]);
    await buildService({ transactionRepo: { groupTotalsByUser } }).getUserTotalsByType(
      ['user-1', 'user-2'],
      range
    );
    expect(groupTotalsByUser).toHaveBeenCalledWith({
      userId: { in: ['user-1', 'user-2'] },
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('getExpensesByUserAndCategory filtra por userIds y tipo expense', async () => {
    const groupExpensesByUserAndCategory = vi.fn().mockResolvedValue([]);
    await buildService({
      transactionRepo: { groupExpensesByUserAndCategory },
    }).getExpensesByUserAndCategory(['user-1'], range);
    expect(groupExpensesByUserAndCategory).toHaveBeenCalledWith({
      userId: { in: ['user-1'] },
      type: 'expense',
      date: { gte: range.gte, lt: range.lt },
    });
  });

  it('countByUser delega en el repositorio', async () => {
    const countByUser = vi.fn().mockResolvedValue(4);
    await expect(
      buildService({ transactionRepo: { countByUser } }).countByUser('user-1')
    ).resolves.toBe(4);
    expect(countByUser).toHaveBeenCalledWith('user-1');
  });

  it('getFirstTransactionDate ordena ascendente por fecha', async () => {
    const findFirstByUser = vi.fn().mockResolvedValue({ date: new Date('2026-01-01') });
    await buildService({ transactionRepo: { findFirstByUser } }).getFirstTransactionDate('user-1');
    expect(findFirstByUser).toHaveBeenCalledWith('user-1', { date: 'asc' });
  });

  it('findByImageHash filtra por userId e imageHash', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await buildService({ transactionRepo: { findFirst } }).findByImageHash('user-1', 'hash-1');
    expect(findFirst).toHaveBeenCalledWith(
      { userId: 'user-1', imageHash: 'hash-1' },
      expect.anything()
    );
  });

  it('findSimilarByAmountAndDate filtra por userId y las ventanas de monto/fecha', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const window = {
      amountGte: 90,
      amountLte: 110,
      dateGte: new Date('2026-01-01'),
      dateLte: new Date('2026-01-02'),
    };
    await buildService({ transactionRepo: { findMany } }).findSimilarByAmountAndDate(
      'user-1',
      window
    );
    const [where] = findMany.mock.calls[0];
    expect(where).toEqual({
      userId: 'user-1',
      amount: { gte: 90, lte: 110 },
      date: { gte: window.dateGte, lte: window.dateLte },
    });
  });

  it('findFixedExpensePaymentInMonth filtra por fixedExpenseId y rango, sin userId (histórico)', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await buildService({ transactionRepo: { findFirst } }).findFixedExpensePaymentInMonth(
      'fe-1',
      range
    );
    expect(findFirst).toHaveBeenCalledWith({
      fixedExpenseId: 'fe-1',
      date: { gte: range.gte, lt: range.lt },
    });
  });
});
