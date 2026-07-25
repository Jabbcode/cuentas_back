import { describe, it, expect } from 'vitest';
import type { Account, Debt, DebtPayment, Transaction, PrismaClient } from '@prisma/client';
import type { DebtRepository } from '../../repositories/debt.repository.port.js';
import type { RecurringDebtPaymentRepository } from '../../repositories/recurring-debt-payment.repository.port.js';
import type { AccountsService } from '../accounts.service.port.js';
import { NotFoundError } from '../../lib/errors.js';
import { DebtsServiceImpl } from '../debts.service.js';

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

describe('DebtsServiceImpl', () => {
  describe('getDebtById', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => null }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(service.getDebtById('debt-1', 'user-1')).rejects.toThrow('Deuda no encontrada');
    });

    it('devuelve la deuda si existe', async () => {
      const debt = fakeDebt();
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => debt }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(service.getDebtById('debt-1', 'user-1')).resolves.toEqual(debt);
    });
  });

  describe('createDebt / updateDebt / deleteDebt', () => {
    it('createDebt devuelve la deuda creada', async () => {
      const created = fakeDebt({ creditor: 'Nuevo acreedor' });
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ create: async () => created }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

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
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => existing, update: async () => updated }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(
        service.updateDebt('debt-1', 'user-1', { creditor: 'Actualizado' })
      ).resolves.toEqual(updated);
    });

    it('deleteDebt devuelve el mensaje de confirmación', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => fakeDebt() }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(service.deleteDebt('debt-1', 'user-1')).resolves.toEqual({
        message: 'Deuda eliminada correctamente',
      });
    });
  });

  describe('payDebt', () => {
    it('lanza NotFoundError si la deuda no existe', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => null }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Deuda no encontrada');
    });

    it('lanza ConflictError si la deuda ya está pagada', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => fakeDebt({ status: 'paid' }) }),
        fakeAccountsService(),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Esta deuda ya está pagada');
    });

    it('propaga NotFoundError si la cuenta no existe (vía AccountsService)', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => fakeDebt() }),
        fakeAccountsService({
          getAccountById: async () => {
            throw new NotFoundError('Cuenta no encontrada');
          },
        }),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Cuenta no encontrada');
    });

    it('lanza ValidationError si el saldo es insuficiente', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => fakeDebt() }),
        fakeAccountsService({ getAccountById: async () => fakeAccount({ balance: 10 }) }),
        fakeRecurringRepo(),
        fakePrisma()
      );

      await expect(
        service.payDebt('debt-1', 'user-1', { amount: 50, accountId: 'account-1' })
      ).rejects.toThrow('Saldo insuficiente en la cuenta');
    });

    it('en éxito invoca $transaction y devuelve { debt, payment, transaction }', async () => {
      const service = new DebtsServiceImpl(
        fakeDebtRepo({ findByIdAndUser: async () => fakeDebt() }),
        fakeAccountsService({ getAccountById: async () => fakeAccount({ balance: 1000 }) }),
        fakeRecurringRepo({ findFirst: async () => null }),
        fakePrisma()
      );

      const result = await service.payDebt('debt-1', 'user-1', {
        amount: 50,
        accountId: 'account-1',
      });

      expect(result.payment.id).toBe('payment-1');
      expect(result.transaction.id).toBe('transaction-1');
    });
  });
});
