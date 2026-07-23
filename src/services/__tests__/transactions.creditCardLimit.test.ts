import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../schemas/transaction.schema.js';
import type { TransactionRepository } from '../../repositories/transaction.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import type { AccountsService } from '../accounts.service.port.js';
import { TransactionsServiceImpl } from '../transactions.service.js';

interface MockAccountRow {
  type: string;
  creditLimit: number | null;
  balance: number;
  initialBalance: number;
}

function fakeAccountRow(overrides: Partial<MockAccountRow> = {}): MockAccountRow {
  return {
    type: 'credit_card',
    creditLimit: 1000,
    balance: 0,
    initialBalance: 0,
    ...overrides,
  };
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
    },
    $queryRaw: txOverrides.queryRaw ?? vi.fn().mockResolvedValue([fakeAccountRow()]),
  };

  const prisma = {
    $transaction: async (cb: (tx: typeof txFake) => unknown) => cb(txFake),
  } as unknown as PrismaClient;

  return { prisma, txFake };
}

describe('TransactionsServiceImpl.createTransaction — límite de tarjeta de crédito', () => {
  it('gasto que excede el límite lanza ConflictError y no crea la transacción ni cambia el saldo', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ amount: 150, type: 'expense' }), 'user-1')
    ).rejects.toThrow(ConflictError);

    expect(txFake.transaction.create).not.toHaveBeenCalled();
    expect(updateAccountBalance).not.toHaveBeenCalled();
  });

  it('gasto dentro del límite crea la transacción usando el lock FOR UPDATE', async () => {
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const queryRaw = vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100 })]);
    const { prisma, txFake } = fakePrisma({ queryRaw });
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

    // La lectura de saldo para validar el límite debe tomar el lock de fila (FOR UPDATE):
    // un SELECT plano permitiría que dos requests concurrentes lean el mismo saldo,
    // pasen ambas la validación y dejen el uso por encima del límite.
    const queryStrings = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('');
    expect(queryStrings).toContain('FOR UPDATE');
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
});

describe('TransactionsServiceImpl.updateTransaction — reversión y reaplicación de balance', () => {
  function fakeExisting(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tx-1',
      userId: 'user-1',
      accountId: 'account-1',
      amount: 50,
      type: 'expense',
      categoryId: 'category-1',
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

  it('editar subiendo el monto por encima del límite lanza ConflictError y no persiste', async () => {
    const updateTx = vi.fn();
    const { prisma } = fakePrisma({
      // el servicio ya revirtió el gasto original (50) antes de leer la cuenta -> balance 0
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ creditLimit: 100, balance: 0 })]),
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
