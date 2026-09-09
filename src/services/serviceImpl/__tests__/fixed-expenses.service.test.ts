import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  PrismaClient,
  FixedExpense,
  Account,
  Category,
  RecurringDebtPayment,
} from '@prisma/client';
import type { FixedExpenseRepository } from '../../../repositories/interfaces/fixed-expense.repository.port.js';
import type { AccountsService } from '../../interfaces/accounts.service.port.js';
import type {
  CategoriesService,
  CategorySpending,
} from '../../interfaces/categories.service.port.js';
import type { DebtsService, DebtsSummary } from '../../interfaces/debts.service.port.js';
import type { CreditCardsService } from '../../interfaces/credit-cards.service.port.js';
import type { TransactionsService } from '../../interfaces/transactions.service.port.js';
import type {
  RecurringDebtPaymentsService,
  RdpWithFullRelations,
  ProcessPendingResult,
} from '../../interfaces/recurring-debt-payments.service.port.js';
import { NotFoundError, ConflictError } from '../../../lib/errors.js';
import { FixedExpensesServiceImpl } from '../fixed-expenses.service.js';

const mockedFindUnique = vi.fn();
const mockedCreateTransaction = vi.fn();

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

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => {
      throw new Error('not used in these tests');
    },
    findAccountById: async () => null,
    getCreditCards: async () => [],
    getConfiguredCreditCards: async () => [],
    countByUser: async () => 0,
    createAccount: async () => fakeAccount(),
    updateAccount: async () => fakeAccount(),
    deleteAccount: async () => fakeAccount(),
    transferFunds: async () => {
      throw new Error('not used in these tests');
    },
    getTransfersByAccount: async () => [],
    updateAccountBalance: async () => undefined,
    ...overrides,
  };
}

