import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { CreateDebtInput, UpdateDebtInput, PayDebtInput } from '../schemas/debt.schema.js';
import { calculateNextDueDate } from '../lib/utils/date.utils.js';
import { createTransaction } from './transactions.service.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import { calculateDebtPaymentBreakdown, getDebtStatus } from '../lib/utils/debt.utils.js';
import * as debtRepo from '../repositories/debt.repository.js';
import * as accountRepo from '../repositories/account.repository.js';
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';

/**
 * Create a new debt
 */
export async function createDebt(userId: string, data: CreateDebtInput) {
  const debt = await debtRepo.create({
    user: { connect: { id: userId } },
    creditor: data.creditor,
    description: data.description,
    totalAmount: data.totalAmount,
    remainingAmount: data.totalAmount,
    interestRate: data.interestRate,
    interestType: data.interestType,
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    status: 'active',
  });

  return debt;
}

/**
 * Get all debts for a user with optional filters
 */
export async function getDebts(userId: string, status?: string) {
  const where: Prisma.DebtWhereInput = { userId };

  if (status) {
    where.status = status;
  }

  const debts = await debtRepo.findAllByUser(where, {
    payments: {
      include: { account: { select: { id: true, name: true } } },
      orderBy: { paymentDate: 'desc' },
    },
    _count: { select: { payments: true } },
  } as Prisma.DebtInclude);

  return debts;
}

/**
 * Get a single debt by ID
 */
export async function getDebtById(debtId: string, userId: string) {
  const debt = await debtRepo.findByIdAndUser(debtId, userId, {
    payments: {
      include: { account: { select: { id: true, name: true } } },
      orderBy: { paymentDate: 'desc' },
    },
  } as Prisma.DebtInclude);

  if (!debt) {
    throw new NotFoundError('Deuda no encontrada');
  }

  return debt;
}

/**
 * Update a debt
 */
export async function updateDebt(debtId: string, userId: string, data: UpdateDebtInput) {
  const existingDebt = await debtRepo.findByIdAndUser(debtId, userId);

  if (!existingDebt) {
    throw new NotFoundError('Deuda no encontrada');
  }

  const debt = await debtRepo.update(debtId, {
    creditor: data.creditor,
    description: data.description,
    interestRate: data.interestRate,
    interestType: data.interestType,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    status: data.status,
  });

  return debt;
}

/**
 * Delete a debt
 */
export async function deleteDebt(debtId: string, userId: string) {
  const debt = await debtRepo.findByIdAndUser(debtId, userId);

  if (!debt) {
    throw new NotFoundError('Deuda no encontrada');
  }

  // Cascade delete will handle payments and transactions
  await debtRepo.remove(debtId);

  return { message: 'Deuda eliminada correctamente' };
}

async function handleRecurringPaymentSideEffects(
  debtId: string,
  userId: string,
  accountId: string,
  amount: number
): Promise<void> {
  const recurringPayment = await recurringRepo.findFirst({
    debtId,
    isActive: true,
    frequency: 'monthly',
  });

  if (!recurringPayment) return;

  const newNextDueDate = calculateNextDueDate(
    recurringPayment.frequency,
    recurringPayment.dayOfMonth,
    recurringPayment.dayOfWeek,
    new Date()
  );

  await recurringRepo.update(recurringPayment.id, {
    nextDueDate: newNextDueDate,
    lastProcessed: new Date(),
  });

  const fixedExpense = await fixedExpenseRepo.findFirst({
    userId,
    recurringDebtPaymentId: recurringPayment.id,
    isActive: true,
  });

  if (!fixedExpense) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const existingPayment = await transactionRepo.findFirst({
    fixedExpenseId: fixedExpense.id,
    date: { gte: startOfMonth, lte: endOfMonth },
  });

  if (!existingPayment) {
    try {
      await createTransaction(
        {
          amount,
          type: 'expense',
          description: `Pago: ${fixedExpense.name}`,
          date: new Date().toISOString(),
          accountId,
          categoryId: fixedExpense.categoryId,
          fixedExpenseId: fixedExpense.id,
        },
        userId
      );
    } catch (error) {
      // Silent: fixed expense transaction failure must not roll back the debt payment
    }
  }
}

/**
 * Pay a debt (partial or full)
 */
export async function payDebt(debtId: string, userId: string, data: PayDebtInput) {
  const debt = await debtRepo.findByIdAndUser(debtId, userId);
  if (!debt) throw new NotFoundError('Deuda no encontrada');
  if (debt.status === 'paid') throw new ConflictError('Esta deuda ya está pagada');
  const account = await accountRepo.findByIdAndUser(data.accountId, userId);
  if (!account) throw new NotFoundError('Cuenta no encontrada');
  if (Number(account.balance) < data.amount)
    throw new ValidationError('Saldo insuficiente en la cuenta');
  const { principal, interest, newRemainingAmount } = calculateDebtPaymentBreakdown(
    Number(debt.remainingAmount),
    data.amount,
    debt.interestRate ? Number(debt.interestRate) : null,
    debt.interestType
  );
  const result = await prisma.$transaction(async (tx) => {
    let cat = await tx.category.findFirst({
      where: { userId, name: 'Pago de deuda', type: 'expense' },
    });
    if (!cat)
      cat = await tx.category.create({
        data: { userId, name: 'Pago de deuda', type: 'expense', icon: '💳', color: '#EF4444' },
      });
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: cat.id,
        amount: data.amount,
        type: 'expense',
        description: `Pago de deuda: ${debt.creditor} - ${debt.description}`,
        date: new Date(),
      },
    });
    await tx.account.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
    const payment = await tx.debtPayment.create({
      data: {
        debtId: debt.id,
        userId,
        accountId: data.accountId,
        amount: data.amount,
        principal,
        interest,
        transactionId: transaction.id,
        notes: data.notes,
        paymentDate: new Date(),
      },
    });
    const updatedDebt = await tx.debt.update({
      where: { id: debt.id },
      data: {
        remainingAmount: newRemainingAmount,
        status: getDebtStatus(newRemainingAmount, debt.dueDate),
      },
      include: { payments: { orderBy: { paymentDate: 'desc' } } },
    });
    return { debt: updatedDebt, payment, transaction };
  });
  await handleRecurringPaymentSideEffects(debt.id, userId, data.accountId, data.amount);
  return result;
}

/**
 * Get debts summary for dashboard
 */
export async function getDebtsSummary(userId: string) {
  const debts = await debtRepo.findAllByUser({ userId });

  const activeDebts = debts.filter((d) => d.status === 'active');
  const overdueDebts = debts.filter((d) => d.status === 'overdue');

  // Total debt should include both active and overdue debts
  const totalActiveAmount = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
  const totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
  const totalDebt = totalActiveAmount + totalOverdueAmount;

  // Get debts due soon (within 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const dueSoon = activeDebts.filter(
    (d) => d.dueDate && d.dueDate <= sevenDaysFromNow && d.dueDate >= new Date()
  );

  return {
    totalActiveDebts: activeDebts.length,
    totalOverdueDebts: overdueDebts.length,
    totalDebtAmount: totalDebt,
    totalOverdueAmount: totalOverdueAmount,
    debtsDueSoon: dueSoon.length,
    upcomingDebts: dueSoon.map((d) => ({
      id: d.id,
      creditor: d.creditor,
      description: d.description,
      remainingAmount: d.remainingAmount,
      dueDate: d.dueDate,
    })),
  };
}
