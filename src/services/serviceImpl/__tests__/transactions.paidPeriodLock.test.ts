import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ConflictError } from '../../../lib/errors.js';
import { normalizeToUTC } from '../../../lib/utils/credit-card.utils.js';
import { createTransactionSchema } from '../../../schemas/transaction.schema.js';
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
    queryRaw?: ReturnType<typeof vi.fn>;
    transactionCreate?: ReturnType<typeof vi.fn>;
    transactionUpdate?: ReturnType<typeof vi.fn>;
    transactionDelete?: ReturnType<typeof vi.fn>;
    transactionAggregate?: ReturnType<typeof vi.fn>;
    limitHistoryFindMany?: ReturnType<typeof vi.fn>;
    creditCardPaymentFindMany?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const txFake = {
    account: {
      findFirst: txOverrides.accountFindFirst ?? vi.fn().mockResolvedValue({ id: 'account-1' }),
    },
    category: {
      findFirst: txOverrides.categoryFindFirst ?? vi.fn().mockResolvedValue({ id: 'category-1' }),
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
      findMany: txOverrides.creditCardPaymentFindMany ?? vi.fn().mockResolvedValue([]),
    },
    $queryRaw: txOverrides.queryRaw ?? vi.fn().mockResolvedValue([fakeAccountRow()]),
  };

  const prisma = {
    $transaction: async (cb: (tx: typeof txFake) => unknown) => cb(txFake),
  } as unknown as PrismaClient;

  return { prisma, txFake };
}

// today=10-jun-2026, cutoffDay=5 -> período que contiene "hoy": [5-jun-2026, 4-jul-2026]
const PAID_PERIOD_START = new Date(2026, 5, 5);
const PAID_PERIOD_END = new Date(2026, 6, 4);
const PAID_PAYMENT_DATE = new Date(2026, 5, 20);

function fakePaymentForCurrentPeriod(overrides: Partial<{ accountId: string }> = {}) {
  return {
    ...overrides,
    periodStart: normalizeToUTC(PAID_PERIOD_START),
    periodEnd: normalizeToUTC(PAID_PERIOD_END),
    paymentDate: PAID_PAYMENT_DATE,
  };
}

describe('TransactionsServiceImpl — período de tarjeta ya pagado (createTransaction)', () => {
  const today = new Date(2026, 5, 10);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) gasto con fecha en un período pagado: ConflictError, no crea la transacción', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ type: 'expense' }), 'user-1')
    ).rejects.toThrow(ConflictError);
    expect(txFake.transaction.create).not.toHaveBeenCalled();
  });

  it('(b) ingreso con fecha en un período pagado: también bloquea (criterio 5)', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ type: 'income' }), 'user-1')
    ).rejects.toThrow(ConflictError);
    expect(txFake.transaction.create).not.toHaveBeenCalled();
  });

  it('(c) período sin pago registrado: se crea con normalidad', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });
    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('(d) cuenta cash/bank: se crea sin consultar creditCardPayment (criterio 7)', async () => {
    const creditCardPaymentFindMany = vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]);
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ type: 'bank', cutoffDay: null })]),
      creditCardPaymentFindMany,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });
    expect(creditCardPaymentFindMany).not.toHaveBeenCalled();
    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('(e) tarjeta con cutoffDay null: no lanza por período pagado (sin concepto de período)', async () => {
    const creditCardPaymentFindMany = vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]);
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ cutoffDay: null })]),
      creditCardPaymentFindMany,
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    // income: loadPeriodLimitContext no exige cutoffDay para no-gastos, así que no hay
    // ninguna otra causa de error que pudiera enmascarar el comportamiento bajo prueba.
    await expect(
      service.createTransaction(baseCreateInput({ type: 'income' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });
    expect(creditCardPaymentFindMany).not.toHaveBeenCalled();
  });

  it('(f) la consulta de pagos filtra por account: { userId } (defensa en profundidad)', async () => {
    const creditCardPaymentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma } = fakePrisma({ creditCardPaymentFindMany });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await service.createTransaction(baseCreateInput(), 'user-1');

    const [{ where }] = creditCardPaymentFindMany.mock.calls[0];
    expect(where).toEqual({ accountId: 'account-1', account: { userId: 'user-1' } });
  });

  it('(g) el mensaje de error nombra el rango del período y la fecha de pago', async () => {
    const { prisma } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(service.createTransaction(baseCreateInput(), 'user-1')).rejects.toThrow(
      /2026-06-05.*2026-07-04.*2026-06-20/
    );
  });

  it('(T5-b) con skipPaidPeriodLock: true no consulta creditCardPayment ni bloquea', async () => {
    const creditCardPaymentFindMany = vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]);
    const { prisma, txFake } = fakePrisma({ creditCardPaymentFindMany });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput(), 'user-1', { skipPaidPeriodLock: true })
    ).resolves.toEqual({ id: 'tx-1' });
    expect(creditCardPaymentFindMany).not.toHaveBeenCalled();
    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
  });
});