function fakeCategoriesService(overrides: Partial<CategoriesService> = {}): CategoriesService {
  return {
    getCategories: async () => [],
    getCategoryById: async () => {
      throw new Error('not used in these tests');
    },
    createCategory: async () => {
      throw new Error('not used in these tests');
    },
    updateCategory: async () => {
      throw new Error('not used in these tests');
    },
    deleteCategory: async () => {
      throw new Error('not used in these tests');
    },
    getCategorySpending: async () => ({}) as CategorySpending,
    hydrateCategoriesByIds: async () => [],
    hydrateUserCategoriesByIds: async () => [],
    getOrCreateSystemCategory: async () => ({}) as Category,
    countByUser: async () => 0,
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
    getDebtsSummary: async () => ({}) as DebtsSummary,
    countByUser: async () => 0,
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

function fakeTransactionsService(
  overrides: Partial<TransactionsService> = {}
): TransactionsService {
  return {
    getTransactions: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionById: async () => {
      throw new Error('not used in these tests');
    },
    createTransaction: mockedCreateTransaction,
    updateTransaction: async () => {
      throw new Error('not used in these tests');
    },
    deleteTransaction: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionSummary: async () => [],
    getReceiptItems: async () => [],
    countByCategory: async () => 0,
    findMonthlyCategoryExpenses: async () => [],
    findCardStatementTransactions: async () => [],
    findFixedExpensePaymentInMonth: async () => null,
    resyncTransactionsForFixedExpense: async () => ({ count: 0 }),
    getMonthlyTotalByType: async () => ({ _sum: { amount: null } }),
    getVariableExpenseTotal: async () => ({ _sum: { amount: null } }),
    getCategoryBreakdown: async () => [],
    findTransactionsSince: async () => [],
    getTopExpenseCategories: async () => [],
    getUserTotalsByType: async () => [],
    getExpensesByUserAndCategory: async () => [],
    countByUser: async () => 0,
    getFirstTransactionDate: async () => null,
    findByImageHash: async () => null,
    findSimilarByAmountAndDate: async () => [],
    ...overrides,
  };
}

function fakeRecurringDebtPaymentsService(
  overrides: Partial<RecurringDebtPaymentsService> = {}
): RecurringDebtPaymentsService {
  return {
    createRecurringDebtPayment: async () => {
      throw new Error('not used in these tests');
    },
    getRecurringDebtPayments: async () => [] as RdpWithFullRelations[],
    getRecurringDebtPaymentById: async () => {
      throw new Error('not used in these tests');
    },
    updateRecurringDebtPayment: async () => {
      throw new Error('not used in these tests');
    },
    deleteRecurringDebtPayment: async () => {
      throw new Error('not used in these tests');
    },
    processPendingRecurringPayments: async () => ({}) as ProcessPendingResult,
    findRecurringPaymentById: mockedFindUnique,
    updateRecurringPaymentFields: async () => ({}) as RecurringDebtPayment,
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
    accountsService?: AccountsService;
    categoriesService?: CategoriesService;
    debtsService?: DebtsService;
    creditCardsService?: CreditCardsService;
    transactionsService?: TransactionsService;
    recurringDebtPaymentsService?: RecurringDebtPaymentsService;
    prisma?: PrismaClient;
  } = {}
): FixedExpensesServiceImpl {
  return new FixedExpensesServiceImpl(
    deps.fixedExpenseRepo ?? fakeFixedExpenseRepo(),
    deps.accountsService ?? fakeAccountsService(),
    deps.categoriesService ?? fakeCategoriesService(),
    deps.debtsService ?? fakeDebtsService(),
    deps.creditCardsService ?? fakeCreditCardsService(),
    deps.transactionsService ?? fakeTransactionsService(),
    deps.recurringDebtPaymentsService ?? fakeRecurringDebtPaymentsService(),
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

  describe('payFixedExpense (usa TransactionsService.createTransaction)', () => {
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

  describe('updateFixedExpense (usa TransactionsService.resyncTransactionsForFixedExpense)', () => {
    it('cambia categoría/cuenta: resincroniza las transacciones asociadas', async () => {
      const resyncTransactionsForFixedExpense = vi.fn().mockResolvedValue({ count: 2 });
      const existing = fakeFixedExpense({ categoryId: 'category-old', accountId: 'account-old' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        transactionsService: fakeTransactionsService({ resyncTransactionsForFixedExpense }),
      });

      await service.updateFixedExpense(
        'fe-1',
        { categoryId: 'category-new', accountId: 'account-new' },
        'user-1'
      );

      expect(resyncTransactionsForFixedExpense).toHaveBeenCalledWith(
        'user-1',
        'fe-1',
        expect.objectContaining({ categoryId: 'category-new', accountId: 'account-new' })
      );
    });

    it('sin cambio de categoría/cuenta: no resincroniza', async () => {
      const resyncTransactionsForFixedExpense = vi.fn();
      const existing = fakeFixedExpense({ categoryId: 'category-1', accountId: 'account-1' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        transactionsService: fakeTransactionsService({ resyncTransactionsForFixedExpense }),
      });

      await service.updateFixedExpense('fe-1', { name: 'Nuevo nombre' }, 'user-1');

      expect(resyncTransactionsForFixedExpense).not.toHaveBeenCalled();
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

  describe('getActiveFixedExpenses / getActiveFixedExpensesWithCategory / getActiveExpenseFixedExpenses (Fase 6)', () => {
    it('getActiveFixedExpenses filtra solo isActive:true, sin include', async () => {
      const calls: unknown[] = [];
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async (userId, filters, include, orderBy) => {
            calls.push({ userId, filters, include, orderBy });
            return [fakeFixedExpense()];
          },
        }),
      });

      await service.getActiveFixedExpenses('user-1');

      expect(calls).toEqual([
        { userId: 'user-1', filters: { isActive: true }, include: undefined, orderBy: undefined },
      ]);
    });

    it('getActiveFixedExpensesWithCategory preserva include de categoría y orderBy (sortOrder, dueDay)', async () => {
      const calls: unknown[] = [];
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async (userId, filters, include, orderBy) => {
            calls.push({ userId, filters, include, orderBy });
            return [];
          },
        }),
      });

      await service.getActiveFixedExpensesWithCategory('user-1');

      expect(calls).toEqual([
        {
          userId: 'user-1',
          filters: { isActive: true },
          include: { category: { select: { id: true, name: true, icon: true, color: true } } },
          orderBy: [{ sortOrder: 'asc' }, { dueDay: 'asc' }],
        },
      ]);
    });

    it('getActiveExpenseFixedExpenses filtra isActive:true y type:expense', async () => {
      const calls: unknown[] = [];
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async (userId, filters) => {
            calls.push({ userId, filters });
            return [];
          },
        }),
      });

      await service.getActiveExpenseFixedExpenses('user-1');

      expect(calls).toEqual([{ userId: 'user-1', filters: { isActive: true, type: 'expense' } }]);
    });
  });

  describe('countByUser (Fase 6 — cuenta TODOS, activos e inactivos)', () => {
    it('delega en fixedExpenseRepo.countByUser (no en getFixedExpensesSummary)', async () => {
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ countByUser: async () => 9 }),
      });

      await expect(service.countByUser('user-1')).resolves.toBe(9);
    });
  });

  describe('getFixedExpenses / createFixedExpense / deleteFixedExpense', () => {
    it('getFixedExpenses aplica el filtro isActive solo cuando activeOnly es true', async () => {
      const calls: unknown[] = [];
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async (userId, filters) => {
            calls.push(filters);
            return [];
          },
        }),
      });

      await service.getFixedExpenses('user-1');
      await service.getFixedExpenses('user-1', true);

      expect(calls).toEqual([undefined, { isActive: true }]);
    });

    it('createFixedExpense delega en el repositorio incluyendo el userId', async () => {
      const create = vi.fn().mockResolvedValue(fakeFixedExpense());
      const service = buildService({ fixedExpenseRepo: fakeFixedExpenseRepo({ create }) });

      await service.createFixedExpense({ name: 'Renta' } as never, 'user-1');

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Renta', userId: 'user-1' }),
        expect.anything()
      );
    });

    it('deleteFixedExpense lanza NotFoundError si no pertenece al usuario, y no llama remove', async () => {
      const remove = vi.fn();
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => null, remove }),
      });

      await expect(service.deleteFixedExpense('fe-1', 'user-1')).rejects.toThrow(NotFoundError);
      expect(remove).not.toHaveBeenCalled();
    });

    it('deleteFixedExpense elimina cuando existe', async () => {
      const remove = vi.fn().mockResolvedValue(fakeFixedExpense());
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense(),
          remove,
        }),
      });

      await service.deleteFixedExpense('fe-1', 'user-1');

      expect(remove).toHaveBeenCalledWith('fe-1');
    });
  });

  describe('updateFixedExpense — sincronización del recurring debt payment asociado', () => {
    it('sin recurringDebtPaymentId: no consulta ni actualiza el recurring payment', async () => {
      const findRecurringPaymentById = vi.fn();
      const existing = fakeFixedExpense({ recurringDebtPaymentId: null });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById,
        }),
      });

      await service.updateFixedExpense('fe-1', { name: 'x' }, 'user-1');

      expect(findRecurringPaymentById).not.toHaveBeenCalled();
    });

    it('cambia dueDay: recalcula nextDueDate y actualiza dayOfMonth + nextDueDate', async () => {
      const updateRecurringPaymentFields = vi.fn().mockResolvedValue({});
      const existing = fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1', dueDay: 5 });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById: async () =>
            ({ frequency: 'monthly', dayOfMonth: 5, dayOfWeek: null }) as never,
          updateRecurringPaymentFields,
        }),
      });

      await service.updateFixedExpense('fe-1', { dueDay: 20 }, 'user-1');

      expect(updateRecurringPaymentFields).toHaveBeenCalledWith(
        'recurring-1',
        expect.objectContaining({ dayOfMonth: 20, nextDueDate: expect.any(Date) })
      );
    });

    it('cambia amount y accountId (sin cambiar dueDay): actualiza esos campos sin recalcular nextDueDate', async () => {
      const updateRecurringPaymentFields = vi.fn().mockResolvedValue({});
      const existing = fakeFixedExpense({
        recurringDebtPaymentId: 'recurring-1',
        amount: 100,
        accountId: 'account-old',
      });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById: async () =>
            ({ frequency: 'monthly', dayOfMonth: 5, dayOfWeek: null }) as never,
          updateRecurringPaymentFields,
        }),
      });

      await service.updateFixedExpense('fe-1', { amount: 250, accountId: 'account-new' }, 'user-1');

      expect(updateRecurringPaymentFields).toHaveBeenCalledWith('recurring-1', {
        amount: 250,
        accountId: 'account-new',
      });
    });

    it('sin cambios relevantes: no llama updateRecurringPaymentFields', async () => {
      const updateRecurringPaymentFields = vi.fn();
      const existing = fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById: async () =>
            ({ frequency: 'monthly', dayOfMonth: 5, dayOfWeek: null }) as never,
          updateRecurringPaymentFields,
        }),
      });

      await service.updateFixedExpense('fe-1', { name: 'Solo el nombre' }, 'user-1');

      expect(updateRecurringPaymentFields).not.toHaveBeenCalled();
    });

    it('el recurring payment ya no existe: no falla, solo omite la sincronización', async () => {
      const existing = fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ findByIdAndUser: async () => existing }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById: async () => null as never,
        }),
      });

      await expect(service.updateFixedExpense('fe-1', { dueDay: 20 }, 'user-1')).resolves.toEqual(
        fakeFixedExpense()
      );
    });
  });

  describe('payFixedExpense — recurring debt payment no encontrado', () => {
    beforeEach(() => {
      mockedCreateTransaction.mockResolvedValue({ id: 'tx-1' });
    });

    it('si el recurring payment ya no existe, no llama payDebt y el pago igual se resuelve', async () => {
      const payDebt = vi.fn();
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1' }),
        }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          findRecurringPaymentById: async () => null as never,
        }),
        debtsService: fakeDebtsService({ payDebt }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({
        id: 'tx-1',
      });
      expect(payDebt).not.toHaveBeenCalled();
    });

    it('si payDebt falla, el error se loguea pero no se relanza (el pago igual se resuelve)', async () => {
      mockedFindUnique.mockResolvedValue({ debtId: 'debt-1' });
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findByIdAndUser: async () => fakeFixedExpense({ recurringDebtPaymentId: 'recurring-1' }),
        }),
        debtsService: fakeDebtsService({ payDebt: async () => Promise.reject(new Error('boom')) }),
      });

      await expect(service.payFixedExpense('fe-1', {}, 'user-1')).resolves.toEqual({
        id: 'tx-1',
      });
    });
  });

  describe('getFixedExpensesSummary', () => {
    function fakeCard(overrides: Partial<Account> = {}): Account {
      return fakeAccount({
        id: 'card-1',
        name: 'Visa',
        type: 'credit_card',
        paymentDueDay: 15,
        paymentAccountId: 'account-1',
        ...overrides,
      } as never);
    }

    function fakeStatement(overrides: Record<string, unknown> = {}) {
      return {
        account: fakeCard(),
        currentPeriod: { startDate: new Date(), endDate: new Date(), balance: 0, transactions: [] },
        closedPeriod: {
          startDate: new Date(),
          endDate: new Date(),
          balance: 0,
          transactions: [],
          isPaid: true,
          paymentDueDate: new Date(),
          daysUntilDue: 5,
        },
        creditLimit: 1000,
        available: 1000,
        usagePercentage: 0,
        alerts: [],
        ...overrides,
      } as never;
    }

    it('sin tarjetas configuradas ni recurring payments: no crea ni actualiza fixed expenses', async () => {
      const create = vi.fn();
      const update = vi.fn();
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ create, update, findAllByUser: async () => [] }),
        accountsService: fakeAccountsService({ getConfiguredCreditCards: async () => [] }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [],
        }),
      });

      const summary = await service.getFixedExpensesSummary('user-1');

      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(summary).toMatchObject({ totalCount: 0, paidCount: 0, pendingCount: 0 });
    });

    it('tarjeta con período cerrado pendiente y sin fixed expense previo: crea uno nuevo urgente', async () => {
      const create = vi.fn().mockResolvedValue(fakeFixedExpense());
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ create, findFirst: async () => null }),
        accountsService: fakeAccountsService({
          getConfiguredCreditCards: async () => [fakeCard()],
        }),
        creditCardsService: fakeCreditCardsService({
          getCreditCardStatement: async () =>
            fakeStatement({ closedPeriod: { balance: 300, isPaid: false } }),
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pago Tarjeta Visa', amount: 300 })
      );
    });

    it('tarjeta con fixed expense existente y saldo del período actual: lo actualiza (proyección)', async () => {
      const update = vi.fn().mockResolvedValue(fakeFixedExpense());
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          update,
          findFirst: async () => fakeFixedExpense({ id: 'fe-card' }),
        }),
        accountsService: fakeAccountsService({
          getConfiguredCreditCards: async () => [fakeCard()],
        }),
        creditCardsService: fakeCreditCardsService({
          getCreditCardStatement: async () => fakeStatement({ currentPeriod: { balance: 120 } }),
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(update).toHaveBeenCalledWith(
        'fe-card',
        expect.objectContaining({ amount: 120, isActive: true })
      );
    });

    it('tarjeta sin saldo pendiente y con fixed expense existente: lo desactiva', async () => {
      const update = vi.fn().mockResolvedValue(fakeFixedExpense());
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          update,
          findFirst: async () => fakeFixedExpense({ id: 'fe-card' }),
        }),
        accountsService: fakeAccountsService({
          getConfiguredCreditCards: async () => [fakeCard()],
        }),
        creditCardsService: fakeCreditCardsService({
          getCreditCardStatement: async () => fakeStatement(),
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(update).toHaveBeenCalledWith('fe-card', { isActive: false });
    });

    it('si getCreditCardStatement falla para una tarjeta, se ignora y no interrumpe el resto', async () => {
      const service = buildService({
        accountsService: fakeAccountsService({
          getConfiguredCreditCards: async () => [fakeCard()],
        }),
        creditCardsService: fakeCreditCardsService({
          getCreditCardStatement: async () => {
            throw new Error('fechas no configuradas');
          },
        }),
      });

      await expect(service.getFixedExpensesSummary('user-1')).resolves.toBeDefined();
    });

    it('recurring payment con deuda ya pagada y fixed expense existente: lo desactiva y no crea transacción', async () => {
      const update = vi.fn().mockResolvedValue(fakeFixedExpense());
      const rdp = {
        id: 'rdp-1',
        isActive: true,
        frequency: 'monthly',
        accountId: 'account-1',
        amount: 50,
        dayOfMonth: 10,
        debt: { status: 'paid', creditor: 'Banco X', description: null },
      } as never;
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          update,
          findMany: async () => [
            fakeFixedExpense({ id: 'fe-debt', recurringDebtPaymentId: 'rdp-1' }),
          ],
        }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [rdp],
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(update).toHaveBeenCalledWith('fe-debt', { isActive: false });
    });

    it('recurring payment activo sin fixed expense previo: crea uno nuevo', async () => {
      const create = vi.fn().mockResolvedValue(fakeFixedExpense());
      const rdp = {
        id: 'rdp-1',
        isActive: true,
        frequency: 'monthly',
        accountId: 'account-1',
        amount: 75,
        dayOfMonth: 12,
        debt: { status: 'active', creditor: 'Banco Y', description: 'Préstamo' },
      } as never;
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ create, findMany: async () => [] }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [rdp],
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pago Deuda: Banco Y - Préstamo', amount: 75 })
      );
    });

    it('recurring payment activo con fixed expense previo: lo actualiza en vez de crear uno nuevo', async () => {
      const update = vi.fn().mockResolvedValue(fakeFixedExpense());
      const create = vi.fn();
      const rdp = {
        id: 'rdp-1',
        isActive: true,
        frequency: 'monthly',
        accountId: 'account-1',
        amount: 90,
        dayOfMonth: 12,
        debt: { status: 'active', creditor: 'Banco Z', description: null },
      } as never;
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          update,
          create,
          findMany: async () =>
            [fakeFixedExpense({ id: 'fe-existing', recurringDebtPaymentId: 'rdp-1' })] as never,
        }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [rdp],
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(update).toHaveBeenCalledWith(
        'fe-existing',
        expect.objectContaining({ name: 'Pago Deuda: Banco Z', amount: 90 })
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('si falla el sync de un recurring payment, se loguea y no interrumpe el resto de la sincronización', async () => {
      const rdp = {
        id: 'rdp-1',
        isActive: true,
        frequency: 'monthly',
        accountId: 'account-1',
        amount: 90,
        dayOfMonth: 12,
        debt: { status: 'active', creditor: 'Banco Z', description: null },
      } as never;
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          create: async () => {
            throw new Error('db error');
          },
          findMany: async () => [],
        }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [rdp],
        }),
      });

      await expect(service.getFixedExpensesSummary('user-1')).resolves.toBeDefined();
    });

    it('ignora recurring payments inactivos o no mensuales', async () => {
      const create = vi.fn();
      const rdpInactive = {
        id: 'rdp-1',
        isActive: false,
        frequency: 'monthly',
        debt: { status: 'active', creditor: 'X', description: null },
      } as never;
      const rdpWeekly = {
        id: 'rdp-2',
        isActive: true,
        frequency: 'weekly',
        debt: { status: 'active', creditor: 'Y', description: null },
      } as never;
      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({ create, findMany: async () => [] }),
        recurringDebtPaymentsService: fakeRecurringDebtPaymentsService({
          getRecurringDebtPayments: async () => [rdpInactive, rdpWeekly],
        }),
      });

      await service.getFixedExpensesSummary('user-1');

      expect(create).not.toHaveBeenCalled();
    });

    it('calcula totales mensuales solo con items activos y separa pagados/pendientes por transacciones del mes', async () => {
      const items = [
        fakeFixedExpense({
          id: 'fe-1',
          isActive: true,
          type: 'expense',
          amount: 100,
        }),
        fakeFixedExpense({
          id: 'fe-2',
          isActive: true,
          type: 'income',
          amount: 40,
        }),
        fakeFixedExpense({ id: 'fe-3', isActive: false, type: 'expense', amount: 999 }),
      ].map((fe) => ({ ...fe, transactions: fe.id === 'fe-1' ? [{ id: 'tx-1' }] : [] }));

      const service = buildService({
        fixedExpenseRepo: fakeFixedExpenseRepo({
          findAllByUser: async () => items as never,
        }),
      });

      const summary = await service.getFixedExpensesSummary('user-1');

      expect(summary.totalMonthlyExpenses).toBe(100);
      expect(summary.totalMonthlyIncome).toBe(40);
      expect(summary.totalCount).toBe(2);
      expect(summary.paidCount).toBe(1);
      expect(summary.pendingCount).toBe(1);
    });
  });
});
