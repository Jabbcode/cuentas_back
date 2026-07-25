import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, Debt, DebtPayment, Transaction, PrismaClient } from '@prisma/client';
import type { DebtRepository } from '../../repositories/debt.repository.port.js';
import type { RecurringDebtPaymentRepository } from '../../repositories/recurring-debt-payment.repository.port.js';
import type { AccountsService } from '../accounts.service.port.js';
import type { TransactionsService } from '../transactions.service.port.js';
import { NotFoundError } from '../../lib/errors.js';

vi.mock('../../repositories/fixed-expense.repository.js', () => ({
  findFirst: vi.fn(),
}));

import * as fixedExpenseRepo from '../../repositories/fixed-expense.repository.js';
import { DebtsServiceImpl } from '../debts.service.js';

const mockedFindFirstFixedExpense = fixedExpenseRepo.findFirst as unknown as ReturnType<
  typeof vi.fn
>;

function fakeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    userId: 'user-1',
    creditor: 'Banco Test',
    description: 'Préstamo test',
    totalAmount: 1000,
    remainingAmount: 500,
    interestRate: null,
    interestType: null,
    startDate: new Date(),
    dueDate: null,
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  } as unknown as Debt;
}

function fakeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Cuenta Test',
    type: 'bank',
    balance: 100,
    userId: 'user-1',
    ...overrides,
  } as unknown as Account;
}

function fakeDebtPayment(overrides: Partial<DebtPayment> = {}): DebtPayment {
  return {
    id: 'payment-1',
    debtId: 'debt-1',
    amount: 50,
    principal: 50,
    interest: 0,
    accountId: 'account-1',
    userId: 'user-1',
    paymentDate: new Date(),
    ...overrides,
  } as unknown as DebtPayment;
}

function fakeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'transaction-1',
    amount: 50,
    type: 'expense',
    date: new Date(),
    accountId: 'account-1',
    categoryId: 'category-1',
    userId: 'user-1',
    ...overrides,
  } as unknown as Transaction;
}

function fakeDebtRepo(overrides: Partial<DebtRepository> = {}): DebtRepository {
  return {
    create: async () => fakeDebt(),
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    countByUser: async () => 0,
    update: async () => fakeDebt(),
    remove: async () => undefined,
    ...overrides,
  };
}

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => fakeAccount(),
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

