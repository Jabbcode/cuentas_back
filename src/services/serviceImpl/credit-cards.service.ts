import type { Account, CreditCardPayment, Transaction } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import {
  getCutoffDates,
  getPaymentDueDate,
  getDaysBetween,
  normalizeToUTC,
  buildClosedPeriodBounds,
  findPaymentForPeriod,
  formatDateKey,
} from '../../lib/utils/credit-card.utils.js';
import {
  resolveCreditLimitAt,
  type CreditLimitEntry,
} from '../../lib/utils/credit-card-limit.utils.js';
import type { CreditCardPaymentRepository } from '../../repositories/interfaces/credit-card-payment.repository.port.js';
import type { CreditLimitHistoryRepository } from '../../repositories/interfaces/credit-limit-history.repository.port.js';
import type { FixedExpenseRepository } from '../../repositories/interfaces/fixed-expense.repository.port.js';
import { getMonthRange } from '../../lib/utils/date.utils.js';
import { CATEGORY_SYSTEM_KEYS } from '../../lib/constants/category-system-keys.js';
import {
  CREDIT_CARD_MESSAGES,
  OVERDUE_LOOKBACK_MONTHS_DEFAULT,
  OVERDUE_LOOKBACK_MONTHS_MAX,
} from '../../lib/constants/credit-card.constants.js';
import { ACCOUNT_TYPES } from '../../lib/constants/account.constants.js';
import { TRANSACTION_TYPE } from '../../lib/constants/shared.constants.js';
import type { TransactionsService } from '../interfaces/transactions.service.port.js';
import type { AccountsService } from '../interfaces/accounts.service.port.js';
import type { CategoriesService } from '../interfaces/categories.service.port.js';
import type {
  CreditCardsService,
  CreditCardStatement,
  CreditCardOverduePeriod,
  CreditCardsSummary,
  PayCreditCardStatementInput,
} from '../interfaces/credit-cards.service.port.js';

const logger = createLogger('CREDIT_CARDS');

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
  today: Date,
  monthsBack: number = OVERDUE_LOOKBACK_MONTHS_DEFAULT,
  limitHistory: CreditLimitEntry[] = []
): CreditCardStatement {
  if (!account.cutoffDay || !account.paymentDueDay) {
    throw new ValidationError('La tarjeta no tiene configuradas las fechas de corte y pago');
  }

  const accountCreditLimit = account.creditLimit != null ? Number(account.creditLimit) : null;
  const { lastCutoff, nextCutoff } = getCutoffDates(account.cutoffDay);

  // Fronteras de los últimos `monthsBack` períodos cerrados, ascendente; el último
  // elemento es el período cerrado más reciente (closedPeriod de hoy).
  const periodBounds = buildClosedPeriodBounds(lastCutoff, monthsBack);
  const closedBounds = periodBounds[periodBounds.length - 1]!;
  const previousCutoff = closedBounds.startDate;
  const closedPeriodEnd = closedBounds.endDate;

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

  // Check if closed period is paid
  const closedPeriodPayment = findPaymentForPeriod(payments, previousCutoff, closedPeriodEnd);

  const paymentDueDate = getPaymentDueDate(lastCutoff, account.paymentDueDay);
  const daysUntilDue = getDaysBetween(today, paymentDueDate);
  const daysUntilCutoff = getDaysBetween(today, nextCutoff);

  // Períodos cerrados anteriores al closedPeriod (candidatos: todos menos el último,
  // que es closedBounds). Se descartan los ya pagados y los de balance 0.
  const isPeriodPaid = (startDate: Date, endDate: Date): boolean =>
    findPaymentForPeriod(payments, startDate, endDate) !== null;

  const overduePeriods: CreditCardOverduePeriod[] = periodBounds
    .slice(0, -1)
    .filter(({ startDate, endDate }) => !isPeriodPaid(startDate, endDate))
    .map(({ startDate, endDate }) => {
      // Cutoff que cierra este período (el que abre el siguiente): un día después de endDate.
      const periodCutoff = new Date(endDate);
      periodCutoff.setDate(periodCutoff.getDate() + 1);

      const periodTransactions = transactions.filter(
        (tx) => tx.date >= startDate && tx.date < periodCutoff
      );
      const balance = periodTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const overduePaymentDueDate = getPaymentDueDate(periodCutoff, account.paymentDueDay!);

      return {
        startDate,
        endDate,
        periodKey: formatDateKey(startDate),
        balance,
        periodLimit: resolveCreditLimitAt(limitHistory, periodCutoff, accountCreditLimit),
        transactionCount: periodTransactions.length,
        paymentDueDate: overduePaymentDueDate,
        daysOverdue: getDaysBetween(overduePaymentDueDate, today),
      };
    })
    .filter((period) => period.balance !== 0);

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
      periodLimit: accountCreditLimit,
      daysUntilCutoff,
    },
    closedPeriod: {
      startDate: previousCutoff,
      endDate: closedPeriodEnd,
      balance: closedBalance,
      transactions: closedPeriodTransactions,
      periodLimit: resolveCreditLimitAt(limitHistory, lastCutoff, accountCreditLimit),
      isPaid: !!closedPeriodPayment,
      paymentDueDate,
      daysUntilDue,
    },
    overduePeriods,
    creditLimit,
    available,
    usagePercentage,
    alerts,
  };
}

