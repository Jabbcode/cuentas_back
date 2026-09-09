import { describe, it, expect, vi } from 'vitest';
import type { Account, Debt, RecurringDebtPayment } from '@prisma/client';
import type { RecurringDebtPaymentRepository } from '../../../repositories/interfaces/recurring-debt-payment.repository.port.js';
import type { AccountsService } from '../../interfaces/accounts.service.port.js';
import type { DebtsService } from '../../interfaces/debts.service.port.js';
import { NotFoundError } from '../../../lib/errors.js';
import { DEBT_MESSAGES } from '../../../lib/constants/debt.constants.js';
import { RecurringDebtPaymentsServiceImpl } from '../recurring-debt-payments.service.js';

function fakeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    userId: 'user-1',
    creditor: 'Banco Test',
    description: 'Préstamo test',
    totalAmount: 1000,
    remainingAmount: 500,
    status: 'active',
    dueDate: null,
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

function fakeRdp(overrides: Partial<RecurringDebtPayment> = {}): RecurringDebtPayment {
  return {
    id: 'rdp-1',
    debtId: 'debt-1',
    userId: 'user-1',
    amount: 50,
    accountId: 'account-1',
    frequency: 'monthly',
    dayOfMonth: 5,
    dayOfWeek: null,
    isActive: true,
    startDate: new Date(),
    endDate: null,
    lastProcessed: null,
    nextDueDate: new Date(),
    notes: null,
    ...overrides,
  } as unknown as RecurringDebtPayment;
}

function fakeRecurringRepo(
  overrides: Partial<RecurringDebtPaymentRepository> = {}
): RecurringDebtPaymentRepository {
  return {
    create: async () => ({ ...fakeRdp(), account: fakeAccount(), debt: fakeDebt() }) as never,
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findUnique: async () => null,
    findDuePayments: async () => [],
    update: async () => fakeRdp(),
    remove: async () => undefined,
    ...overrides,
  };
}

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => fakeAccount(),
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

function fakeDebtsService(overrides: Partial<DebtsService> = {}): DebtsService {
  return {
    createDebt: async () => fakeDebt(),
    getDebts: async () => [],
    getDebtById: async () => fakeDebt() as never,
    updateDebt: async () => fakeDebt(),
    deleteDebt: async () => ({ message: 'Deuda eliminada correctamente' }),
    payDebt: async () => {
      throw new Error('not used in these tests');
    },
    getDebtsSummary: async () => ({
      totalActiveDebts: 0,
      totalOverdueDebts: 0,
      totalDebtAmount: 0,
      totalOverdueAmount: 0,
      debtsDueSoon: 0,
      upcomingDebts: [],
    }),
    countByUser: async () => 0,
    ...overrides,
  };
}

