import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient, FixedExpense, Account, Category } from '@prisma/client';
import type { FixedExpenseRepository } from '../../repositories/fixed-expense.repository.port.js';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import type { DebtsService } from '../debts.service.port.js';
import type { CreditCardsService } from '../credit-cards.service.port.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('../../repositories/recurring-debt-payment.repository.js', () => ({
  findUnique: vi.fn(),
  findAllByUser: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../transactions.service.js', () => ({
  createTransaction: vi.fn(),
}));

import { createTransaction } from '../transactions.service.js';
import * as recurringRepo from '../../repositories/recurring-debt-payment.repository.js';
import { FixedExpensesServiceImpl } from '../fixed-expenses.service.js';

const mockedCreateTransaction = createTransaction as unknown as ReturnType<typeof vi.fn>;
const mockedFindUnique = recurringRepo.findUnique as unknown as ReturnType<typeof vi.fn>;

function fakeFixedExpense(overrides: Partial<FixedExpense> = {}): FixedExpense {
  const id = (overrides.id as string | undefined) ?? 'fe-1';
  return {
    id,
    userId: 'user-1',
    name: `FE ${id}`,
    amount: 100,
    type: 'expense',
    accountId: 'account-1',
    categoryId: 'category-1',
    creditCardAccountId: null,
    recurringDebtPaymentId: null,
    isActive: true,
    autoGenerate: false,
    dueDay: 10,
    sortOrder: 0,
    ...overrides,
  } as unknown as FixedExpense;
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
    create: async () => fakeFixedExpense(),
    update: async () => fakeFixedExpense(),
    remove: async () => fakeFixedExpense(),
    ...overrides,
  };
}

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Cuenta Test',
    type: 'bank',
    balance: 100,
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
      throw new Error('not used in these tests');
    },
    findTransfersByAccount: async () => [],
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
    upsertSystemCategory: async () => ({}) as Category,
    ...overrides,
  };
}

function fakeDebtsService(overrides: Partial<DebtsService> = {}): DebtsService {
  return {
    createDebt: async () => {
      throw new Error('not used in these tests');
    },
    getDebts: async () => [],
    getDebtById: async () => {
      throw new Error('not used in these tests');
    },
    updateDebt: async () => {
      throw new Error('not used in these tests');
    },
    deleteDebt: async () => {
      throw new Error('not used in these tests');
    },
    payDebt: async () => {
      throw new Error('not used in these tests');
    },
    getDebtsSummary: async () => {
      throw new Error('not used in these tests');
    },
    ...overrides,
  };
}

function fakeCreditCardsService(overrides: Partial<CreditCardsService> = {}): CreditCardsService {
  return {
    getCreditCardStatement: async () => {
      throw new Error('not used in these tests');
    },
    getCreditCardsSummary: async () => {
      throw new Error('not used in these tests');
    },
    payCreditCardStatement: async () => {
      throw new Error('not used in these tests');
    },
    ...overrides,
  };
}

function fakePrisma(
  overrides: {
    findManyFixedExpense?: ReturnType<typeof vi.fn>;
    findManyTransaction?: ReturnType<typeof vi.fn>;
    updateFixedExpense?: ReturnType<typeof vi.fn>;
  } = {}
): PrismaClient {
  const findManyFixedExpense = overrides.findManyFixedExpense ?? vi.fn().mockResolvedValue([]);
  const findManyTransaction = overrides.findManyTransaction ?? vi.fn().mockResolvedValue([]);
  const updateFixedExpense = overrides.updateFixedExpense ?? vi.fn();

  return {
    fixedExpense: {
      findMany: findManyFixedExpense,
      update: updateFixedExpense,
    },
    transaction: {
      findMany: findManyTransaction,
    },
    $transaction: vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg)),
  } as unknown as PrismaClient;
}