export class CreditCardsServiceImpl implements CreditCardsService {
  constructor(
    private accountsService: AccountsService,
    private creditCardPaymentRepo: CreditCardPaymentRepository,
    private categoriesService: CategoriesService,
    private transactionsService: TransactionsService,
    // ADR-009 (enmienda Fase 6): excepción por ciclo de construcción —
    // FixedExpensesService ya depende de CreditCardsService, así que
    // CreditCardsService no puede depender de FixedExpensesService. Esta
    // lectura (findFirst) no tiene lógica de negocio, se inyecta el repo.
    private fixedExpenseRepo: FixedExpenseRepository,
    private creditLimitHistoryRepo: CreditLimitHistoryRepository
  ) {}

  /**
   * Get credit card statement with current and closed periods
   */
  async getCreditCardStatement(
    accountId: string,
    userId: string,
    monthsBack: number = OVERDUE_LOOKBACK_MONTHS_DEFAULT
  ): Promise<CreditCardStatement> {
    try {
      const account = await this.accountsService.findAccountById(accountId, userId);

      if (!account || account.type !== ACCOUNT_TYPES.CREDIT_CARD) {
        throw new NotFoundError(CREDIT_CARD_MESSAGES.NOT_FOUND_OR_NOT_CARD);
      }

      if (!account.cutoffDay || !account.paymentDueDay) {
        throw new ValidationError(CREDIT_CARD_MESSAGES.MISSING_CUTOFF_DATES);
      }

      const today = new Date();
      const { lastCutoff } = getCutoffDates(account.cutoffDay);
      const oldestPeriodStart = buildClosedPeriodBounds(lastCutoff, monthsBack)[0]!.startDate;

      const [transactions, payments, rawLimitHistory] = await Promise.all([
        this.transactionsService.findCardStatementTransactions(userId, [accountId], {
          gte: oldestPeriodStart,
          lte: today,
        }),
        this.creditCardPaymentRepo.findMany({ accountId }),
        this.creditLimitHistoryRepo.findByAccounts([accountId], userId),
      ]);
      const limitHistory: CreditLimitEntry[] = rawLimitHistory.map((entry) => ({
        creditLimit: Number(entry.creditLimit),
        effectiveFrom: entry.effectiveFrom,
      }));

      return buildStatement(account, transactions, payments, today, monthsBack, limitHistory);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener el estado de cuenta de la tarjeta {} del usuario {}',
        accountId,
        userId
      );
    }
  }

  /**
   * Get summary of all credit cards for dashboard
   */
  async getCreditCardsSummary(
    userId: string,
    monthsBack: number = OVERDUE_LOOKBACK_MONTHS_DEFAULT
  ): Promise<CreditCardsSummary> {
    try {
      const creditCards = await this.accountsService.getCreditCards(userId);
      const eligibleCards = creditCards.filter((card) => card.cutoffDay && card.paymentDueDay);

      if (eligibleCards.length === 0) {
        return { totalToPay: 0, upcomingPayments: [], alerts: [], cards: [] };
      }

      const today = new Date();
      const cardIds = eligibleCards.map((card) => card.id);

      const oldestPeriodStarts = eligibleCards.map((card) => {
        const { lastCutoff } = getCutoffDates(card.cutoffDay!);
        return buildClosedPeriodBounds(lastCutoff, monthsBack)[0]!.startDate;
      });
      const minOldestPeriodStart = new Date(
        Math.min(...oldestPeriodStarts.map((d) => d.getTime()))
      );

      const [allTransactions, allPayments, allLimitHistory] = await Promise.all([
        this.transactionsService.findCardStatementTransactions(userId, cardIds, {
          gte: minOldestPeriodStart,
          lte: today,
        }),
        this.creditCardPaymentRepo.findMany({ accountId: { in: cardIds } }),
        this.creditLimitHistoryRepo.findByAccounts(cardIds, userId),
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

      const limitHistoryByAccount = new Map<string, CreditLimitEntry[]>();
      for (const entry of allLimitHistory) {
        const list = limitHistoryByAccount.get(entry.accountId) ?? [];
        list.push({ creditLimit: Number(entry.creditLimit), effectiveFrom: entry.effectiveFrom });
        limitHistoryByAccount.set(entry.accountId, list);
      }

      const summaries = eligibleCards.map((card) =>
        buildStatement(
          card,
          transactionsByAccount.get(card.id) ?? [],
          paymentsByAccount.get(card.id) ?? [],
          today,
          monthsBack,
          limitHistoryByAccount.get(card.id) ?? []
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
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener el resumen de tarjetas de credito del usuario {}',
        userId
      );
    }
  }

  /**
   * Pay credit card statement
   */
  async payCreditCardStatement(
    accountId: string,
    userId: string,
    data: PayCreditCardStatementInput
  ): Promise<CreditCardPayment> {
    // Pagar un período atrasado usa la ventana máxima (no el default): el período pudo
    // haberse listado con cualquier valor del selector 3/6/12, y resolverlo contra el
    // default rompería el pago de períodos entre 7 y 12 meses visibles en pantalla.
    // Pagar el closedPeriod (sin periodStart) no depende de la ventana: se mantiene el
    // default, más barato para el caso común.
    const statement = await this.getCreditCardStatement(
      accountId,
      userId,
      data.periodStart ? OVERDUE_LOOKBACK_MONTHS_MAX : undefined
    );

    try {
      const targetPeriod = data.periodStart
        ? await this.resolveOverduePeriod(accountId, statement, data.periodStart)
        : this.resolveClosedPeriod(accountId, statement);

      const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

      // Create payment transaction (income to credit card)
      // This automatically updates the credit card balance
      const paymentCategory = await this.getOrCreatePaymentCategory(userId);

      const transaction = await this.transactionsService.createTransaction(
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
        await this.transactionsService.createTransaction(
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
        // Normalizado a UTC: el chequeo de "ya pagado" en buildStatement compara contra
        // fechas UTC-normalizadas, pero startDate/endDate quedan en hora local — sin esto,
        // un pago nunca calza con ese chequeo en timezones != UTC.
        periodStart: normalizeToUTC(targetPeriod.startDate),
        periodEnd: normalizeToUTC(targetPeriod.endDate),
        transaction: { connect: { id: transaction.id } },
      });

      // Pagar un período atrasado no marca el gasto fijo del mes como pagado: el gasto fijo
      // es del mes en curso, y aplicar este bloque a un período de hace varios meses crearía
      // una transacción de gasto fijo que el usuario no hizo (interpretación 4 del techplan).
      if (!data.periodStart) {
        // Mark associated fixed expense as paid (if exists)
        const fixedExpense = await this.fixedExpenseRepo.findFirst({
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
          const existingPayment = await this.transactionsService.findFixedExpensePaymentInMonth(
            fixedExpense.id,
            { gte: startOfMonth, lt: endOfMonth }
          );

          // Only create if there's no payment this month
          if (!existingPayment) {
            await this.transactionsService.createTransaction(
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
      }

      return payment;
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo procesar el pago del estado de cuenta de la tarjeta {} del usuario {}',
        accountId,
        userId
      );
    }
  }

  /**
   * Resuelve el período cerrado más reciente como objetivo del pago (comportamiento
   * actual, sin `periodStart`). Lanza ConflictError si ya está pagado.
   */
  private resolveClosedPeriod(
    accountId: string,
    statement: CreditCardStatement
  ): { startDate: Date; endDate: Date } {
    if (statement.closedPeriod.isPaid) {
      logger.warn(
        'Pago rechazado: periodo {} - {} de la cuenta {} ya estaba pagado (balance={})',
        statement.closedPeriod.startDate.toISOString().slice(0, 10),
        statement.closedPeriod.endDate.toISOString().slice(0, 10),
        accountId,
        statement.closedPeriod.balance
      );
      throw new ConflictError(CREDIT_CARD_MESSAGES.ALREADY_PAID);
    }

    return statement.closedPeriod;
  }

  /**
   * Resuelve un período atrasado concreto contra `statement.overduePeriods` (calculado en
   * servidor, nunca a partir del string recibido). Si `periodStart` no calza con ningún
   * período impago pero sí con uno ya cubierto por un `CreditCardPayment`, distingue
   * ConflictError (protección de doble pago) de NotFoundError (período inexistente/futuro).
   */
  private async resolveOverduePeriod(
    accountId: string,
    statement: CreditCardStatement,
    periodStart: string
  ): Promise<{ startDate: Date; endDate: Date }> {
    // Comparación por string (periodKey/formatDateKey), no por instante UTC: `startDate`
    // se serializa a JSON en UTC y puede desplazar el día calendario en husos horarios
    // adelantados a UTC. periodKey usa componentes locales en ambos lados, sin ambigüedad.
    const overdueMatch = statement.overduePeriods.find(
      (period) => period.periodKey === periodStart
    );

    if (overdueMatch) {
      return overdueMatch;
    }

    const { lastCutoff } = getCutoffDates(statement.account.cutoffDay!);
    const candidateBounds = buildClosedPeriodBounds(lastCutoff, OVERDUE_LOOKBACK_MONTHS_MAX).slice(
      0,
      -1
    );
    const candidateMatch = candidateBounds.find(
      (bounds) => formatDateKey(bounds.startDate) === periodStart
    );

    if (candidateMatch) {
      const payments = await this.creditCardPaymentRepo.findMany({ accountId });
      const startUTC = normalizeToUTC(candidateMatch.startDate);
      const endUTC = normalizeToUTC(candidateMatch.endDate);
      const alreadyPaid = payments.some(
        (p) =>
          p.periodStart.getTime() === startUTC.getTime() &&
          p.periodEnd.getTime() === endUTC.getTime()
      );

      if (alreadyPaid) {
        logger.warn(
          'Pago rechazado: periodo {} de la cuenta {} ya estaba pagado',
          periodStart,
          accountId
        );
        throw new ConflictError(CREDIT_CARD_MESSAGES.ALREADY_PAID);
      }
    }

    logger.warn(
      'Pago rechazado: periodo {} no encontrado para la cuenta {}',
      periodStart,
      accountId
    );
    throw new NotFoundError(CREDIT_CARD_MESSAGES.PERIOD_NOT_FOUND);
  }

  /**
   * Get or create "Pago de Tarjeta" category
   */
  private async getOrCreatePaymentCategory(userId: string) {
    return this.categoriesService.getOrCreateSystemCategory(
      userId,
      CATEGORY_SYSTEM_KEYS.CREDIT_CARD_PAYMENT
    );
  }
}
