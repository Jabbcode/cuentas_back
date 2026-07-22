import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    fixedExpense: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  },
}));

vi.mock('../transactions.service.js', () => ({
  createTransaction: vi.fn(),
}));

import { prisma } from '../../lib/prisma.js';
import { createTransaction } from '../transactions.service.js';
import { autoGenerateFixedExpenseTransactions } from '../fixed-expenses.service.js';
import { ConflictError } from '../../lib/errors.js';

const findManyFixedExpense = prisma.fixedExpense.findMany as unknown as ReturnType<typeof vi.fn>;
const findManyTransaction = prisma.transaction.findMany as unknown as ReturnType<typeof vi.fn>;
const mockedCreateTransaction = createTransaction as unknown as ReturnType<typeof vi.fn>;

function fakeFixedExpense(id: string, userId = 'user-1') {
  return {
    id,
    userId,
    name: `FE ${id}`,
    amount: 10,
    type: 'expense',
    accountId: 'account-1',
    categoryId: 'category-1',
  };
}

describe('autoGenerateFixedExpenseTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyTransaction.mockResolvedValue([]);
    mockedCreateTransaction.mockResolvedValue({});
  });

  it('día normal: el where enviado a findMany usa dueDay exacto', async () => {
    findManyFixedExpense.mockResolvedValue([]);

    await autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10)); // 10 jun 2026 (mes de 30 días)

    expect(findManyFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dueDay: 10 }) })
    );
  });

  it('último día de un mes de 30 días: el where usa dueDay >= 30', async () => {
    findManyFixedExpense.mockResolvedValue([]);

    await autoGenerateFixedExpenseTransactions(new Date(2026, 5, 30)); // 30 jun 2026

    expect(findManyFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dueDay: { gte: 30 } }) })
    );
  });

  it('gasto fijo ya generado este mes: no se llama createTransaction para ese id', async () => {
    findManyFixedExpense.mockResolvedValue([fakeFixedExpense('fe-1')]);
    findManyTransaction.mockResolvedValue([{ fixedExpenseId: 'fe-1' }]);

    const result = await autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

    expect(mockedCreateTransaction).not.toHaveBeenCalled();
    expect(result).toEqual({ createdByUser: {}, failedByUser: {} });
  });

  it('createTransaction lanza un error genérico para el primer gasto: el segundo se procesa igual y no se reporta como fallo', async () => {
    findManyFixedExpense.mockResolvedValue([fakeFixedExpense('fe-1'), fakeFixedExpense('fe-2')]);
    mockedCreateTransaction.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});

    const result = await autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

    expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
    expect(result.createdByUser).toEqual({ 'user-1': 1 });
    // Un Error genérico (no tipado) solo se loguea, no se reporta al usuario.
    expect(result.failedByUser).toEqual({});
  });

  it('createTransaction lanza ConflictError (límite de tarjeta): se reporta en failedByUser', async () => {
    findManyFixedExpense.mockResolvedValue([fakeFixedExpense('fe-1')]);
    mockedCreateTransaction.mockRejectedValueOnce(
      new ConflictError('Se superó el límite disponible de la tarjeta')
    );

    const result = await autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

    expect(result.createdByUser).toEqual({});
    expect(result.failedByUser).toEqual({
      'user-1': [
        { fixedExpenseName: 'FE fe-1', message: 'Se superó el límite disponible de la tarjeta' },
      ],
    });
  });
});
