import type { Account, CreditCardPayment, Transaction } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';
import {
  getCutoffDates,
  getPaymentDueDate,
  getDaysBetween,
  normalizeToUTC,
} from '../lib/utils/credit-card.utils.js';
import type { AccountRepository } from '../repositories/account.repository.port.js';
import type { CreditCardPaymentRepository } from '../repositories/credit-card-payment.repository.port.js';
import type { CategoryRepository } from '../repositories/category.repository.port.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import { getMonthRange } from '../lib/utils/date.utils.js';
import { CATEGORY_SYSTEM_KEYS } from '../lib/constants/category-system-keys.js';
import { CREDIT_CARD_MESSAGES } from '../lib/constants/credit-card.constants.js';
import { ACCOUNT_TYPES } from '../lib/constants/account.constants.js';
import { TRANSACTION_TYPE } from '../lib/constants/shared.constants.js';
import { createTransaction } from './transactions.service.js';
import type {
  CreditCardsService,
  CreditCardStatement,
  CreditCardsSummary,
  PayCreditCardStatementInput,
} from './credit-cards.service.port.js';

const TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  fixedExpense: { select: { id: true, name: true } },
} as const;

/**
 * Calcula el statement (períodos, balances, alertas) de una tarjeta a partir de datos
 * ya cargados. Pura: no hace I/O. `transactions` debe cubrir al menos desde el
 * `previousCutoff` de la tarjeta hasta `today`; `payments` puede ser cualquier
 * superconjunto de los pagos de esta tarjeta (se filtra por período aquí dentro).
 */
