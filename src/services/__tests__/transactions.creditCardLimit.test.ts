import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError } from '../../lib/errors.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../schemas/transaction.schema.js';

interface MockAccount {
  id: string;
  type: string;
  creditLimit: number | null;
  balance: number;
  initialBalance: number;
}

vi.mock('../../lib/prisma.js', () => {
  const mockPrisma = {
    account: { findFirst: vi.fn(), updateMany: vi.fn() },
    category: { findFirst: vi.fn() },
    fixedExpense: { findFirst: vi.fn() },
    transaction: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) =>
    cb(mockPrisma)
  );
  return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';
import { createTransaction, updateTransaction } from '../transactions.service.js';

const findFirstAccount = prisma.account.findFirst as unknown as ReturnType<typeof vi.fn>;
const updateManyAccount = prisma.account.updateMany as unknown as ReturnType<typeof vi.fn>;
const findFirstCategory = prisma.category.findFirst as unknown as ReturnType<typeof vi.fn>;
const findFirstTransaction = prisma.transaction.findFirst as unknown as ReturnType<typeof vi.fn>;
const createTx = prisma.transaction.create as unknown as ReturnType<typeof vi.fn>;
const updateTx = prisma.transaction.update as unknown as ReturnType<typeof vi.fn>;
// $queryRaw es la lectura con FOR UPDATE que usa lockAccountForBalanceUpdate;
// account.findFirst queda solo para el chequeo de ownership de assertOwnership.
const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

function fakeAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  return {
    id: 'account-1',
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

describe('createTransaction — validación de límite de tarjeta de crédito (BE-T2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstAccount.mockResolvedValue({ id: 'account-1' });
    findFirstCategory.mockResolvedValue({ id: 'category-1' });
    updateManyAccount.mockResolvedValue({ count: 1 });
    createTx.mockResolvedValue({ id: 'tx-1' });
  });

  it('gasto que excede el límite lanza ConflictError y no crea la transacción ni cambia el saldo', async () => {
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: 100, balance: 0, initialBalance: 0 })]);

    await expect(
      createTransaction(baseCreateInput({ amount: 150, type: 'expense' }), 'user-1')
    ).rejects.toThrow(ConflictError);

    expect(createTx).not.toHaveBeenCalled();
    expect(updateManyAccount).not.toHaveBeenCalled();
  });

  it('gasto dentro del límite sobre tarjeta crea la transacción', async () => {
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: 100, balance: 0, initialBalance: 0 })]);

    await expect(
      createTransaction(baseCreateInput({ amount: 50, type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });

    expect(createTx).toHaveBeenCalledTimes(1);
    expect(updateManyAccount).toHaveBeenCalledTimes(1);

    // La lectura de saldo para validar el límite debe tomar el lock de fila (FOR UPDATE):
    // un SELECT plano permitiría que dos requests concurrentes lean el mismo saldo,
    // pasen ambas la validación y dejen el uso por encima del límite.
    const queryStrings = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('');
    expect(queryStrings).toContain('FOR UPDATE');
  });

  it('income sobre tarjeta no valida el límite aunque supere el uso disponible', async () => {
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: 100, balance: 0, initialBalance: 0 })]);

    await expect(
      createTransaction(baseCreateInput({ amount: 500, type: 'income' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });

    expect(createTx).toHaveBeenCalledTimes(1);
  });

  it('gasto sobre cuenta que no es tarjeta no valida límite', async () => {
    queryRaw.mockResolvedValue([
      fakeAccount({ type: 'bank', creditLimit: null, balance: 0, initialBalance: 0 }),
    ]);

    await expect(
      createTransaction(baseCreateInput({ amount: 5000, type: 'expense' }), 'user-1')
    ).resolves.toEqual({ id: 'tx-1' });

    expect(createTx).toHaveBeenCalledTimes(1);
  });

  it('tarjeta sin creditLimit configurado bloquea el gasto', async () => {
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: null, balance: 0, initialBalance: 0 })]);

    await expect(
      createTransaction(baseCreateInput({ amount: 10, type: 'expense' }), 'user-1')
    ).rejects.toThrow();

    expect(createTx).not.toHaveBeenCalled();
  });
});

describe('updateTransaction — validación de límite de tarjeta de crédito (BE-T3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstAccount.mockResolvedValue({ id: 'account-1' });
    findFirstCategory.mockResolvedValue({ id: 'category-1' });
    updateManyAccount.mockResolvedValue({ count: 1 });
  });

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

  it('editar subiendo el monto por encima del límite lanza y no persiste', async () => {
    findFirstTransaction.mockResolvedValue(fakeExisting());
    // el servicio ya revirtió el gasto original (50) antes de leer la cuenta -> balance 0
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: 100, balance: 0, initialBalance: 0 })]);

    const data: UpdateTransactionInput = { amount: 200 };

    await expect(updateTransaction('tx-1', data, 'user-1')).rejects.toThrow(ConflictError);
    expect(updateTx).not.toHaveBeenCalled();
  });

  it('editar dentro del límite persiste normalmente', async () => {
    findFirstTransaction.mockResolvedValue(fakeExisting());
    // el servicio ya revirtió el gasto original (50) antes de leer la cuenta -> balance 0
    queryRaw.mockResolvedValue([fakeAccount({ creditLimit: 100, balance: 0, initialBalance: 0 })]);
    updateTx.mockResolvedValue({
      id: 'tx-1',
      accountId: 'account-1',
      amount: 80,
      type: 'expense',
    });

    const data: UpdateTransactionInput = { amount: 80 };

    await expect(updateTransaction('tx-1', data, 'user-1')).resolves.toMatchObject({
      amount: 80,
    });
    expect(updateTx).toHaveBeenCalledTimes(1);
  });

  it('cambiar la cuenta a otra tarjeta valida la destino y no la origen', async () => {
    findFirstTransaction.mockResolvedValue(fakeExisting({ accountId: 'account-origin' }));
    // La tarjeta destino ya está casi en el límite; el origen no se lee para validar.
    queryRaw.mockResolvedValue([
      fakeAccount({ id: 'account-dest', creditLimit: 100, balance: -90, initialBalance: 0 }),
    ]);
    updateTx.mockResolvedValue({
      id: 'tx-1',
      accountId: 'account-dest',
      amount: 50,
      type: 'expense',
    });

    const data: UpdateTransactionInput = { accountId: 'account-dest', amount: 50 };

    await expect(updateTransaction('tx-1', data, 'user-1')).rejects.toThrow(ConflictError);
    expect(updateTx).not.toHaveBeenCalled();
  });

  it('cambiar el tipo de gasto a ingreso no valida el límite', async () => {
    findFirstTransaction.mockResolvedValue(fakeExisting());
    queryRaw.mockResolvedValue([
      fakeAccount({ creditLimit: 100, balance: -50, initialBalance: 0 }),
    ]);
    updateTx.mockResolvedValue({
      id: 'tx-1',
      accountId: 'account-1',
      amount: 5000,
      type: 'income',
    });

    const data: UpdateTransactionInput = { type: 'income', amount: 5000 };

    await expect(updateTransaction('tx-1', data, 'user-1')).resolves.toMatchObject({
      type: 'income',
    });
    expect(updateTx).toHaveBeenCalledTimes(1);
  });
});
