import { prisma } from '../lib/prisma.js';
import type { CreateDebtInput, UpdateDebtInput, PayDebtInput } from '../schemas/debt.schema.js';

/**
 * Calculate interest based on debt configuration
 */
function calculateInterest(remainingAmount: number, interestRate: number, interestType: string): number {
  if (interestType === 'percentage') {
    return (remainingAmount * interestRate) / 100;
  } else if (interestType === 'fixed') {
    return interestRate;
  }
  return 0;
}

/**
 * Update debt status based on remaining amount and due date
 */
function getDebtStatus(remainingAmount: number, dueDate: Date | null): string {
  if (remainingAmount <= 0) {
    return 'paid';
  }
  if (dueDate && new Date() > dueDate) {
    return 'overdue';
  }
  return 'active';
}

/**
 * Create a new debt
 */
export async function createDebt(userId: string, data: CreateDebtInput) {
  const debt = await prisma.debt.create({
    data: {
      userId,
      creditor: data.creditor,
      description: data.description,
      totalAmount: data.totalAmount,
      remainingAmount: data.totalAmount, // Initially, remaining = total
      interestRate: data.interestRate,
      interestType: data.interestType,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: 'active',
    },
  });

  return debt;
}

/**
 * Get all debts for a user with optional filters
 */
export async function getDebts(userId: string, status?: string) {
  const where: any = { userId };

  if (status) {
    where.status = status;
  }

  const debts = await prisma.debt.findMany({
    where,
    include: {
      payments: {
        include: {
          account: { select: { id: true, name: true } },
        },
        orderBy: { paymentDate: 'desc' },
      },
      _count: {
        select: { payments: true },
      },
    },
    orderBy: [
      { status: 'asc' }, // active first, then paid
      { dueDate: 'asc' }, // closest due date first
    ],
  });

  return debts;
}

/**
 * Get a single debt by ID
 */
export async function getDebtById(debtId: string, userId: string) {
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, userId },
    include: {
      payments: {
        include: {
          account: { select: { id: true, name: true } },
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  if (!debt) {
    throw new Error('Deuda no encontrada');
  }

  return debt;
}

/**
 * Update a debt
 */
export async function updateDebt(debtId: string, userId: string, data: UpdateDebtInput) {
  const existingDebt = await prisma.debt.findFirst({
    where: { id: debtId, userId },
  });

  if (!existingDebt) {
    throw new Error('Deuda no encontrada');
  }

  const debt = await prisma.debt.update({
    where: { id: debtId },
    data: {
      creditor: data.creditor,
      description: data.description,
      interestRate: data.interestRate,
      interestType: data.interestType,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      status: data.status,
    },
  });

  return debt;
}

/**
 * Delete a debt
 */
export async function deleteDebt(debtId: string, userId: string) {
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, userId },
  });

  if (!debt) {
    throw new Error('Deuda no encontrada');
  }

  // Cascade delete will handle payments and transactions
  await prisma.debt.delete({
    where: { id: debtId },
  });

  return { message: 'Deuda eliminada correctamente' };
}

/**
 * Pay a debt (partial or full)
 */
export async function payDebt(debtId: string, userId: string, data: PayDebtInput) {
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, userId },
  });

  if (!debt) {
    throw new Error('Deuda no encontrada');
  }

  if (debt.status === 'paid') {
    throw new Error('Esta deuda ya está pagada');
  }

  // Verify account exists and belongs to user
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');
  }

  // Verify sufficient balance
  if (Number(account.balance) < data.amount) {
    throw new Error('Saldo insuficiente en la cuenta');
  }

  // Calculate interest if applicable
  let interest = 0;
  if (debt.interestRate && debt.interestType) {
    interest = calculateInterest(Number(debt.remainingAmount), Number(debt.interestRate), debt.interestType);
  }

  // Calculate principal amount (what goes to reduce the debt)
  const principal = Math.min(data.amount - interest, Number(debt.remainingAmount));

  // If payment is less than interest, all goes to interest
  if (data.amount < interest) {
    interest = data.amount;
  }

  // Calculate new remaining amount
  const newRemainingAmount = Number(debt.remainingAmount) - principal;

  // Get or create "Pago de deuda" category
  let category = await prisma.category.findFirst({
    where: { userId, name: 'Pago de deuda', type: 'expense' },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        userId,
        name: 'Pago de deuda',
        type: 'expense',
        icon: '💳',
        color: '#EF4444',
      },
    });
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create transaction
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: category.id,
        amount: data.amount,
        type: 'expense',
        description: `Pago de deuda: ${debt.creditor} - ${debt.description}`,
        date: new Date(),
      },
    });

    // Update account balance
    await tx.account.update({
      where: { id: data.accountId },
      data: {
        balance: {
          decrement: data.amount,
        },
      },
    });

    // Create debt payment record
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

    // Update debt
    const newStatus = getDebtStatus(newRemainingAmount, debt.dueDate);
    const updatedDebt = await tx.debt.update({
      where: { id: debt.id },
      data: {
        remainingAmount: newRemainingAmount,
        status: newStatus,
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    return { debt: updatedDebt, payment, transaction };
  });

  // Mark associated fixed expense as paid (if exists)
  const recurringPayment = await prisma.recurringDebtPayment.findFirst({
    where: {
      debtId: debt.id,
      isActive: true,
      frequency: 'monthly',
    },
  });

  if (recurringPayment) {
    const fixedExpense = await prisma.fixedExpense.findFirst({
      where: {
        userId,
        recurringDebtPaymentId: recurringPayment.id,
        isActive: true,
      },
    });

    if (fixedExpense) {
      const { createTransaction } = await import('./transactions.service.js');
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Check if there's already a payment this month
      const existingPayment = await prisma.transaction.findFirst({
        where: {
          fixedExpenseId: fixedExpense.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      // Only create if there's no payment this month
      if (!existingPayment) {
        try {
          await createTransaction({
            amount: data.amount,
            type: 'expense',
            description: `Pago: ${fixedExpense.name}`,
            date: new Date().toISOString(),
            accountId: data.accountId,
            categoryId: fixedExpense.categoryId,
            fixedExpenseId: fixedExpense.id,
          }, userId);
        } catch (error) {
          // Log error but don't fail the whole transaction
          console.error('Error creating fixed expense transaction:', error);
        }
      }
    }
  }

  return result;
}

/**
 * Get debts summary for dashboard
 */
export async function getDebtsSummary(userId: string) {
  const debts = await prisma.debt.findMany({
    where: { userId },
  });

  const activeDebts = debts.filter((d) => d.status === 'active');
  const overdueDebts = debts.filter((d) => d.status === 'overdue');

  // Total debt should include both active and overdue debts
  const totalActiveAmount = activeDebts.reduce(
    (sum, d) => sum + Number(d.remainingAmount),
    0
  );
  const totalOverdueAmount = overdueDebts.reduce(
    (sum, d) => sum + Number(d.remainingAmount),
    0
  );
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
