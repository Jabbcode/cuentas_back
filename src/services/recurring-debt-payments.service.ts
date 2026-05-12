import type { Prisma } from '@prisma/client';
import type {
  CreateRecurringDebtPaymentInput,
  UpdateRecurringDebtPaymentInput,
} from '../schemas/recurring-debt-payment.schema.js';
import * as debtsService from './debts.service.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { calculateNextDueDate } from '../lib/utils/date.utils.js';
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js';
import * as debtRepo from '../repositories/debt.repository.js';
import * as accountRepo from '../repositories/account.repository.js';

/**
 * Create a new recurring debt payment
 */
export async function createRecurringDebtPayment(
  userId: string,
  data: CreateRecurringDebtPaymentInput
) {
  // Verify debt exists and belongs to user
  const debt = await debtRepo.findByIdAndUser(data.debtId, userId);

  if (!debt) {
    throw new NotFoundError('Deuda no encontrada');
  }

  if (debt.status === 'paid') {
    throw new ConflictError('No se pueden configurar pagos recurrentes para una deuda pagada');
  }

  // Verify account exists and belongs to user
  const account = await accountRepo.findByIdAndUser(data.accountId, userId);

  if (!account) {
    throw new NotFoundError('Cuenta no encontrada');
  }

  // Calculate next due date
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const nextDueDate = calculateNextDueDate(
    data.frequency,
    data.dayOfMonth || null,
    data.dayOfWeek || null,
    startDate
  );

  const recurringPayment = await recurringRepo.create(
    {
      user: { connect: { id: userId } },
      debt: { connect: { id: data.debtId } },
      amount: data.amount,
      account: { connect: { id: data.accountId } },
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextDueDate,
      notes: data.notes,
    },
    {
      account: { select: { id: true, name: true } },
      debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
    }
  );

  return recurringPayment;
}

/**
 * Get all recurring payments for a user
 */
export async function getRecurringDebtPayments(userId: string, debtId?: string) {
  const recurringPayments = await recurringRepo.findAllByUser(userId, debtId, {
    account: { select: { id: true, name: true, balance: true } },
    debt: {
      select: { id: true, creditor: true, description: true, remainingAmount: true, status: true },
    },
  });

  return recurringPayments;
}

/**
 * Get a single recurring payment by ID
 */
export async function getRecurringDebtPaymentById(id: string, userId: string) {
  const recurringPayment = await recurringRepo.findByIdAndUser(id, userId, {
    account: { select: { id: true, name: true, balance: true } },
    debt: {
      select: { id: true, creditor: true, description: true, remainingAmount: true, status: true },
    },
  });

  if (!recurringPayment) {
    throw new NotFoundError('Pago recurrente no encontrado');
  }

  return recurringPayment;
}

/**
 * Update a recurring payment
 */
export async function updateRecurringDebtPayment(
  id: string,
  userId: string,
  data: UpdateRecurringDebtPaymentInput
) {
  const existing = await recurringRepo.findByIdAndUser(id, userId);

  if (!existing) {
    throw new NotFoundError('Pago recurrente no encontrado');
  }

  // If frequency changes, recalculate nextDueDate
  let nextDueDate = existing.nextDueDate;
  if (data.frequency || data.dayOfMonth !== undefined || data.dayOfWeek !== undefined) {
    const frequency = data.frequency || existing.frequency;
    const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;

    nextDueDate = calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, new Date());
  }

  const updated = await recurringRepo.update(
    id,
    {
      amount: data.amount,
      accountId: data.accountId,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      isActive: data.isActive,
      notes: data.notes,
      nextDueDate,
    } as unknown as Prisma.RecurringDebtPaymentUpdateInput,
    {
      account: { select: { id: true, name: true } },
      debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
    }
  );

  return updated;
}

/**
 * Delete a recurring payment
 */
export async function deleteRecurringDebtPayment(id: string, userId: string) {
  const recurringPayment = await recurringRepo.findByIdAndUser(id, userId);

  if (!recurringPayment) {
    throw new NotFoundError('Pago recurrente no encontrado');
  }

  await recurringRepo.remove(id);

  return { message: 'Pago recurrente eliminado correctamente' };
}

/**
 * Process pending recurring payments (should be called daily via cron/scheduler)
 */
export async function processPendingRecurringPayments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all active recurring payments that are due
  type RdpWithDebtAccount = Prisma.RecurringDebtPaymentGetPayload<{
    include: { debt: true; account: true };
  }>;
  const duePayments = (await recurringRepo.findDuePayments(today, {
    debt: true,
    account: true,
  })) as unknown as RdpWithDebtAccount[];

  const results = [];

  for (const recurringPayment of duePayments) {
    try {
      // Check if end date has passed
      if (recurringPayment.endDate && new Date(recurringPayment.endDate) < today) {
        // Deactivate if end date passed
        await recurringRepo.update(recurringPayment.id, { isActive: false });
        results.push({
          id: recurringPayment.id,
          status: 'deactivated',
          reason: 'End date reached',
        });
        continue;
      }

      // Check if account has sufficient balance
      if (Number(recurringPayment.account.balance) < Number(recurringPayment.amount)) {
        results.push({
          id: recurringPayment.id,
          status: 'skipped',
          reason: 'Insufficient balance',
        });
        continue;
      }

      // Process the payment
      await debtsService.payDebt(recurringPayment.debtId, recurringPayment.userId, {
        amount: Number(recurringPayment.amount),
        accountId: recurringPayment.accountId,
        notes: `Pago automático (recurrente) - ${recurringPayment.notes || ''}`,
      });

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(
        recurringPayment.frequency,
        recurringPayment.dayOfMonth,
        recurringPayment.dayOfWeek,
        today
      );

      // Update recurring payment
      await recurringRepo.update(recurringPayment.id, { lastProcessed: today, nextDueDate });

      results.push({ id: recurringPayment.id, status: 'processed', nextDueDate });
    } catch (error: any) {
      results.push({
        id: recurringPayment.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  return {
    processed: results.filter((r) => r.status === 'processed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    deactivated: results.filter((r) => r.status === 'deactivated').length,
    results,
  };
}