function fakeRecurringRepo(
  overrides: Partial<RecurringDebtPaymentRepository> = {}
): RecurringDebtPaymentRepository {
  return {
    create: async () => {
      throw new Error('not used in these tests');
    },
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findUnique: async () => null,
    findDuePayments: async () => [],
    update: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => undefined,
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
    createTransaction: async () => fakeTransaction(),
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

function fakePrisma(): PrismaClient {
  const txFake = {
    category: { upsert: async () => ({ id: 'category-1' }) },
    transaction: { create: async () => fakeTransaction() },
    account: { update: async () => fakeAccount() },
    debtPayment: { create: async () => fakeDebtPayment() },
    debt: {
      update: async () => ({ ...fakeDebt({ remainingAmount: 450 }), payments: [] }),
    },
  };

  return {
    $transaction: async (cb: (tx: unknown) => unknown) => cb(txFake),
  } as unknown as PrismaClient;
}

function buildService(
  overrides: {
    debtRepo?: Partial<DebtRepository>;
    accountsService?: Partial<AccountsService>;
    recurringRepo?: Partial<RecurringDebtPaymentRepository>;
    transactionsService?: Partial<TransactionsService>;
  } = {}
): DebtsServiceImpl {
  return new DebtsServiceImpl(
    fakeDebtRepo(overrides.debtRepo),
    fakeAccountsService(overrides.accountsService),
    fakeRecurringRepo(overrides.recurringRepo),
    fakeTransactionsService(overrides.transactionsService),
    fakePrisma()
  );
}

describe('DebtsServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDebtById', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = buildService({ debtRepo: { findByIdAndUser: async () => null } });

      await expect(service.getDebtById('debt-1', 'user-1')).rejects.toThrow('Deuda no encontrada');
    });

    it('devuelve la deuda si existe', async () => {
      const debt = fakeDebt();
      const service = buildService({ debtRepo: { findByIdAndUser: async () => debt } });

      await expect(service.getDebtById('debt-1', 'user-1')).resolves.toEqual(debt);
    });
  });

  describe('createDebt / updateDebt / deleteDebt', () => {
    it('createDebt devuelve la deuda creada', async () => {
      const created = fakeDebt({ creditor: 'Nuevo acreedor' });
      const service = buildService({ debtRepo: { create: async () => created } });

      await expect(
        service.createDebt('user-1', {
          creditor: 'Nuevo acreedor',
          description: 'desc',
          totalAmount: 1000,
        })
      ).resolves.toEqual(created);
    });

    it('updateDebt devuelve la deuda actualizada', async () => {
      const existing = fakeDebt();
      const updated = fakeDebt({ creditor: 'Actualizado' });
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => existing, update: async () => updated },
      });

      await expect(
        service.updateDebt('debt-1', 'user-1', { creditor: 'Actualizado' })
      ).resolves.toEqual(updated);
    });

    it('deleteDebt devuelve el mensaje de confirmación', async () => {
      const service = buildService({ debtRepo: { findByIdAndUser: async () => fakeDebt() } });

      await expect(service.deleteDebt('debt-1', 'user-1')).resolves.toEqual({
        message: 'Deuda eliminada correctamente',
      });
    });
  });

  describe('payDebt', () => {
    it('lanza NotFoundError si la deuda no existe', async () => {
      const service = buildService({ debtRepo: { findByIdAndUser: async () => null } });

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Deuda no encontrada');
    });

    it('lanza ConflictError si la deuda ya está pagada', async () => {
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt({ status: 'paid' }) },
      });

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Esta deuda ya está pagada');
    });

    it('propaga NotFoundError si la cuenta no existe (vía AccountsService)', async () => {
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: {
          getAccountById: async () => {
            throw new NotFoundError('Cuenta no encontrada');
          },
        },
      });

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Cuenta no encontrada');
    });

    it('lanza ValidationError si el saldo es insuficiente', async () => {
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: { getAccountById: async () => fakeAccount({ balance: 10 }) },
      });

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Saldo insuficiente en la cuenta');
    });

    it('en éxito invoca $transaction y devuelve { debt, payment, transaction }', async () => {
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: { getAccountById: async () => fakeAccount({ balance: 1000 }) },
        recurringRepo: { findFirst: async () => null },
      });

      const result = await service.payDebt('debt-1', 'user-1', {
        amount: 50,
        accountId: 'account-1',
      });

      expect(result.payment.id).toBe('payment-1');
      expect(result.transaction.id).toBe('transaction-1');
    });
  });

  describe('handleRecurringPaymentSideEffects (vía payDebt, usa TransactionsService)', () => {
    const recurringPayment = {
      id: 'rp-1',
      debtId: 'debt-1',
      isActive: true,
      frequency: 'monthly',
      dayOfMonth: 5,
      dayOfWeek: null,
      nextDueDate: new Date(),
      lastProcessed: null,
    };
    const fixedExpense = {
      id: 'fe-1',
      name: 'Pago recurrente',
      categoryId: 'category-1',
      userId: 'user-1',
      recurringDebtPaymentId: 'rp-1',
      isActive: true,
    };

    it('sin pago del gasto fijo este mes: llama a createTransaction', async () => {
      const createTransaction = vi.fn().mockResolvedValue(fakeTransaction());
      const update = vi.fn().mockResolvedValue(recurringPayment);
      mockedFindFirstFixedExpense.mockResolvedValue(fixedExpense);
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: { getAccountById: async () => fakeAccount({ balance: 1000 }) },
        recurringRepo: { findFirst: async () => recurringPayment, update },
        transactionsService: {
          createTransaction,
          findFixedExpensePaymentInMonth: async () => null,
        },
      });

      await service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' });

      expect(createTransaction).toHaveBeenCalledTimes(1);
    });

    it('con pago del gasto fijo ya existente este mes: no duplica la transacción', async () => {
      const createTransaction = vi.fn().mockResolvedValue(fakeTransaction());
      mockedFindFirstFixedExpense.mockResolvedValue(fixedExpense);
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: { getAccountById: async () => fakeAccount({ balance: 1000 }) },
        recurringRepo: {
          findFirst: async () => recurringPayment,
          update: async () => recurringPayment,
        },
        transactionsService: {
          createTransaction,
          findFixedExpensePaymentInMonth: async () => fakeTransaction({ id: 'existing-tx' }),
        },
      });

      await service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' });

      expect(createTransaction).not.toHaveBeenCalled();
    });

    it('createTransaction lanza: el error se traga y payDebt igual resuelve exitosamente', async () => {
      const createTransaction = vi.fn().mockRejectedValue(new Error('fallo al crear transacción'));
      mockedFindFirstFixedExpense.mockResolvedValue(fixedExpense);
      const service = buildService({
        debtRepo: { findByIdAndUser: async () => fakeDebt() },
        accountsService: { getAccountById: async () => fakeAccount({ balance: 1000 }) },
        recurringRepo: {
          findFirst: async () => recurringPayment,
          update: async () => recurringPayment,
        },
        transactionsService: {
          createTransaction,
          findFixedExpensePaymentInMonth: async () => null,
        },
      });

      const result = await service.payDebt('debt-1', 'user-1', {
        amount: 50,
        accountId: 'account-1',
      });

      expect(createTransaction).toHaveBeenCalledTimes(1);
      expect(result.payment.id).toBe('payment-1');
    });
  });
});
