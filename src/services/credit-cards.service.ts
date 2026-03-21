import { prisma } from '../lib/prisma.js';

interface CreditCardPeriod {
  startDate: Date;
  endDate: Date;
  balance: number;
  transactions: any[];
}

interface CreditCardStatement {
  account: any;
  currentPeriod: CreditCardPeriod & {
    daysUntilCutoff: number;
  };
  closedPeriod: CreditCardPeriod & {
    isPaid: boolean;
    paymentDueDate: Date;
    daysUntilDue: number;
  };
  creditLimit: number;
  available: number;
  usagePercentage: number;
  alerts: {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

/**
 * Calculate the last and next cutoff dates for a credit card
 */
function getCutoffDates(cutoffDay: number): { lastCutoff: Date; nextCutoff: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let lastCutoff: Date;
  let nextCutoff: Date;

  if (currentDay >= cutoffDay) {
    // Last cutoff was this month
    lastCutoff = new Date(currentYear, currentMonth, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth + 1, cutoffDay);
  } else {
    // Last cutoff was last month
    lastCutoff = new Date(currentYear, currentMonth - 1, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth, cutoffDay);
  }

  return { lastCutoff, nextCutoff };
}

/**
 * Calculate payment due date based on cutoff date and payment due day
 */
function getPaymentDueDate(cutoffDate: Date, paymentDueDay: number): Date {
  const cutoffMonth = cutoffDate.getMonth();
  const cutoffYear = cutoffDate.getFullYear();

  // Payment is due in the same month or next month
  if (paymentDueDay > cutoffDate.getDate()) {
    return new Date(cutoffYear, cutoffMonth, paymentDueDay);
  } else {
    return new Date(cutoffYear, cutoffMonth + 1, paymentDueDay);
  }
}

/**
 * Get days between two dates
 */
function getDaysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get credit card statement with current and closed periods
 */
export async function getCreditCardStatement(accountId: string, userId: string): Promise<CreditCardStatement> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: 'credit_card' },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada o no es una tarjeta de crédito');
  }

  if (!account.cutoffDay || !account.paymentDueDay) {
    throw new Error('La tarjeta no tiene configuradas las fechas de corte y pago');
  }

  const today = new Date();
  const { lastCutoff, nextCutoff } = getCutoffDates(account.cutoffDay);

  // Calculate previous cutoff for closed period
  const previousCutoff = new Date(lastCutoff);
  previousCutoff.setMonth(previousCutoff.getMonth() - 1);

  // Get transactions for current period (last cutoff to now)
  const currentPeriodTransactions = await prisma.transaction.findMany({
    where: {
      accountId,
      userId,
      type: 'expense',
      date: {
        gte: lastCutoff,
        lte: today,
      },
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      fixedExpense: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Get transactions for closed period (previous cutoff to last cutoff)
  const closedPeriodTransactions = await prisma.transaction.findMany({
    where: {
      accountId,
      userId,
      type: 'expense',
      date: {
        gte: previousCutoff,
        lt: lastCutoff,
      },
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      fixedExpense: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Calculate balances
  const currentBalance = currentPeriodTransactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );
  const closedBalance = closedPeriodTransactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );

  // Check if closed period is paid
  const closedPeriodPayment = await prisma.creditCardPayment.findFirst({
    where: {
      accountId,
      periodStart: previousCutoff,
      periodEnd: lastCutoff,
    },
  });

  const paymentDueDate = getPaymentDueDate(lastCutoff, account.paymentDueDay);
  const daysUntilDue = getDaysBetween(today, paymentDueDate);
  const daysUntilCutoff = getDaysBetween(today, nextCutoff);

  const creditLimit = Number(account.creditLimit || 0);
  const totalUsed = currentBalance + (closedPeriodPayment ? 0 : closedBalance);
  const available = creditLimit - totalUsed;
  const usagePercentage = creditLimit > 0 ? Math.round((totalUsed / creditLimit) * 100) : 0;

  // Generate alerts
  const alerts: CreditCardStatement['alerts'] = [];

  if (daysUntilDue <= 3 && daysUntilDue >= 0 && !closedPeriodPayment) {
    alerts.push({
      type: 'payment_due_soon',
      message: `Pago vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'}`,
      severity: 'error',
    });
  } else if (daysUntilDue <= 7 && daysUntilDue >= 0 && !closedPeriodPayment) {
    alerts.push({
      type: 'payment_due_soon',
      message: `Pago vence en ${daysUntilDue} días`,
      severity: 'warning',
    });
  }

  if (usagePercentage >= 90) {
    alerts.push({
      type: 'high_usage',
      message: `Uso al ${usagePercentage}% del límite`,
      severity: 'error',
    });
  } else if (usagePercentage >= 80) {
    alerts.push({
      type: 'high_usage',
      message: `Uso al ${usagePercentage}% del límite`,
      severity: 'warning',
    });
  }

  if (daysUntilCutoff <= 3) {
    alerts.push({
      type: 'cutoff_soon',
      message: `Corte en ${daysUntilCutoff} día${daysUntilCutoff === 1 ? '' : 's'}`,
      severity: 'info',
    });
  }

  // Calculate period end dates (one day before the next cutoff)
  const currentPeriodEnd = new Date(nextCutoff);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() - 1);

  const closedPeriodEnd = new Date(lastCutoff);
  closedPeriodEnd.setDate(closedPeriodEnd.getDate() - 1);

  return {
    account,
    currentPeriod: {
      startDate: lastCutoff,
      endDate: currentPeriodEnd,
      balance: currentBalance,
      transactions: currentPeriodTransactions,
      daysUntilCutoff,
    },
    closedPeriod: {
      startDate: previousCutoff,
      endDate: closedPeriodEnd,
      balance: closedBalance,
      transactions: closedPeriodTransactions,
      isPaid: !!closedPeriodPayment,
      paymentDueDate,
      daysUntilDue,
    },
    creditLimit,
    available,
    usagePercentage,
    alerts,
  };
}

/**
 * Get summary of all credit cards for dashboard
 */
export async function getCreditCardsSummary(userId: string) {
  const creditCards = await prisma.account.findMany({
    where: {
      userId,
      type: 'credit_card',
    },
  });

  const summaries = await Promise.all(
    creditCards
      .filter((card) => card.cutoffDay && card.paymentDueDay)
      .map((card) => getCreditCardStatement(card.id, userId))
  );

  // Calculate totals
  const totalToPay = summaries.reduce(
    (sum, s) => sum + (s.closedPeriod.isPaid ? 0 : s.closedPeriod.balance),
    0
  );

  // Get upcoming payments (not paid, sorted by due date)
  const upcomingPayments = summaries
    .filter((s) => !s.closedPeriod.isPaid && s.closedPeriod.balance > 0)
    .map((s) => ({
      accountId: s.account.id,
      accountName: s.account.name,
      amount: s.closedPeriod.balance,
      dueDate: s.closedPeriod.paymentDueDate,
      daysUntilDue: s.closedPeriod.daysUntilDue,
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // Collect all alerts
  const allAlerts = summaries
    .flatMap((s) =>
      s.alerts.map((alert) => ({
        ...alert,
        accountId: s.account.id,
        accountName: s.account.name,
      }))
    )
    .sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  return {
    totalToPay,
    upcomingPayments,
    alerts: allAlerts,
    cards: summaries,
  };
}

/**
 * Pay credit card statement
 */
export async function payCreditCardStatement(
  accountId: string,
  userId: string,
  data: {
    amount: number;
    paymentAccountId: string; // Account to pay from (bank, cash, etc.)
    paymentDate?: string;
  }
) {
  const statement = await getCreditCardStatement(accountId, userId);

  if (statement.closedPeriod.isPaid) {
    throw new Error('El estado de cuenta ya está pagado');
  }

  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

  // Create payment transaction (income to credit card)
  const transaction = await prisma.transaction.create({
    data: {
      amount: data.amount,
      type: 'income',
      description: `Pago estado de cuenta ${statement.account.name}`,
      date: paymentDate,
      accountId: accountId,
      categoryId: (await getOrCreatePaymentCategory(userId)).id,
      userId,
    },
  });

  // Update credit card balance (reduce debt)
  await prisma.account.update({
    where: { id: accountId },
    data: {
      balance: {
        decrement: data.amount,
      },
    },
  });

  // If paying from another account, create expense transaction
  if (data.paymentAccountId !== accountId) {
    await prisma.transaction.create({
      data: {
        amount: data.amount,
        type: 'expense',
        description: `Pago tarjeta ${statement.account.name}`,
        date: paymentDate,
        accountId: data.paymentAccountId,
        categoryId: (await getOrCreatePaymentCategory(userId)).id,
        userId,
      },
    });

    // Update payment account balance
    await prisma.account.update({
      where: { id: data.paymentAccountId },
      data: {
        balance: {
          decrement: data.amount,
        },
      },
    });
  }

  // Record payment
  const payment = await prisma.creditCardPayment.create({
    data: {
      accountId,
      amount: data.amount,
      paymentDate,
      periodStart: statement.closedPeriod.startDate,
      periodEnd: statement.closedPeriod.endDate,
      transactionId: transaction.id,
    },
  });

  return payment;
}

/**
 * Get or create "Pago de Tarjeta" category
 */
async function getOrCreatePaymentCategory(userId: string) {
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

  return category;
}
