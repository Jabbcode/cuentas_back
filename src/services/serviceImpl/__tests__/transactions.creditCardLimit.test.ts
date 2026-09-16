import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../../lib/errors.js';
import { getPeriodBoundsForDate } from '../../../lib/utils/credit-card.utils.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../../schemas/transaction.schema.js';
import type { TransactionRepository } from '../../../repositories/interfaces/transaction.repository.port.js';
import type { CategoryRepository } from '../../../repositories/interfaces/category.repository.port.js';
import type { AccountsService } from '../../interfaces/accounts.service.port.js';
import { TransactionsServiceImpl } from '../transactions.service.js';

interface MockAccountRow {
  type: string;
  creditLimit: number | null;
  cutoffDay: number | null;
}

function fakeAccountRow(overrides: Partial<MockAccountRow> = {}): MockAccountRow {
  return {
    type: 'credit_card',
    creditLimit: 1000,
    cutoffDay: 5,
    ...overrides,
  };
}

function fakeHistoryEntry(creditLimit: number, effectiveFrom: string) {
  return { creditLimit, effectiveFrom: new Date(effectiveFrom) };
}

function baseCreateInput(overrides: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
  return {
    amount: 100,
    type: 'expense',
    accountId: 'account-1',
    categoryId: 'category-1',
    ...overrides,
  };
}

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