function buildService(
  deps: {
    fixedExpenseRepo?: FixedExpenseRepository;
    accountRepo?: AccountRepository;
    categoryRepo?: CategoryRepository;
    debtsService?: DebtsService;
    creditCardsService?: CreditCardsService;
    prisma?: PrismaClient;
  } = {}
): FixedExpensesServiceImpl {
  return new FixedExpensesServiceImpl(
    deps.fixedExpenseRepo ?? fakeFixedExpenseRepo(),
    deps.accountRepo ?? fakeAccountRepo(),
    deps.categoryRepo ?? fakeCategoryRepo(),
    deps.debtsService ?? fakeDebtsService(),
    deps.creditCardsService ?? fakeCreditCardsService(),
    deps.prisma ?? fakePrisma()
  );
}

describe('FixedExpensesServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFixedExpenseById', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => null }),
      });

      await expect(service.getFixedExpenseById('fe-1', 'user-1')).rejects.toThrow(
        'Gasto fijo no encontrado'
      );
      await expect(service.getFixedExpenseById('fe-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('payFixedExpense', () => {
    beforeEach(() => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
    });

    it('sin tarjeta de crédito ni deuda asociada: solo crea la transacción', async () => {
      const payDebt = vi.fn();
      const payCreditCardStatement = vi.fn();
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense(),
        }),
        debtsService: fakeDebtsService({ payDebt }),
        creditCardsService: fakeCreditCardsService({ payCreditCardStatement }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({
        id: 'tx-1',
      });
      expect(payDebt).not.toHaveBeenCalled();
      expect(payCreditCardStatement).not.toHaveBeenCalled();
    });

    it('con tarjeta de crédito asociada: delega en payCreditCardStatement', async () => {
      const payCreditCardStatement = vi.fn().mockResolvedValue({});
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ creditCardAccountId: 'card-1' }),
        }),
        creditCardsService: fakeCreditCardsService({ payCreditCardStatement }),
      });

      await service.payFixedExpense('fe-1', {}, 'user-1');

      expect(payCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1', expect.any(Object));
    });

    it('con recurring debt payment asociado: delega en debtsService.payDebt', async () => {
      const payDebt = vi.fn().mockResolvedValue({});
      mockedFindUnique.mockResolvedValue({ debtId: 'debt-1' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1' }),
        }),
        debtsService: fakeDebtsService({ payDebt }),
      });

      await service.payFixedExpense('fe-1', {}, 'user-1');

      expect(payDebt).toHaveBeenCalledWith('debt-1', 'user-1', expect.any(Object));
    });

    it('ConflictError de payCreditCardStatement no se relanza — el pago se considera exitoso', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ creditCardAccountId: 'card-1' }),
        }),
        creditCardsService: fakeCreditCardsService({
          payCreditCardStatement: vi
            .fn()
            .mockRejectedValueOnce(new ConflictError('El estado de cuenta ya está pagado')),
        }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({
        id: 'tx-1',
      });
    });

    it('Error genérico de payCreditCardStatement sí se relanza', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ creditCardAccountId: 'card-1' }),
        }),
        creditCardsService: fakeCreditCardsService({
          payCreditCardStatement: vi.fn().mockRejectedValueOnce(new Error('boom')),
        }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).rejects.toThrow('boom');
    });

    it('ConflictError con un mensaje distinto tampoco se relanza (desacoplado del texto)', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ creditCardAccountId: 'card-1' }),
        }),
        creditCardsService: fakeCreditCardsService({
          payCreditCardStatement: vi
            .fn()
            .mockRejectedValueOnce(new ConflictError('mensaje totalmente diferente')),
        }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({
        id: 'tx-1',
      });
    });

    it('Error genérico cuyo mensaje contiene "ya está pagado" SÍ se relanza (no se confunde por texto)', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ creditCardAccountId: 'card-1' }),
        }),
        creditCardsService: fakeCreditCardsService({
          payCreditCardStatement: vi
            .fn()
            .mockRejectedValueOnce(new Error('ya está pagado, pero esto es un error real')),
        }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).rejects.toThrow('ya está pagado');
    });
  });

  describe('reorderFixedExpenses', () => {
    it('lanza NotFoundError si algún id no pertenece al usuario', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async () => [fakeFixedExpense({ id: 'fe-1' })],
        }),
      });

      await expect(
        service.reorderFixedExpenses('user-1', [
          { id: 'fe-1', sortOrder: 0 },
          { id: 'fe-2', sortOrder: 1 },
        ])
      ).rejects.toThrow('Algunos gastos fijos no fueron encontrados');
    });

    it('actualiza el orden si todos los ids pertenecen al usuario', async () => {
      const updateFixedExpense = vi.fn();
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async () => [
            fakeFixedExpense({ id: 'fe-1' }),
            fakeFixedExpense({ id: 'fe-2' }),
          ],
        }),
        prisma: fakePrisma({ updateFixedExpense }),
      });

      await expect(
        service.reorderFixedExpenses('user-1', [
          { id: 'fe-1', sortOrder: 0 },
          { id: 'fe-2', sortOrder: 1 },
        ])
      ).resolves.toEqual({ success: true });
      expect(updateFixedExpense).toHaveBeenCalledTimes(2);
    });
  });

  describe('autoGenerateFixedExpenseTransactions', () => {
    it('día normal: el where enviado a findMany usa dueDay exacto', async () => {
      const findManyFixedExpense = vi.fn().mockResolvedValue([]);
      const service = buildService({ prisma: fakePrisma({ findManyFixedExpense }) });

      await service.autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10)); // 10 jun 2026 (mes de 30 días)

      expect(findManyFixedExpense).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ dueDay: 10 }) })
      );
    });

    it('último día de un mes de 30 días: el where usa dueDay >= 30', async () => {
      const findManyFixedExpense = vi.fn().mockResolvedValue([]);
      const service = buildService({ prisma: fakePrisma({ findManyFixedExpense }) });

      await service.autoGenerateFixedExpenseTransactions(new Date(2026, 5, 30)); // 30 jun 2026

      expect(findManyFixedExpense).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ dueDay: { gte: 30 } }) })
      );
    });

    it('gasto fijo ya generado este mes: no se llama createTransaction para ese id', async () => {
      const findManyFixedExpense = vi.fn().mockResolvedValue([fakeFixedExpense({ id: 'fe-1' })]);
      const findManyTransaction = vi.fn().mockResolvedValue([{ fixedExpenseId: 'fe-1' }]);
      const service = buildService({
        prisma: fakePrisma({ findManyFixedExpense, findManyTransaction }),
      });

      const result = await service.autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

      expect(mockedCreateTransaction).not.toHaveBeenCalled();
      expect(result).toEqual({ createdByUser: {}, failedByUser: {} });
    });

    it('createTransaction lanza un error genérico para el primer gasto: el segundo se procesa igual y no se reporta como fallo', async () => {
      const findManyFixedExpense = vi
        .fn()
        .mockResolvedValue([fakeFixedExpense({ id: 'fe-1' }), fakeFixedExpense({ id: 'fe-2' })]);
      const service = buildService({ prisma: fakePrisma({ findManyFixedExpense }) });
      mockedCreateTransaction.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});

      const result = await service.autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

      expect(mockedCreateTransaction).toHaveBeenCalledTimes(2);
      expect(result.createdByUser).toEqual({ 'user-1': 1 });
      // Un Error genérico (no tipado) solo se loguea, no se reporta al usuario.
      expect(result.failedByUser).toEqual({});
    });

    it('createTransaction lanza ConflictError (límite de tarjeta): se reporta en failedByUser', async () => {
      const findManyFixedExpense = vi.fn().mockResolvedValue([fakeFixedExpense({ id: 'fe-1' })]);
      const service = buildService({ prisma: fakePrisma({ findManyFixedExpense }) });
      mockedCreateTransaction.mockRejectedValueOnce(
        new ConflictError('Se superó el límite disponible de la tarjeta')
      );

      const result = await service.autoGenerateFixedExpenseTransactions(new Date(2026, 5, 10));

      expect(result.createdByUser).toEqual({});
      expect(result.failedByUser).toEqual({
        'user-1': [
          { fixedExpenseName: 'FE fe-1', message: 'Se superó el límite disponible de la tarjeta' },
        ],
      });
    });
  });
});
