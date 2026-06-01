import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import {
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  PayFixedExpenseInput,
} from '../schemas/fixed-expense.schema.js';
import { NotFoundError } from '../lib/errors.js';
import { createTransaction } from './transactions.service.js';
import { calculateNextDueDate } from '../lib/utils/date.utils.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js';
import * as accountRepo from '../repositories/account.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';

export async function getFixedExpenses(userId: string, activeOnly = false) {
  return fixedExpenseRepo.findAllByUser(
    userId,
    activeOnly ? { isActive: true } : undefined,
    {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
    [{ dueDay: 'asc' }]
  );
}

export async function getFixedExpenseById(id: string, userId: string) {
  const fixedExpense = await fixedExpenseRepo.findByIdAndUser(id, userId, {
    account: { select: { id: true, name: true, color: true } },
    category: { select: { id: true, name: true, icon: true, color: true } },
    transactions: { orderBy: { date: 'desc' }, take: 12 },
  });

  if (!fixedExpense) {
    throw new NotFoundError('Gasto fijo no encontrado');
  }

  return fixedExpense;
}

export async function createFixedExpense(data: CreateFixedExpenseInput, userId: string) {
  return fixedExpenseRepo.create({ ...data, userId } as unknown as Prisma.FixedExpenseCreateInput, {
    account: { select: { id: true, name: true, color: true } },
    category: { select: { id: true, name: true, icon: true, color: true } },
  });
}

export async function updateFixedExpense(
  id: string,
  data: UpdateFixedExpenseInput,
  userId: string
) {
  const existingExpense = await getFixedExpenseById(id, userId);

  // Preparar actualizaciones para transacciones asociadas
  const transactionUpdates: Prisma.TransactionUncheckedUpdateManyInput = {};

  if (data.categoryId && data.categoryId !== existingExpense.categoryId) {
    transactionUpdates.categoryId = data.categoryId;
  }

  if (data.accountId && data.accountId !== existingExpense.accountId) {
    transactionUpdates.accountId = data.accountId;
  }

  // Si hay cambios en categoría o cuenta, actualizar las transacciones asociadas
  if (Object.keys(transactionUpdates).length > 0) {
    await transactionRepo.updateMany(
      { fixedExpenseId: id, userId },
      transactionUpdates as Prisma.TransactionUpdateManyMutationInput
    );
  }

  // Si este fixed expense está asociado a un recurring debt payment, sincronizar cambios
  if (existingExpense.recurringDebtPaymentId) {
    // Obtener el recurring payment actual para calcular nextDueDate
    const recurringPayment = await recurringRepo.findUnique(existingExpense.recurringDebtPaymentId);

    if (recurringPayment) {
      const recurringPaymentUpdates: any = {};

      if (data.dueDay !== undefined && data.dueDay !== existingExpense.dueDay) {
        recurringPaymentUpdates.dayOfMonth = data.dueDay;
      }

      if (data.amount !== undefined && data.amount !== Number(existingExpense.amount)) {
        recurringPaymentUpdates.amount = data.amount;
      }

      if (data.accountId && data.accountId !== existingExpense.accountId) {
        recurringPaymentUpdates.accountId = data.accountId;
      }

      // Recalcular nextDueDate si cambia dayOfMonth
      if (recurringPaymentUpdates.dayOfMonth !== undefined) {
        recurringPaymentUpdates.nextDueDate = calculateNextDueDate(
          recurringPayment.frequency,
          recurringPaymentUpdates.dayOfMonth,
          recurringPayment.dayOfWeek,
          new Date()
        );
      }

      // Actualizar el recurring debt payment si hay cambios
      if (Object.keys(recurringPaymentUpdates).length > 0) {
        await recurringRepo.update(existingExpense.recurringDebtPaymentId, recurringPaymentUpdates);
      }
    }
  }

  return fixedExpenseRepo.update(id, data as Prisma.FixedExpenseUpdateInput, {
    account: { select: { id: true, name: true, color: true } },
    category: { select: { id: true, name: true, icon: true, color: true } },
  });
}

export async function deleteFixedExpense(id: string, userId: string) {
  await getFixedExpenseById(id, userId);

  return fixedExpenseRepo.remove(id);
}

export async function payFixedExpense(id: string, data: PayFixedExpenseInput, userId: string) {
  const fixedExpense = await getFixedExpenseById(id, userId);

  const amount = data.amount ?? Number(fixedExpense.amount);
  const date = data.date ?? new Date().toISOString();

  const transaction = await createTransaction(
    {
      amount,
      type: fixedExpense.type as 'expense' | 'income',
      description: `Pago: ${fixedExpense.name}`,
      date,
      accountId: fixedExpense.accountId,
      categoryId: fixedExpense.categoryId,
      fixedExpenseId: fixedExpense.id,
    },
    userId
  );

  // If this is a credit card fixed expense, also record the payment in the credit card
  if (fixedExpense.creditCardAccountId) {
    const { payCreditCardStatement } = await import('./credit-cards.service.js');

    try {
      await payCreditCardStatement(fixedExpense.creditCardAccountId, userId, {
        amount,
        paymentAccountId: fixedExpense.accountId,
        paymentDate: date,
      });
    } catch (error) {
      // If payment already exists, ignore error
      if (!(error instanceof Error && error.message.includes('ya está pagado'))) {
        throw error;
      }
    }
  }

  // If this is a recurring debt payment fixed expense, also record the payment in the debt
  if (fixedExpense.recurringDebtPaymentId) {
    const { payDebt } = await import('./debts.service.js');

    try {
      // Get the recurring payment to find the debtId
      const recurringPayment = await recurringRepo.findUnique(fixedExpense.recurringDebtPaymentId);

      if (recurringPayment) {
        await payDebt(recurringPayment.debtId, userId, {
          amount,
          accountId: fixedExpense.accountId,
          notes: `Pago automático desde gasto fijo`,
        });
      }
    } catch (error) {
      // Log error but don't fail the whole transaction
      console.error('Error registering debt payment:', error);
    }
  }

  return transaction;
}

export async function autoGenerateFixedExpenseTransactions(today: Date) {
  const todayDay = today.getDate();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: {
      isActive: true,
      autoGenerate: true,
      dueDay: todayDay,
    },
    include: {
      user: { select: { id: true } },
    },
  });

  const createdByUser: Record<string, number> = {};

  for (const fe of fixedExpenses) {
    const existing = await prisma.transaction.findFirst({
      where: {
        fixedExpenseId: fe.id,
        userId: fe.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (existing) continue;

    await createTransaction(
      {
        amount: Number(fe.amount),
        type: fe.type as 'expense' | 'income',
        description: `Auto: ${fe.name}`,
        date: today.toISOString(),
        accountId: fe.accountId,
        categoryId: fe.categoryId,
        fixedExpenseId: fe.id,
        isAutoGenerated: true,
      },
      fe.userId
    );

    createdByUser[fe.userId] = (createdByUser[fe.userId] ?? 0) + 1;
  }

  return createdByUser;
}

export async function reorderFixedExpenses(
  userId: string,
  itemOrders: { id: string; sortOrder: number }[]
) {
  // Verificar que todos los items pertenecen al usuario
  const itemIds = itemOrders.map((item) => item.id);
  const allItems = await fixedExpenseRepo.findAllByUser(userId, { id: { in: itemIds } });
  const items = allItems.map((fe) => ({ id: fe.id }));

  if (items.length !== itemIds.length) {
    throw new NotFoundError('Algunos gastos fijos no fueron encontrados');
  }

  // Actualizar el orden de cada item
  await prisma.$transaction(
    itemOrders.map(({ id, sortOrder }) =>
      prisma.fixedExpense.update({
        where: { id },
        data: { sortOrder },
      })
    )
  );

  return { success: true };
}

export async function getFixedExpensesSummary(userId: string) {
  // Sync credit card fixed expenses before getting summary
  await syncCreditCardFixedExpenses(userId);

  // Sync recurring debt payment fixed expenses
  await syncRecurringDebtPaymentFixedExpenses(userId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  type FeWithTx = Prisma.FixedExpenseGetPayload<{
    include: { account: true; category: true; transactions: true };
  }>;
  const fixedExpenses = (await fixedExpenseRepo.findAllByUser(
    userId,
    undefined,
    {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: { where: { date: { gte: startOfMonth, lte: endOfMonth } } },
    },
    [{ sortOrder: 'asc' }, { dueDay: 'asc' }]
  )) as unknown as FeWithTx[];

  // Solo contar los activos para los totales mensuales
  const activeFixedExpenses = fixedExpenses.filter((fe) => fe.isActive);

  const totalMonthlyExpenses = activeFixedExpenses
    .filter((fe) => fe.type === 'expense')
    .reduce((sum, fe) => sum + Number(fe.amount), 0);

  const totalMonthlyIncome = activeFixedExpenses
    .filter((fe) => fe.type === 'income')
    .reduce((sum, fe) => sum + Number(fe.amount), 0);

  const paidThisMonth = activeFixedExpenses.filter((fe) => fe.transactions.length > 0);
  const pendingThisMonth = activeFixedExpenses.filter((fe) => fe.transactions.length === 0);

  return {
    totalMonthlyExpenses,
    totalMonthlyIncome,
    totalCount: activeFixedExpenses.length,
    paidCount: paidThisMonth.length,
    pendingCount: pendingThisMonth.length,
    items: fixedExpenses.map((fe) => ({
      ...fe,
      isPaidThisMonth: fe.transactions.length > 0 && fe.isActive,
      transactions: undefined,
    })),
  };
}

/**
 * Sync credit card fixed expenses
 * Creates or updates fixed expenses for credit cards with pending payments
 */
async function syncCreditCardFixedExpenses(userId: string) {
  const { getCreditCardStatement } = await import('./credit-cards.service.js');

  // Get all credit cards with payment account configured
  const creditCards = await accountRepo.findCreditCardsByUser(userId, {
    paymentAccountId: { not: null },
    cutoffDay: { not: null },
    paymentDueDay: { not: null },
  });

  // Get or create category for credit card payments
  let category = await categoryRepo.findFirst({ userId, name: 'Pago de Tarjeta', type: 'expense' });

  if (!category) {
    category = await categoryRepo.create({
      name: 'Pago de Tarjeta',
      type: 'expense',
      icon: '💳',
      color: '#8B5CF6',
      user: { connect: { id: userId } },
    });
  }

  for (const card of creditCards) {
    try {
      const statement = await getCreditCardStatement(card.id, userId);
      const { closedPeriod, currentPeriod } = statement;

      // Find existing fixed expense for this credit card
      const existingFixedExpense = await fixedExpenseRepo.findFirst({
        userId,
        creditCardAccountId: card.id,
      });

      // Determine which amount to use (Option C):
      // 1. If there's a closed period pending payment -> use that (urgent)
      // 2. Otherwise, if current period has balance -> use that (projection)
      let amountToUse = 0;
      let shouldShow = false;

      if (closedPeriod.balance > 0 && !closedPeriod.isPaid) {
        // Urgent: closed period needs to be paid
        amountToUse = closedPeriod.balance;
        shouldShow = true;
      } else if (currentPeriod.balance > 0) {
        // Projection: current period accumulating
        amountToUse = currentPeriod.balance;
        shouldShow = true;
      }

      if (shouldShow) {
        if (existingFixedExpense) {
          // Update existing fixed expense
          await fixedExpenseRepo.update(existingFixedExpense.id, {
            amount: amountToUse,
            dueDay: card.paymentDueDay!,
            isActive: true,
            accountId: card.paymentAccountId!,
            categoryId: category.id,
          } as unknown as Prisma.FixedExpenseUpdateInput);
        } else {
          // Create new fixed expense
          await fixedExpenseRepo.create({
            name: `Pago Tarjeta ${card.name}`,
            amount: amountToUse,
            type: 'expense',
            dueDay: card.paymentDueDay!,
            isActive: true,
            account: { connect: { id: card.paymentAccountId! } },
            category: { connect: { id: category.id } },
            creditCardAccount: { connect: { id: card.id } },
            user: { connect: { id: userId } },
          });
        }
      } else if (existingFixedExpense) {
        // Deactivate fixed expense if no balance
        await fixedExpenseRepo.update(existingFixedExpense.id, { isActive: false });
      }
    } catch (error) {
      // Skip this card if there's an error (e.g., dates not configured)
      console.error(`Error syncing fixed expense for card ${card.name}:`, error);
    }
  }
}

/**
 * Sync recurring debt payment fixed expenses
 * Creates or updates fixed expenses for monthly recurring debt payments
 */
async function syncRecurringDebtPaymentFixedExpenses(userId: string) {
  // Get all active monthly recurring debt payments
  const recurringPayments = await recurringRepo.findAllByUser(userId, undefined, {
    debt: { select: { id: true, creditor: true, description: true, status: true } },
  });

  // Filter active monthly payments in memory (findAllByUser doesn't filter frequency)
  const monthlyActive = recurringPayments.filter((p) => p.isActive && p.frequency === 'monthly');

  // Get or create category for debt payments
  let category = await categoryRepo.findFirst({ userId, name: 'Pago de Deuda', type: 'expense' });

  if (!category) {
    category = await categoryRepo.create({
      name: 'Pago de Deuda',
      type: 'expense',
      icon: '💰',
      color: '#F59E0B',
      user: { connect: { id: userId } },
    });
  }

  for (const payment of monthlyActive) {
    try {
      // Skip if debt is already paid
      if ((payment as unknown as { debt: { status: string } }).debt.status === 'paid') {
        // Deactivate fixed expense if exists
        const existingFixedExpense = await fixedExpenseRepo.findFirst({
          userId,
          recurringDebtPaymentId: payment.id,
        });

        if (existingFixedExpense) {
          await fixedExpenseRepo.update(existingFixedExpense.id, { isActive: false });
        }
        continue;
      }

      // Find existing fixed expense for this recurring payment
      const existingFixedExpense = await fixedExpenseRepo.findFirst({
        userId,
        recurringDebtPaymentId: payment.id,
      });

      const paymentWithDebt = payment as unknown as {
        debt: { creditor: string; description: string | null };
      };
      const fixedExpenseData = {
        name: `Pago Deuda: ${paymentWithDebt.debt.creditor}${paymentWithDebt.debt.description ? ` - ${paymentWithDebt.debt.description}` : ''}`,
        amount: payment.amount,
        type: 'expense' as const,
        dueDay: payment.dayOfMonth!,
        isActive: true,
        accountId: payment.accountId,
        categoryId: category.id,
      };

      if (existingFixedExpense) {
        // Update existing fixed expense
        await fixedExpenseRepo.update(
          existingFixedExpense.id,
          fixedExpenseData as unknown as Prisma.FixedExpenseUpdateInput
        );
      } else {
        // Create new fixed expense
        await fixedExpenseRepo.create({
          name: fixedExpenseData.name,
          amount: fixedExpenseData.amount,
          type: fixedExpenseData.type,
          dueDay: fixedExpenseData.dueDay,
          isActive: fixedExpenseData.isActive,
          account: { connect: { id: payment.accountId } },
          category: { connect: { id: category.id } },
          recurringDebtPayment: { connect: { id: payment.id } },
          user: { connect: { id: userId } },
        });
      }
    } catch (error) {
      console.error(`Error syncing fixed expense for debt:`, error);
    }
  }
}