function fakePrisma(
  txOverrides: {
    accountFindFirst?: ReturnType<typeof vi.fn>;
    categoryFindFirst?: ReturnType<typeof vi.fn>;
    fixedExpenseFindFirst?: ReturnType<typeof vi.fn>;
    queryRaw?: ReturnType<typeof vi.fn>;
    transactionCreate?: ReturnType<typeof vi.fn>;
    transactionUpdate?: ReturnType<typeof vi.fn>;
    transactionDelete?: ReturnType<typeof vi.fn>;
    transactionAggregate?: ReturnType<typeof vi.fn>;
    limitHistoryFindMany?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const txFake = {
    account: {
      findFirst: txOverrides.accountFindFirst ?? vi.fn().mockResolvedValue({ id: 'account-1' }),
    },
    category: {
      findFirst: txOverrides.categoryFindFirst ?? vi.fn().mockResolvedValue({ id: 'category-1' }),
    },
    fixedExpense: {
      findFirst: txOverrides.fixedExpenseFindFirst ?? vi.fn().mockResolvedValue({ id: 'fe-1' }),
    },
    transaction: {
      create: txOverrides.transactionCreate ?? vi.fn().mockResolvedValue({ id: 'tx-1' }),
      update: txOverrides.transactionUpdate ?? vi.fn().mockResolvedValue({ id: 'tx-1' }),
      delete: txOverrides.transactionDelete ?? vi.fn().mockResolvedValue({ id: 'tx-1' }),
      aggregate:
        txOverrides.transactionAggregate ?? vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    creditLimitHistory: {
      findMany: txOverrides.limitHistoryFindMany ?? vi.fn().mockResolvedValue([]),
    },
    creditCardPayment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: txOverrides.queryRaw ?? vi.fn().mockResolvedValue([fakeAccountRow()]),
  };

  const prisma = {
    $transaction: async (cb: (tx: typeof txFake) => unknown) => cb(txFake),
  } as unknown as PrismaClient;

  return { prisma, txFake };
}

describe('TransactionsServiceImpl.createTransaction — límite de período de tarjeta de crédito', () => {
  const today = new Date(2026, 5, 10); // 10-jun-2026, cutoffDay=5 -> período actual [5-jun, 4-jul]

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gasto que supera el límite de su período lanza ConflictError con un mensaje que nombra el período', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]),
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 60 } }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ amount: 50, type: 'expense' }), 'user-1')
    ).rejects.toThrow(ConflictError);
    await expect(
      service.createTransaction(baseCreateInput({ amount: 50, type: 'expense' }), 'user-1')
    ).rejects.toThrow(/2026-06-05.*2026-07-04.*100/);

    expect(txFake.transaction.create).not.toHaveBeenCalled();
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('gasto dentro del límite del período crea la transacción usando el lock FOR UPDATE (incluye cutoffDay)', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const queryRaw = vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]);
    const { prisma, txFake } = fakePrisma({
      queryRaw,
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 20 } }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ amount: 50, type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });

    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).toHaveBeenCalledTimes(1);

    const queryStrings = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('');
    expect(queryStrings).toContain('FOR UPDATE');
    expect(queryStrings).toContain('cutoffDay');
  });

  it('la suma del período filtra solo por el rango de ESE período (mismos bounds que getPeriodBoundsForDate)', async () => {
    const transactionAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 1000 })]),
      transactionAggregate,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await service.createTransaction(baseCreateInput({ amount: 10 }), 'user-1');

    const { startDate, endDate } = getPeriodBoundsForDate(5, today);
    const nextCutoff = new Date(endDate);
    nextCutoff.setDate(nextCutoff.getDate() + 1);

    const [{ where }] = transactionAggregate.mock.calls[0];
    expect(where.accountId).toBe('account-1');
    expect(where.userId).toBe('user-1');
    expect(where.type).toBe('expense');
    expect(where.date).toEqual({ gte: startDate, lt: nextCutoff });
  });

  it('gasto aprobado aunque la tarjeta arrastre deuda atrasada grande de otros períodos (criterio 5: no valida saldo total)', async () => {
    // La deuda atrasada NO llega aquí: el aggregate mockeado ya representa solo el
    // período actual (bien poco usado), sin importar cuánto se deba en otros períodos.
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 500 })]),
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 50 } }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ amount: 100 }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });
    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('gasto con fecha de un período pasado se valida contra el límite histórico vigente en ese período, no el actual', async () => {
    // Límite actual de la cuenta: 2000. Límite vigente en el período de feb-2026: 300.
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 2000 })]),
      limitHistoryFindMany: vi.fn().mockResolvedValue([fakeHistoryEntry(300, '2026-01-01')]),
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 250 } }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    // 250 ya usado + 100 nuevo = 350 > 300 (histórico) aunque muy por debajo de 2000 (actual)
    await expect(
      service.createTransaction(
        baseCreateInput({ amount: 100, date: '2026-02-10T00:00:00.000Z' }),
        'user-1'
      )
    ).rejects.toThrow(ConflictError);
    expect(txFake.transaction.create).not.toHaveBeenCalled();
  });

  it('tarjeta sin límite configurado (ni actual ni histórico) lanza ValidationError (422)', async () => {
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: null })]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ amount: 10 }), 'user-1')
    ).rejects.toThrow(ValidationError);
  });

  it('lanza NotFoundError si la cuenta no existe', async () => {
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      fakePrisma({ accountFindFirst: vi.fn().mockResolvedValue(null) }).prisma
    );

    await expect(service.createTransaction(baseCreateInput(), 'user-1')).rejects.toThrow(
      'Cuenta no encontrada'
    );
  });

  it('lanza NotFoundError si la categoría no existe', async () => {
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      fakePrisma({ categoryFindFirst: vi.fn().mockResolvedValue(null) }).prisma
    );

    await expect(service.createTransaction(baseCreateInput(), 'user-1')).rejects.toThrow(
      'Categoría no encontrada'
    );
  });

  it('lanza NotFoundError si el gasto fijo no existe', async () => {
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      fakePrisma({ fixedExpenseFindFirst: vi.fn().mockResolvedValue(null) }).prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ fixedExpenseId: 'fe-1' }), 'user-1')
    ).rejects.toThrow('Gasto fijo no encontrado');
  });

  it('la cuenta pasa el chequeo de ownership pero desaparece antes del lock FOR UPDATE: lanza NotFoundError', async () => {
    const updateAccountBalance = vi.fn();
    const { prisma, txFake } = fakePrisma({ queryRaw: vi.fn().mockResolvedValue([]) });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await expect(service.createTransaction(baseCreateInput(), 'user-1')).rejects.toThrow(
      'Cuenta no encontrada'
    );
    expect(txFake.transaction.create).not.toHaveBeenCalled();
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('con receiptItems: los mapea al crear la transacción', async () => {
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ type: 'bank', creditLimit: null })]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await service.createTransaction(
      baseCreateInput({
        receiptItems: [{ name: 'Leche', quantity: 2, unitPrice: 1.5, totalPrice: 3 }],
      }),
      'user-1'
    );

    const [{ data }] = txFake.transaction.create.mock.calls[0];
    expect(data.receiptItems).toEqual({
      create: [{ name: 'Leche', quantity: 2, unitPrice: 1.5, totalPrice: 3 }],
    });
  });
});

