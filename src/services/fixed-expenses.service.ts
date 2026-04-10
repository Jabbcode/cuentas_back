import { prisma } from '../lib/prisma.js';
import { CreateFixedExpenseInput, UpdateFixedExpenseInput, PayFixedExpenseInput } from '../schemas/fixed-expense.schema.js';
import { createTransaction } from './transactions.service.js';

export async function getFixedExpenses(userId: string, activeOnly = false) {
  return prisma.fixedExpense.findMany({
    where: {
      userId,
      ...(activeOnly && { isActive: true }),
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: { dueDay: 'asc' },
  });
}

export async function getFixedExpenseById(id: string, userId: string) {
  const fixedExpense = await prisma.fixedExpense.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: {
        orderBy: { date: 'desc' },
        take: 12,
      },
    },
  });

  if (!fixedExpense) {
    throw new Error('Gasto fijo no encontrado');
  }

  return fixedExpense;
}

export async function createFixedExpense(data: CreateFixedExpenseInput, userId: string) {
  return prisma.fixedExpense.create({
    data: {
      ...data,
      userId,
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });
}

export async function updateFixedExpense(id: string, data: UpdateFixedExpenseInput, userId: string) {
  const existingExpense = await getFixedExpenseById(id, userId);

  // Preparar actualizaciones para transacciones asociadas
  const transactionUpdates: any = {};

  if (data.categoryId && data.categoryId !== existingExpense.categoryId) {
    transactionUpdates.categoryId = data.categoryId;
  }

  if (data.accountId && data.accountId !== existingExpense.accountId) {
    transactionUpdates.accountId = data.accountId;
  }

  // Si hay cambios en categoría o cuenta, actualizar las transacciones asociadas
  if (Object.keys(transactionUpdates).length > 0) {
    await prisma.transaction.updateMany({
      where: {
        fixedExpenseId: id,
        userId,
      },
      data: transactionUpdates,
    });
  }

  return prisma.fixedExpense.update({
    where: { id },
    data,
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });
}

export async function deleteFixedExpense(id: string, userId: string) {
  await getFixedExpenseById(id, userId);

  return prisma.fixedExpense.delete({
    where: { id },
  });
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
      await payCreditCardStatement(
        fixedExpense.creditCardAccountId,
        userId,
        {
          amount,
          paymentAccountId: fixedExpense.accountId,
          paymentDate: date,
        }
      );
    } catch (error) {
      // If payment already exists, ignore error
      if (!(error instanceof Error && error.message.includes('ya está pagado'))) {
        throw error;
      }
    }
  }

  return transaction;
}

export async function reorderFixedExpenses(userId: string, itemOrders: { id: string; sortOrder: number }[]) {
  // Verificar que todos los items pertenecen al usuario
  const itemIds = itemOrders.map(item => item.id);
  const items = await prisma.fixedExpense.findMany({
    where: { id: { in: itemIds }, userId },
    select: { id: true },
  });

  if (items.length !== itemIds.length) {
    throw new Error('Algunos gastos fijos no fueron encontrados');
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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { userId },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: {
        where: {
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { dueDay: 'asc' },
    ],
  });

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
  const creditCards = await prisma.account.findMany({
    where: {
      userId,
      type: 'credit_card',
      paymentAccountId: { not: null },
      cutoffDay: { not: null },
      paymentDueDay: { not: null },
    },
  });

  // Get or create category for credit card payments
  let category = await prisma.category.findFirst({
    where: {
      userId,
      name: 'Pago de Tarjeta',
      type: 'expense',
    },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Pago de Tarjeta',
        type: 'expense',
        icon: '💳',
        color: '#8B5CF6',
        userId,
      },
    });
  }

  for (const card of creditCards) {
    try {
      const statement = await getCreditCardStatement(card.id, userId);
      const { closedPeriod, currentPeriod } = statement;

      // Find existing fixed expense for this credit card
      const existingFixedExpense = await prisma.fixedExpense.findFirst({
        where: {
          userId,
          creditCardAccountId: card.id,
        },
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
          await prisma.fixedExpense.update({
            where: { id: existingFixedExpense.id },
            data: {
              amount: amountToUse,
              dueDay: card.paymentDueDay!,
              isActive: true,
              accountId: card.paymentAccountId!,
              categoryId: category.id,
            },
          });
        } else {
          // Create new fixed expense
          await prisma.fixedExpense.create({
            data: {
              name: `Pago Tarjeta ${card.name}`,
              amount: amountToUse,
              type: 'expense',
              dueDay: card.paymentDueDay!,
              isActive: true,
              accountId: card.paymentAccountId!,
              categoryId: category.id,
              creditCardAccountId: card.id,
              userId,
            },
          });
        }
      } else if (existingFixedExpense) {
        // Deactivate fixed expense if no balance
        await prisma.fixedExpense.update({
          where: { id: existingFixedExpense.id },
          data: { isActive: false },
        });
      }
    } catch (error) {
      // Skip this card if there's an error (e.g., dates not configured)
      console.error(`Error syncing fixed expense for card ${card.name}:`, error);
    }
  }
}
