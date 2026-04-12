import { prisma } from '../lib/prisma.js';
import type {
  CreateRecurringDebtPaymentInput,
  UpdateRecurringDebtPaymentInput,
} from '../schemas/recurring-debt-payment.schema.js';
import * as debtsService from './debts.service.js';

/**
 * Calculate the next due date based on frequency and current date
 */
export function calculateNextDueDate(
  frequency: string,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  fromDate: Date = new Date()
): Date {
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);

  if (frequency === 'monthly') {
    // Monthly: next occurrence of dayOfMonth
    const targetDay = dayOfMonth || 1;
    nextDate.setDate(targetDay);

    // Si la fecha ya pasó este mes, ir al próximo mes
    if (nextDate <= today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(targetDay);
    }
  } else if (frequency === 'biweekly') {
    // Biweekly: add 14 days
    nextDate.setDate(nextDate.getDate() + 14);
  } else if (frequency === 'weekly') {
    // Weekly: next occurrence of dayOfWeek
    const currentDay = nextDate.getDay();
    const targetDay = dayOfWeek || 0;
    const daysUntilNext = (targetDay - currentDay + 7) % 7 || 7;
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
  }

  // Set time to start of day
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

/**
 * Create a new recurring debt payment
 */
export async function createRecurringDebtPayment(
  userId: string,
  data: CreateRecurringDebtPaymentInput
) {
  // Verify debt exists and belongs to user
  const debt = await prisma.debt.findFirst({
    where: { id: data.debtId, userId },
  });

  if (!debt) {
    throw new Error('Deuda no encontrada');
  }

  if (debt.status === 'paid') {
    throw new Error('No se pueden configurar pagos recurrentes para una deuda pagada');
  }

  // Verify account exists and belongs to user
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');
  }

  // Calculate next due date
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const nextDueDate = calculateNextDueDate(
    data.frequency,
    data.dayOfMonth || null,
    data.dayOfWeek || null,
    startDate
  );

  const recurringPayment = await prisma.recurringDebtPayment.create({
    data: {
      userId,
      debtId: data.debtId,
      amount: data.amount,
      accountId: data.accountId,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextDueDate,
      notes: data.notes,
    },
    include: {
      account: { select: { id: true, name: true } },
      debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
    },
  });

  return recurringPayment;
}

/**
 * Get all recurring payments for a user
 */
export async function getRecurringDebtPayments(userId: string, debtId?: string) {
  const where: any = { userId };
  if (debtId) {
    where.debtId = debtId;
  }

  const recurringPayments = await prisma.recurringDebtPayment.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, balance: true } },
      debt: {
        select: {
          id: true,
          creditor: true,
          description: true,
          remainingAmount: true,
          status: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
  });

  return recurringPayments;
}

/**
 * Get a single recurring payment by ID
 */
export async function getRecurringDebtPaymentById(id: string, userId: string) {
  const recurringPayment = await prisma.recurringDebtPayment.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true, balance: true } },
      debt: {
        select: {
          id: true,
          creditor: true,
          description: true,
          remainingAmount: true,
          status: true,
        },
      },
    },
  });

  if (!recurringPayment) {
    throw new Error('Pago recurrente no encontrado');
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
  const existing = await prisma.recurringDebtPayment.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error('Pago recurrente no encontrado');
  }

  // If frequency changes, recalculate nextDueDate
  let nextDueDate = existing.nextDueDate;
  if (
    data.frequency ||
    data.dayOfMonth !== undefined ||
    data.dayOfWeek !== undefined
  ) {
    const frequency = data.frequency || existing.frequency;
    const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;

    nextDueDate = calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, new Date());
  }

  const updated = await prisma.recurringDebtPayment.update({
    where: { id },
    data: {
      amount: data.amount,
      accountId: data.accountId,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      isActive: data.isActive,
      notes: data.notes,
      nextDueDate,
    },
    include: {
      account: { select: { id: true, name: true } },
      debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
    },
  });

  return updated;
}

/**
 * Delete a recurring payment
 */
export async function deleteRecurringDebtPayment(id: string, userId: string) {
  const recurringPayment = await prisma.recurringDebtPayment.findFirst({
    where: { id, userId },
  });

  if (!recurringPayment) {
    throw new Error('Pago recurrente no encontrado');
  }

  await prisma.recurringDebtPayment.delete({
    where: { id },
  });

  return { message: 'Pago recurrente eliminado correctamente' };
}

/**
 * Process pending recurring payments (should be called daily via cron/scheduler)
 */
export async function processPendingRecurringPayments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all active recurring payments that are due
  const duePayments = await prisma.recurringDebtPayment.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: today },
      debt: {
        status: { not: 'paid' },
      },
    },
    include: {
      debt: true,
      account: true,
    },
  });

  const results = [];

  for (const recurringPayment of duePayments) {
    try {
      // Check if end date has passed
      if (recurringPayment.endDate && new Date(recurringPayment.endDate) < today) {
        // Deactivate if end date passed
        await prisma.recurringDebtPayment.update({
          where: { id: recurringPayment.id },
          data: { isActive: false },
        });
        results.push({ id: recurringPayment.id, status: 'deactivated', reason: 'End date reached' });
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
      await debtsService.payDebt(
        recurringPayment.debtId,
        recurringPayment.userId,
        {
          amount: Number(recurringPayment.amount),
          accountId: recurringPayment.accountId,
          notes: `Pago automático (recurrente) - ${recurringPayment.notes || ''}`,
        }
      );

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(
        recurringPayment.frequency,
        recurringPayment.dayOfMonth,
        recurringPayment.dayOfWeek,
        today
      );

      // Update recurring payment
      await prisma.recurringDebtPayment.update({
        where: { id: recurringPayment.id },
        data: {
          lastProcessed: today,
          nextDueDate,
        },
      });

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
