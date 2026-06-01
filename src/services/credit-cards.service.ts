import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';
import {
  getCutoffDates,
  getPaymentDueDate,
  getDaysBetween,
  normalizeToUTC,
} from '../lib/utils/credit-card.utils.js';
import * as accountRepo from '../repositories/account.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as creditCardPaymentRepo from '../repositories/credit-card-payment.repository.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';

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
 * Get credit card statement with current and closed periods
 */
export async function getCreditCardStatement(
  accountId: string,
  userId: string
): Promise<CreditCardStatement> {
  const account = await accountRepo.findByIdAndUser(accountId, userId);

  if (!account || account.type !== 'credit_card') {
    throw new NotFoundError('Cuenta no encontrada o no es una tarjeta de crédito');
  }

  if (!account.cutoffDay || !account.paymentDueDay) {
    throw new ValidationError('La tarjeta no tiene configuradas las fechas de corte y pago');
  }

  const today = new Date();
  const { lastCutoff, nextCutoff } = getCutoffDates(account.cutoffDay);

  // Calculate previous cutoff for closed period
  const previousCutoff = new Date(lastCutoff);
  previousCutoff.setMonth(previousCutoff.getMonth() - 1);

  // Normalize dates to UTC midnight for consistent comparisons
  const previousCutoffUTC = normalizeToUTC(previousCutoff);

  // Get transactions for current period (last cutoff to now)
  const currentPeriodTransactions = await transactionRepo.findMany(
    { accountId, userId, type: 'expense', date: { gte: lastCutoff, lte: today } },
    {
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        fixedExpense: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    }
  );

  // Get transactions for closed period (previous cutoff to last cutoff)
  const closedPeriodTransactions = await transactionRepo.findMany(
    { accountId, userId, type: 'expense', date: { gte: previousCutoff, lt: lastCutoff } },
    {
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        fixedExpense: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    }
  );

  // Calculate balances
  const currentBalance = currentPeriodTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const closedBalance = closedPeriodTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Calculate period end dates (one day before the next cutoff)
  const closedPeriodEnd = new Date(lastCutoff);
  closedPeriodEnd.setDate(closedPeriodEnd.getDate() - 1);

  // Normalize to UTC midnight for consistent comparisons
  const closedPeriodEndUTC = normalizeToUTC(closedPeriodEnd);

  // Check if closed period is paid (use UTC normalized dates)
  const closedPeriodPayment = await creditCardPaymentRepo.findFirst({
    accountId,
    periodStart: previousCutoffUTC,
    periodEnd: closedPeriodEndUTC,
  });

  const paymentDueDate = getPaymentDueDate(lastCutoff, account.paymentDueDay);
  const daysUntilDue = getDaysBetween(today, paymentDueDate);
  const daysUntilCutoff = getDaysBetween(today, nextCutoff);

  // Calculate period end dates (one day before the next cutoff)
  const currentPeriodEnd = new Date(nextCutoff);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() - 1);

  const creditLimit = Number(account.creditLimit || 0);
  const isPaidForUsage = !!closedPeriodPayment;
  const totalUsed = currentBalance + (isPaidForUsage ? 0 : closedBalance);
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
  const creditCards = await accountRepo.findCreditCardsByUser(userId);

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
    throw new ConflictError('El estado de cuenta ya está pagado');
  }

  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

  // Import transaction service to create transactions properly
  const { createTransaction } = await import('./transactions.service.js');

  // Create payment transaction (income to credit card)
  // This automatically updates the credit card balance
  const transaction = await createTransaction(
    {
      amount: data.amount,
      type: 'income',
      description: `Pago estado de cuenta ${statement.account.name}`,
      date: paymentDate.toISOString(),
      accountId: accountId,
      categoryId: (await getOrCreatePaymentCategory(userId)).id,
    },
    userId
  );

  // If paying from another account, create expense transaction
  // This automatically updates the payment account balance
  if (data.paymentAccountId !== accountId) {
    await createTransaction(
      {
        amount: data.amount,
        type: 'expense',
        description: `Pago tarjeta ${statement.account.name}`,
        date: paymentDate.toISOString(),
        accountId: data.paymentAccountId,
        categoryId: (await getOrCreatePaymentCategory(userId)).id,
      },
      userId
    );
  }

  // Record payment
  const payment = await creditCardPaymentRepo.create({
    account: { connect: { id: accountId } },
    amount: data.amount,
    paymentDate,
    periodStart: statement.closedPeriod.startDate,
    periodEnd: statement.closedPeriod.endDate,
    transaction: { connect: { id: transaction.id } },
  });

  // Mark associated fixed expense as paid (if exists)
  const fixedExpense = await fixedExpenseRepo.findFirst({
    userId,
    creditCardAccountId: accountId,
    isActive: true,
  });

  if (fixedExpense) {
    // Create transaction for the fixed expense
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Check if there's already a payment this month
    const existingPayment = await transactionRepo.findFirst({
      fixedExpenseId: fixedExpense.id,
      date: { gte: startOfMonth, lte: endOfMonth },
    });

    // Only create if there's no payment this month
    if (!existingPayment) {
      await createTransaction(
        {
          amount: data.amount,
          type: 'expense',
          description: `Pago: ${fixedExpense.name}`,
          date: paymentDate.toISOString(),
          accountId: data.paymentAccountId,
          categoryId: fixedExpense.categoryId,
          fixedExpenseId: fixedExpense.id,
        },
        userId
      );
    }
  }

  return payment;
}

/**
 * Get or create "Pago de Tarjeta" category
 */
async function getOrCreatePaymentCategory(userId: string) {
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

  return category;
}