describe('RecurringDebtPaymentsServiceImpl', () => {
  describe('createRecurringDebtPayment (usa DebtsService.getDebtById)', () => {
    const validInput = {
      debtId: 'debt-1',
      amount: 50,
      accountId: 'account-1',
      frequency: 'monthly' as const,
      dayOfMonth: 5,
    };

    it('lanza NotFoundError si la deuda no existe', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo(),
        fakeAccountsService(),
        fakeDebtsService({
          getDebtById: async () => {
            throw new NotFoundError(DEBT_MESSAGES.NOT_FOUND);
          },
        })
      );

      await expect(service.createRecurringDebtPayment('user-1', validInput)).rejects.toThrow(
        'Deuda no encontrada'
      );
    });

    it('lanza ConflictError si la deuda ya está pagada', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo(),
        fakeAccountsService(),
        fakeDebtsService({ getDebtById: async () => fakeDebt({ status: 'paid' }) as never })
      );

      await expect(service.createRecurringDebtPayment('user-1', validInput)).rejects.toThrow(
        'No se pueden configurar pagos recurrentes para una deuda pagada'
      );
    });

    it('propaga NotFoundError si la cuenta no existe (vía AccountsService)', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo(),
        fakeAccountsService({
          getAccountById: async () => {
            throw new NotFoundError('Cuenta no encontrada');
          },
        }),
        fakeDebtsService()
      );

      await expect(service.createRecurringDebtPayment('user-1', validInput)).rejects.toThrow(
        'Cuenta no encontrada'
      );
    });

    it('en éxito devuelve el pago recurrente creado', async () => {
      const created = { ...fakeRdp(), account: fakeAccount(), debt: fakeDebt() };
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ create: async () => created as never }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      const result = await service.createRecurringDebtPayment('user-1', validInput);
      expect(result.id).toBe('rdp-1');
    });
  });

  describe('getRecurringDebtPaymentById', () => {
    it('lanza NotFoundError si no existe', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => null }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.getRecurringDebtPaymentById('rdp-1', 'user-1')).rejects.toThrow(
        'Pago recurrente no encontrado'
      );
    });

    it('devuelve el pago recurrente si existe y pertenece al usuario', async () => {
      const found = { ...fakeRdp(), account: fakeAccount(), debt: fakeDebt() };
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => found as never }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.getRecurringDebtPaymentById('rdp-1', 'user-1')).resolves.toEqual(found);
    });
  });

  describe('getRecurringDebtPayments', () => {
    it('delega en el repositorio filtrando por userId y, opcionalmente, debtId', async () => {
      const calls: unknown[] = [];
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findAllByUser: async (userId, debtId) => {
            calls.push({ userId, debtId });
            return [];
          },
        }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await service.getRecurringDebtPayments('user-1');
      await service.getRecurringDebtPayments('user-1', 'debt-1');

      expect(calls).toEqual([
        { userId: 'user-1', debtId: undefined },
        { userId: 'user-1', debtId: 'debt-1' },
      ]);
    });
  });

  describe('updateRecurringDebtPayment', () => {
    it('lanza NotFoundError si no pertenece al usuario', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => null }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(
        service.updateRecurringDebtPayment('rdp-1', 'user-1', { amount: 100 })
      ).rejects.toThrow('Pago recurrente no encontrado');
    });

    it('sin cambio de frecuencia/día: conserva el nextDueDate existente', async () => {
      const update = vi.fn().mockResolvedValue(fakeRdp());
      const existing = fakeRdp({ nextDueDate: new Date('2026-07-05') });
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => existing, update }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await service.updateRecurringDebtPayment('rdp-1', 'user-1', { amount: 100 });

      expect(update).toHaveBeenCalledWith(
        'rdp-1',
        expect.objectContaining({ amount: 100, nextDueDate: existing.nextDueDate }),
        expect.anything()
      );
    });

    it('cambia frequency: recalcula nextDueDate usando los valores existentes de día', async () => {
      const update = vi.fn().mockResolvedValue(fakeRdp());
      const existing = fakeRdp({ frequency: 'monthly', dayOfMonth: 5, dayOfWeek: null });
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => existing, update }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await service.updateRecurringDebtPayment('rdp-1', 'user-1', { frequency: 'weekly' });

      const [, data] = update.mock.calls[0];
      expect(data.nextDueDate).toBeInstanceOf(Date);
      expect(data.nextDueDate).not.toEqual(existing.nextDueDate);
    });

    it('cambia solo dayOfMonth: recalcula nextDueDate conservando la frecuencia existente', async () => {
      const update = vi.fn().mockResolvedValue(fakeRdp());
      const existing = fakeRdp({ frequency: 'monthly', dayOfMonth: 5, dayOfWeek: null });
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => existing, update }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await service.updateRecurringDebtPayment('rdp-1', 'user-1', { dayOfMonth: 20 });

      expect(update).toHaveBeenCalledWith(
        'rdp-1',
        expect.objectContaining({ dayOfMonth: 20, nextDueDate: expect.any(Date) }),
        expect.anything()
      );
    });

    it('devuelve el pago recurrente actualizado', async () => {
      const updated = { ...fakeRdp({ amount: 200 }), account: fakeAccount(), debt: fakeDebt() };
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findByIdAndUser: async () => fakeRdp(),
          update: async () => updated as never,
        }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(
        service.updateRecurringDebtPayment('rdp-1', 'user-1', { amount: 200 })
      ).resolves.toEqual(updated);
    });
  });

  describe('deleteRecurringDebtPayment', () => {
    it('lanza NotFoundError si no pertenece al usuario, y no llama remove', async () => {
      const remove = vi.fn();
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => null, remove }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.deleteRecurringDebtPayment('rdp-1', 'user-1')).rejects.toThrow(
        'Pago recurrente no encontrado'
      );
      expect(remove).not.toHaveBeenCalled();
    });

    it('elimina y devuelve el mensaje de confirmación', async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findByIdAndUser: async () => fakeRdp(), remove }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.deleteRecurringDebtPayment('rdp-1', 'user-1')).resolves.toEqual({
        message: expect.any(String),
      });
      expect(remove).toHaveBeenCalledWith('rdp-1');
    });
  });

  describe('processPendingRecurringPayments', () => {
    it('con findDuePayments vacío, retorna los contadores en cero', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findDuePayments: async () => [] }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.processPendingRecurringPayments()).resolves.toEqual({
        processed: 0,
        skipped: 0,
        errors: 0,
        deactivated: 0,
        results: [],
      });
    });

    it('pago con endDate ya pasado: deactivated, actualiza isActive:false y no llama payDebt', async () => {
      const payDebtCalls: unknown[] = [];
      const updateCalls: unknown[] = [];
      const pastEndDate = fakeRdp({
        id: 'rdp-expired',
        endDate: new Date('2020-01-01'),
      });

      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findDuePayments: async () =>
            [{ ...pastEndDate, account: fakeAccount(), debt: fakeDebt() }] as never,
          update: async (id, data) => {
            updateCalls.push({ id, data });
            return fakeRdp();
          },
        }),
        fakeAccountsService(),
        fakeDebtsService({
          payDebt: async (...args) => {
            payDebtCalls.push(args);
            throw new Error('should not be called');
          },
        })
      );

      const result = await service.processPendingRecurringPayments();

      expect(result.deactivated).toBe(1);
      expect(result.processed).toBe(0);
      expect(payDebtCalls.length).toBe(0);
      expect(updateCalls).toEqual([{ id: 'rdp-expired', data: { isActive: false } }]);
    });

    it('pago vencido con saldo suficiente: invoca payDebt y cuenta como processed', async () => {
      const payDebtCalls: unknown[] = [];
      const due = fakeRdp({ id: 'rdp-ok', amount: 50 });

      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findDuePayments: async () =>
            [{ ...due, account: fakeAccount({ balance: 1000 }), debt: fakeDebt() }] as never,
          update: async () => fakeRdp(),
        }),
        fakeAccountsService(),
        fakeDebtsService({
          payDebt: async (...args) => {
            payDebtCalls.push(args);
            return {
              debt: fakeDebt() as never,
              payment: {} as never,
              transaction: {} as never,
            };
          },
        })
      );

      const result = await service.processPendingRecurringPayments();

      expect(result.processed).toBe(1);
      expect(payDebtCalls.length).toBe(1);
    });

    it('pago vencido con saldo insuficiente: skipped, sin llamar payDebt', async () => {
      const payDebtCalls: unknown[] = [];
      const due = fakeRdp({ id: 'rdp-insufficient', amount: 500 });

      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findDuePayments: async () =>
            [{ ...due, account: fakeAccount({ balance: 10 }), debt: fakeDebt() }] as never,
        }),
        fakeAccountsService(),
        fakeDebtsService({
          payDebt: async (...args) => {
            payDebtCalls.push(args);
            throw new Error('should not be called');
          },
        })
      );

      const result = await service.processPendingRecurringPayments();

      expect(result.skipped).toBe(1);
      expect(payDebtCalls.length).toBe(0);
    });

    it('un pago cuyo payDebt lanza no aborta el resto del lote', async () => {
      const failing = fakeRdp({ id: 'rdp-fail', debtId: 'debt-fail', amount: 50 });
      const ok = fakeRdp({ id: 'rdp-ok', debtId: 'debt-ok', amount: 50 });

      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          findDuePayments: async () =>
            [
              { ...failing, account: fakeAccount({ balance: 1000 }), debt: fakeDebt() },
              { ...ok, account: fakeAccount({ balance: 1000 }), debt: fakeDebt() },
            ] as never,
          update: async () => fakeRdp(),
        }),
        fakeAccountsService(),
        fakeDebtsService({
          payDebt: async (debtId) => {
            if (debtId === 'debt-fail') throw new Error('boom');
            return { debt: fakeDebt() as never, payment: {} as never, transaction: {} as never };
          },
        })
      );

      const result = await service.processPendingRecurringPayments();

      expect(result.errors).toBe(1);
      expect(result.processed).toBe(1);
    });
  });

  describe('findRecurringPaymentById (Fase 6 — null-returning, sin ownership)', () => {
    it('devuelve null si el repo no lo encuentra', async () => {
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findUnique: async () => null }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.findRecurringPaymentById('rdp-1')).resolves.toBeNull();
    });

    it('devuelve el pago recurrente si existe (sin exigir userId)', async () => {
      const rdp = fakeRdp();
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({ findUnique: async () => rdp }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      await expect(service.findRecurringPaymentById('rdp-1')).resolves.toEqual(rdp);
    });
  });

  describe('updateRecurringPaymentFields (Fase 6 — persistencia plana, sin ownership check)', () => {
    it('delega en recurringRepo.update con los campos recibidos', async () => {
      const calls: unknown[] = [];
      const updated = fakeRdp({ nextDueDate: new Date('2026-08-05') });
      const service = new RecurringDebtPaymentsServiceImpl(
        fakeRecurringRepo({
          update: async (id, data) => {
            calls.push({ id, data });
            return updated;
          },
        }),
        fakeAccountsService(),
        fakeDebtsService()
      );

      const data = { nextDueDate: new Date('2026-08-05') };
      await expect(service.updateRecurringPaymentFields('rdp-1', data)).resolves.toEqual(updated);
      expect(calls).toEqual([{ id: 'rdp-1', data }]);
    });
  });
});