describe('Bypass del bloqueo desde el body HTTP (seguridad)', () => {
  it('createTransactionSchema descarta la clave skipPaidPeriodLock si viene en el body', () => {
    const parsed = createTransactionSchema.parse({
      amount: 100,
      type: 'expense',
      accountId: '11111111-1111-1111-1111-111111111111',
      categoryId: '22222222-2222-2222-2222-222222222222',
      skipPaidPeriodLock: true,
    });

    expect(parsed).not.toHaveProperty('skipPaidPeriodLock');
  });

  it('un CreateTransactionInput "envenenado" (as en tiempo de compilación) igual queda bloqueado: el controller nunca pasa el tercer parámetro', async () => {
    const today = new Date(2026, 5, 10);
    vi.useFakeTimers();
    vi.setSystemTime(today);
    try {
      const { prisma, txFake } = fakePrisma({
        creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
      });
      const service = new TransactionsServiceImpl(
        fakeTransactionRepo(),
        fakeAccountsService(),
        fakeCategoryRepo(),
        prisma
      );

      const poisonedData = {
        ...baseCreateInput(),
        skipPaidPeriodLock: true,
      } as unknown as CreateTransactionInput;

      // Llamada tal como la hace el controller: sin tercer argumento.
      await expect(service.createTransaction(poisonedData, 'user-1')).rejects.toThrow(
        ConflictError
      );
      expect(txFake.transaction.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TransactionsServiceImpl — período de tarjeta ya pagado (updateTransaction)', () => {
  const today = new Date(2026, 5, 10);

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

  it('(a) editar solo la descripción de una tx ya en período pagado: ConflictError (caso límite de la spec)', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { description: 'Corrección de texto' };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).rejects.toThrow(ConflictError);
    expect(txFake.transaction.update).not.toHaveBeenCalled();
  });

  it('(b) mover la fecha HACIA un período pagado: ConflictError', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({
        findByIdAndUser: async () => fakeExisting({ date: new Date(2026, 3, 10) }) as never,
      }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { date: '2026-06-10T00:00:00.000Z' };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).rejects.toThrow(ConflictError);
    expect(txFake.transaction.update).not.toHaveBeenCalled();
  });

  it('(c) mover la fecha FUERA de un período pagado: se actualiza (criterio 3)', async () => {
    // El pago mockeado corresponde al período de origen [5-jun,4-jul]; el destino
    // (10-abr) no tiene pago -> no debe bloquear.
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { date: '2026-04-10T00:00:00.000Z' };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).resolves.toEqual({
      id: 'tx-1',
    });
    expect(txFake.transaction.update).toHaveBeenCalledTimes(1);
  });

  it('(d) cambiar a otra tarjeta sin pagos: se actualiza (criterio 3)', async () => {
    const creditCardPaymentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma, txFake } = fakePrisma({ creditCardPaymentFindMany });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    const data: UpdateTransactionInput = { accountId: 'account-2' };

    await expect(service.updateTransaction('tx-1', data, 'user-1')).resolves.toEqual({
      id: 'tx-1',
    });
    expect(creditCardPaymentFindMany).toHaveBeenCalledWith({
      where: { accountId: 'account-2', account: { userId: 'user-1' } },
    });
    expect(txFake.transaction.update).toHaveBeenCalledTimes(1);
  });

  it('(e) rollback: al lanzar por período pagado, transaction.update nunca se llama', async () => {
    const { prisma, txFake } = fakePrisma({
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({ findByIdAndUser: async () => fakeExisting() as never }),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(service.updateTransaction('tx-1', { amount: 999 }, 'user-1')).rejects.toThrow(
      ConflictError
    );
    expect(txFake.transaction.update).not.toHaveBeenCalled();
  });
});

describe('TransactionsServiceImpl — deleteTransaction y cuentas no-tarjeta (regresión, criterios 4 y 7)', () => {
  it('(T6-a) eliminar una tx dentro de un período pagado siempre resuelve, sin consultar creditCardPayment', async () => {
    const creditCardPaymentFindMany = vi.fn();
    const { prisma, txFake } = fakePrisma({ creditCardPaymentFindMany });
    const updateAccountBalance = vi.fn().mockResolvedValue(undefined);
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo({
        findByIdAndUser: async () =>
          ({ id: 'tx-1', accountId: 'account-1', amount: 50, type: 'expense' }) as never,
      }),
      fakeAccountsService({ updateAccountBalance }),
      fakeCategoryRepo(),
      prisma
    );

    await service.deleteTransaction('tx-1', 'user-1');

    expect(txFake.transaction.delete).toHaveBeenCalledTimes(1);
    expect(creditCardPaymentFindMany).not.toHaveBeenCalled();
  });

  it('(T6-b) crear en cuenta cash no bloquea aunque existan pagos registrados en otras cuentas', async () => {
    const { prisma, txFake } = fakePrisma({
      queryRaw: vi.fn().mockResolvedValue([fakeAccountRow({ type: 'cash', cutoffDay: null })]),
      creditCardPaymentFindMany: vi.fn().mockResolvedValue([fakePaymentForCurrentPeriod()]),
    });
    const service = new TransactionsServiceImpl(
      fakeTransactionRepo(),
      fakeAccountsService(),
      fakeCategoryRepo(),
      prisma
    );

    await expect(
      service.createTransaction(baseCreateInput({ type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });
    expect(txFake.transaction.create).toHaveBeenCalledTimes(1);
  });
});