export function buildStatement(
  account: Account,
  transactions: Transaction[],
  payments: CreditCardPayment[],
  today: Date
): CreditCardStatement {
  if (!account.cutoffDay || !account.paymentDueDay) {
    throw new ValidationError('La tarjeta no tiene configuradas las fechas de corte y pago');
  }

  const { lastCutoff, nextCutoff } = getCutoffDates(account.cutoffDay);

  // Calculate previous cutoff for closed period
  const previousCutoff = new Date(lastCutoff);
  previousCutoff.setMonth(previousCutoff.getMonth() - 1);

  // Normalize dates to UTC midnight for consistent comparisons
  const previousCutoffUTC = normalizeToUTC(previousCutoff);

  // Partition preloaded transactions by period (same bounds as las queries originales)
  const currentPeriodTransactions = transactions
    .filter((tx) => tx.date >= lastCutoff && tx.date <= today)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const closedPeriodTransactions = transactions
    .filter((tx) => tx.date >= previousCutoff && tx.date < lastCutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  // Calculate balances
  const currentBalance = currentPeriodTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const closedBalance = closedPeriodTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Calculate period end dates (one day before the next cutoff)
  const closedPeriodEnd = new Date(lastCutoff);
  closedPeriodEnd.setDate(closedPeriodEnd.getDate() - 1);

  // Normalize to UTC midnight for consistent comparisons
  const closedPeriodEndUTC = normalizeToUTC(closedPeriodEnd);

  // Check if closed period is paid (use UTC normalized dates)
  const closedPeriodPayment =
    payments.find(
      (p) =>
        p.periodStart.getTime() === previousCutoffUTC.getTime() &&
        p.periodEnd.getTime() === closedPeriodEndUTC.getTime()
    ) ?? null;

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

export class CreditCardsServiceImpl implements CreditCardsService {
  constructor(
    private accountRepo: AccountRepository,
    private creditCardPaymentRepo: CreditCardPaymentRepository,
    private categoryRepo: CategoryRepository
  ) {}

  /**
   * Get credit card statement with current and closed periods
   */
  async getCreditCardStatement(accountId: string, userId: string): Promise<CreditCardStatement> {
    const account = await this.accountRepo.findByIdAndUser(accountId, userId);

    if (!account || account.type !== ACCOUNT_TYPES.CREDIT_CARD) {
      throw new NotFoundError(CREDIT_CARD_MESSAGES.NOT_FOUND_OR_NOT_CARD);
    }

    if (!account.cutoffDay || !account.paymentDueDay) {
      throw new ValidationError(CREDIT_CARD_MESSAGES.MISSING_CUTOFF_DATES);
    }

    const today = new Date();
    const { lastCutoff } = getCutoffDates(account.cutoffDay);
    const previousCutoff = new Date(lastCutoff);
    previousCutoff.setMonth(previousCutoff.getMonth() - 1);

    const [transactions, payments] = await Promise.all([
      transactionRepo.findMany(
        {
          accountId,
          userId,
          type: TRANSACTION_TYPE.EXPENSE,
          date: { gte: previousCutoff, lte: today },
        },
        { include: TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
      ),
      this.creditCardPaymentRepo.findMany({ accountId }),
    ]);

    return buildStatement(account, transactions, payments, today);
  }

  /**
   * Get summary of all credit cards for dashboard
   */
  async getCreditCardsSummary(userId: string): Promise<CreditCardsSummary> {
    const creditCards = await this.accountRepo.findCreditCardsByUser(userId);
    const eligibleCards = creditCards.filter((card) => card.cutoffDay && card.paymentDueDay);

    if (eligibleCards.length === 0) {
      return { totalToPay: 0, upcomingPayments: [], alerts: [], cards: [] };
    }

    const today = new Date();
    const cardIds = eligibleCards.map((card) => card.id);

    const previousCutoffs = eligibleCards.map((card) => {
      const { lastCutoff } = getCutoffDates(card.cutoffDay!);
      const previousCutoff = new Date(lastCutoff);
      previousCutoff.setMonth(previousCutoff.getMonth() - 1);
      return previousCutoff;
    });
    const minPreviousCutoff = new Date(Math.min(...previousCutoffs.map((d) => d.getTime())));

    const [allTransactions, allPayments] = await Promise.all([
      transactionRepo.findMany(
        {
          accountId: { in: cardIds },
          userId,
          type: TRANSACTION_TYPE.EXPENSE,
          date: { gte: minPreviousCutoff, lte: today },
        },
        { include: TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
      ),
      this.creditCardPaymentRepo.findMany({ accountId: { in: cardIds } }),
    ]);

    const transactionsByAccount = new Map<string, Transaction[]>();
    for (const tx of allTransactions) {
      const list = transactionsByAccount.get(tx.accountId) ?? [];
      list.push(tx);
      transactionsByAccount.set(tx.accountId, list);
    }

    const paymentsByAccount = new Map<string, CreditCardPayment[]>();
    for (const payment of allPayments) {
      const list = paymentsByAccount.get(payment.accountId) ?? [];
      list.push(payment);
      paymentsByAccount.set(payment.accountId, list);
    }

    const summaries = eligibleCards.map((card) =>
      buildStatement(
        card,
        transactionsByAccount.get(card.id) ?? [],
        paymentsByAccount.get(card.id) ?? [],
        today
      )
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
  async payCreditCardStatement(
    accountId: string,
    userId: string,
    data: PayCreditCardStatementInput
  ): Promise<CreditCardPayment> {
    const statement = await this.getCreditCardStatement(accountId, userId);

    if (statement.closedPeriod.isPaid) {
      throw new ConflictError(CREDIT_CARD_MESSAGES.ALREADY_PAID);
    }

    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

    // Create payment transaction (income to credit card)
    // This automatically updates the credit card balance
    const paymentCategory = await this.getOrCreatePaymentCategory(userId);

    const transaction = await createTransaction(
      {
        amount: data.amount,
        type: TRANSACTION_TYPE.INCOME,
        description: `Pago estado de cuenta ${statement.account.name}`,
        date: paymentDate.toISOString(),
        accountId: accountId,
        categoryId: paymentCategory.id,
      },
      userId
    );

    // If paying from another account, create expense transaction
    // This automatically updates the payment account balance
    if (data.paymentAccountId !== accountId) {
      await createTransaction(
        {
          amount: data.amount,
          type: TRANSACTION_TYPE.EXPENSE,
          description: `Pago tarjeta ${statement.account.name}`,
          date: paymentDate.toISOString(),
          accountId: data.paymentAccountId,
          categoryId: paymentCategory.id,
        },
        userId
      );
    }

    // Record payment
    const payment = await this.creditCardPaymentRepo.create({
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
      const { start: startOfMonth, end: endOfMonth } = getMonthRange(
        now.getFullYear(),
        now.getMonth()
      );

      // Check if there's already a payment this month
      const existingPayment = await transactionRepo.findFirst({
        fixedExpenseId: fixedExpense.id,
        date: { gte: startOfMonth, lt: endOfMonth },
      });

      // Only create if there's no payment this month
      if (!existingPayment) {
        await createTransaction(
          {
            amount: data.amount,
            type: TRANSACTION_TYPE.EXPENSE,
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
  private async getOrCreatePaymentCategory(userId: string) {
    return this.categoryRepo.upsertSystemCategory(userId, CATEGORY_SYSTEM_KEYS.CREDIT_CARD_PAYMENT);
  }
}