describe('TransactionsServiceImpl.updateTransaction — reversión y reaplicación de balance', () => {
  const today = new Date(2026, 5, 10); // 10-jun-2026, cutoffDay=5

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeExisting(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tx-1',
      userId: 'user-1',
      accountId: 'account-1',
      amount: 50,
      type: 'expense',
      categoryId: 'category-1',
      date: today,
      ...overrides,
    };
  }

  it('revierte el balance anterior y aplica el nuevo dentro de la misma transacción', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ type: 'bank', creditLimit: null })]),
      transactionUpdate: vi
        .fn()
        .mockResolvedValue({ id: 'tx-1', accountId: 'account-1', amount: 80, type: 'expense' }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({
        findByIdAndUser: async () => fakeExisting() as never,
      }),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { amount: 80 };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).resolves.toMatchObject({
      amount: 80,
    });

    expect(txFake.transaction.update).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).toHaveBeenCalledTimes(2);
    // 1) revierte el gasto original (50, expense -> se trata como income para deshacerlo)
    expect(updateAccountBalance.mock.calls[0]).toEqual(
      expect.arrayContaining(['account-1', 'user-1', 50, 'income'])
    );
    // 2) reaplica el monto nuevo (80, expense)
    expect(updateAccountBalance.mock.calls[1]).toEqual(
      expect.arrayContaining(['account-1', 'user-1', 80, 'expense'])
    );
  });

  it('actualiza type/description/accountId/categoryId/fixedExpenseId/imageHash/date cuando se pasan', async () => {
    const transactionUpdate = vi
      .fn()
      .mockResolvedValue({ id: 'tx-1', accountId: 'account-2', amount: 50, type: 'income' });
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ type: 'bank', creditLimit: null })]),
      transactionUpdate,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = {
      type: 'income',
      description: 'Nueva descripción',
      accountId: 'account-2',
      categoryId: 'category-2',
      fixedExpenseId: 'fe-2',
      imageHash: 'hash-2',
      date: '2026-01-15',
    };

    await service.updateTransaction('tx-1', data, 'user-1');

    const [updateArgs] = transactionUpdate.mock.calls[0];
    expect(updateArgs.data).toEqual({
      type: 'income',
      description: 'Nueva descripción',
      account: { connect: { id: 'account-2' } },
      category: { connect: { id: 'category-2' } },
      fixedExpense: { connect: { id: 'fe-2' } },
      imageHash: 'hash-2',
      date: new Date('2026-01-15'),
    });
  });

  it('la cuenta resultante desaparece antes del lock FOR UPDATE: lanza NotFoundError y no persiste', async () => {
    const transactionUpdate = vi.fn();
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([]),
      transactionUpdate,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(service.updateTransaction('tx-1', { amount: 80 }, 'user-1')).rejects.toThrow(
      'Cuenta no encontrada'
    );
    expect(transactionUpdate).not.toHaveBeenCalled();
  });

  it('editar subiendo el monto por encima del límite de su período lanza ConflictError y no persiste', async () => {
    const updateTx = vi.fn();
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]),
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      transactionUpdate: updateTx,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { amount: 200 };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).rejects.toThrow(ConflictError);
    expect(updateTx).not.toHaveBeenCalled();
  });

  it('subir el monto de una tx del mismo período excluye la tx editada de la suma (sin doble conteo)', async () => {
    const transactionAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 40 } }); // uso del período SIN esta tx
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]),
      transactionAggregate,
      transactionUpdate: vi
        .fn()
        .mockResolvedValue({ id: 'tx-1', accountId: 'account-1', amount: 55, type: 'expense' }),
    });
    // existente: monto 50 del mismo período; subir a 55 -> 40 (sin la tx) + 55 = 95 <= 100
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting({ amount: 50 }) as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.updateTransaction('tx-1', { amount: 55 }, 'user-1')
    ).resolves.toMatchObject({ id: 'tx-1' });

    const [{ where }] = transactionAggregate.mock.calls[0];
    expect(where.id).toEqual({ not: 'tx-1' });
    expect(txFake.transaction.update).toHaveBeenCalledTimes(1);
  });

  it('mover la fecha a otro período valida contra el límite y el uso de ese otro período', async () => {
    const transactionAggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]),
      transactionAggregate,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await service.updateTransaction('tx-1', { date: '2026-02-10' }, 'user-1');

    const { startDate, endDate } = getPeriodBoundsForDate(5, new Date('2026-02-10'));
    const nextCutoff = new Date(endDate);
    nextCutoff.setDate(nextCutoff.getDate() + 1);
    const [{ where }] = transactionAggregate.mock.calls[0];
    expect(where.date).toEqual({ gte: startDate, lt: nextCutoff });
  });

  it('cambiar de tarjeta A a B valida el período de B, no el de A aunque A quede por encima de su límite', async () => {
    const queryRaw = vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 500 })]);
    const { prisma } = fakePrisma({
      queryRaw,
      transactionAggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({
        findByIdAndUser: async () => fakeExisting({ accountId: 'account-1' }) as never,
      }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.updateTransaction('tx-1', { accountId: 'account-2', amount: 50 }, 'user-1')
    ).resolves.toMatchObject({ id: 'tx-1' });

    // Un solo lock FOR UPDATE: el de la cuenta destino (account-2). La cuenta origen
    // (account-1) solo revierte su balance, sin volver a validar su límite.
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('cambiar gasto a ingreso no valida el límite de período', async () => {
    const transactionAggregate = vi.fn();
    const { prisma } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 10 })]),
      transactionAggregate,
      transactionUpdate: vi
        .fn()
        .mockResolvedValue({ id: 'tx-1', accountId: 'account-1', amount: 500, type: 'income' }),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.updateTransaction('tx-1', { type: 'income', amount: 500 }, 'user-1')
    ).resolves.toMatchObject({ id: 'tx-1' });
    expect(transactionAggregate).not.toHaveBeenCalled();
  });
});

describe('TransactionsServiceImpl.deleteTransaction', () => {
  it('elimina la transacción y revierte el balance', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const { prisma, txFake } = fakePrisma();
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({
        findByIdAndUser: async () =>
          ({
            id: 'tx-1',
            accountId: 'account-1',
            amount: 50,
            type: 'expense',
          }) as never,
      }),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await service.deleteTransaction('tx-1', 'user-1');

    expect(txFake.transaction.delete).toHaveBeenCalledTimes(1);
    expect(updateAccountBalance).toHaveBeenCalledWith(
      'account-1',
      'user-1',
      50,
      'income',
      expect.anything()
    );
  });
});

describe('TransactionsServiceImpl.getTransactionById', () => {
  it('lanza NotFoundError si la transacción no existe', async () => {
    const { prisma } = fakePrisma();
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => null }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(service.getTransactionById('tx-1', 'user-1')).rejects.toThrow(NotFoundError);
    await expect(service.getTransactionById('tx-1', 'user-1')).rejects.toThrow(
      'Transacción no encontrada'
    );
  });
});
