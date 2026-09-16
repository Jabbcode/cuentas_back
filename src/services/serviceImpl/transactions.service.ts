import type { Prisma, Transaction, ReceiptItem, PrismaClient } from '@prisma/client';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../../schemas/transaction.schema.js';
import {
  assertCreditCardPeriodLimit,
  resolveCreditLimitAt,
  CreditCardPeriodLimitInfo,
  CreditLimitEntry,
} from '../../lib/utils/credit-card-limit.utils.js';
import { getPeriodBoundsForDate, findPaymentForPeriod } from '../../lib/utils/credit-card.utils.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import { TRANSACTION_TYPE, SHARED_MESSAGES } from '../../lib/constants/shared.constants.js';
import type { TransactionType } from '../../lib/constants/shared.constants.js';
import { TRANSACTION_MESSAGES } from '../../lib/constants/transaction.constants.js';
import { ACCOUNT_TYPES } from '../../lib/constants/account.constants.js';
import { CREDIT_CARD_MESSAGES } from '../../lib/constants/credit-card.constants.js';
import type { AccountsService } from '../interfaces/accounts.service.port.js';
import type { TransactionRepository } from '../../repositories/interfaces/transaction.repository.port.js';
import type { CategoryRepository } from '../../repositories/interfaces/category.repository.port.js';
import type {
  TransactionsService,
  TxWithAccountCategory,
  GroupByCategoryRow,
  GroupExpenseRow,
  GroupTotalsRow,
  GroupUserCategoryRow,
  CategorySummaryItem,
  DateRangeGteLt,
  DateRangeGteLte,
  SimilarTransactionWindow,
  CreateTransactionOptions,
} from '../interfaces/transactions.service.port.js';

const CARD_STATEMENT_TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  fixedExpense: { select: { id: true, name: true } },
} as const;

const RECEIPT_TRANSACTION_INCLUDE = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} as const;

const logger = createLogger('TRANSACTIONS');

interface LockedAccountForLimit {
  type: string;
  creditLimit: number | null;
  cutoffDay: number | null;
}

/**
 * Envuelve assertCreditCardPeriodLimit para loguear los numeros reales
 * (limite y uso del período, monto intentado) cuando bloquea — sin esto,
 * diagnosticar un 409 de limite superado requiere consultar a mano el
 * historial y las transacciones del período en la BD.
 */
function assertCreditCardPeriodLimitLogged(
  card: CreditCardPeriodLimitInfo,
  amount: number,
  resultingType: string,
  accountId: string
): void {
  try {
    assertCreditCardPeriodLimit(card, amount, resultingType);
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn(
        'Limite de periodo de tarjeta: cuenta {} periodLimit={} periodUsed={} monto={} periodo=[{},{}]',
        accountId,
        card.periodLimit,
        card.periodUsed,
        amount,
        card.periodStart.toISOString(),
        card.periodEnd.toISOString()
      );
    }
    throw error;
  }
}

export class TransactionsServiceImpl implements TransactionsService {
  constructor(
    private transactionRepo: TransactionRepository,
    private accountsService: AccountsService,
    // ADR-009 (enmienda Fase 6): excepción por ciclo de construcción —
    // CategoriesService ya depende de TransactionsService (countByCategory),
    // así que TransactionsService no puede depender de CategoriesService.
    // Esta lectura (findMany, hidratación de categorías) no tiene lógica de
    // negocio, se inyecta el repo directo.
    private categoryRepo: CategoryRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * Lee la cuenta con FOR UPDATE dentro de la tx para que la validación de límite
   * de período y el decremento posterior queden serializados por el lock de fila
   * (un SELECT plano no bloquea: dos requests concurrentes podrían leer el mismo
   * uso del período, pasar ambas la validación y dejarlo por encima del límite).
   */
  private async lockAccountForBalanceUpdate(
    tx: Prisma.TransactionClient,
    accountId: string,
    userId: string
  ): Promise<LockedAccountForLimit | null> {
    const rows = await tx.$queryRaw<
      Array<{
        type: string;
        creditLimit: Prisma.Decimal | null;
        cutoffDay: number | null;
      }>
    >`SELECT type, "creditLimit", "cutoffDay" FROM "Account" WHERE id = ${accountId} AND "userId" = ${userId} FOR UPDATE`;

    const account = rows[0];
    if (!account) return null;

    return {
      type: account.type,
      creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
      cutoffDay: account.cutoffDay,
    };
  }

  /**
   * Resuelve el período al que corresponde `date` para una tarjeta de crédito
   * (bounds, límite vigente y uso ya acumulado, excluyendo `excludeTransactionId`
   * al editar) — todo dentro de la misma `tx` que el lock, para que el segundo
   * request concurrente vea el efecto del primero. No hace I/O (ni historial ni
   * agregado) cuando la cuenta no es tarjeta o el movimiento resultante no es un
   * gasto — assertCreditCardPeriodLimit tampoco bloquearía esos casos, así que
   * cargar el período sería trabajo desperdiciado (p. ej. el income que registra
   * un pago de tarjeta sobre la propia tarjeta).
   */
  private async loadPeriodLimitContext(
    tx: Prisma.TransactionClient,
    account: LockedAccountForLimit,
    accountId: string,
    userId: string,
    date: Date,
    resultingType: string,
    excludeTransactionId?: string
  ): Promise<CreditCardPeriodLimitInfo> {
    if (account.type !== ACCOUNT_TYPES.CREDIT_CARD || resultingType !== TRANSACTION_TYPE.EXPENSE) {
      return {
        type: account.type,
        periodLimit: null,
        periodUsed: 0,
        periodStart: date,
        periodEnd: date,
      };
    }
    if (account.cutoffDay == null) {
      throw new ValidationError(CREDIT_CARD_MESSAGES.MISSING_CUTOFF_DATES);
    }

    const { startDate, endDate } = getPeriodBoundsForDate(account.cutoffDay, date);
    const nextCutoff = new Date(endDate);
    nextCutoff.setDate(nextCutoff.getDate() + 1);

    const [history, aggregate] = await Promise.all([
      tx.creditLimitHistory.findMany({
        where: { accountId, account: { userId } },
        orderBy: { effectiveFrom: 'asc' },
      }),
      tx.transaction.aggregate({
        _sum: { amount: true },
        where: {
          accountId,
          userId,
          type: TRANSACTION_TYPE.EXPENSE,
          date: { gte: startDate, lt: nextCutoff },
          ...(excludeTransactionId && { id: { not: excludeTransactionId } }),
        },
      }),
    ]);

    const limitEntries: CreditLimitEntry[] = history.map((entry) => ({
      creditLimit: Number(entry.creditLimit),
      effectiveFrom: entry.effectiveFrom,
    }));
    // `nextCutoff` como `at`: para el período abierto queda en el futuro, así que
    // resuelve siempre a la entrada más reciente — que BE-T3 garantiza igual al
    // creditLimit actual de la cuenta. Para un período ya cerrado, resuelve al
    // límite vigente cuando cerró. Una sola fórmula cubre ambos casos.
    const periodLimit = resolveCreditLimitAt(limitEntries, nextCutoff, account.creditLimit);

    return {
      type: account.type,
      periodLimit,
      periodUsed: Number(aggregate._sum.amount ?? 0),
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /**
   * Bloquea crear/editar dentro de un período de tarjeta ya pagado (criterios 1/2/5/7).
   * A diferencia de loadPeriodLimitContext, no hace early-return para income: ambos
   * tipos quedan bloqueados por igual (criterio 5). Sin cutoffDay no hay concepto de
   * período (y payCreditCardStatement no pudo haber registrado ningún pago), así que
   * se omite en silencio en vez de lanzar.
   */
  private async assertPeriodNotPaid(
    tx: Prisma.TransactionClient,
    account: LockedAccountForLimit,
    accountId: string,
    userId: string,
    date: Date
  ): Promise<void> {
    if (account.type !== ACCOUNT_TYPES.CREDIT_CARD || account.cutoffDay == null) return;

    const { startDate, endDate } = getPeriodBoundsForDate(account.cutoffDay, date);
    const payments = await tx.creditCardPayment.findMany({
      where: { accountId, account: { userId } },
    });
    const payment = findPaymentForPeriod(payments, startDate, endDate);
    if (payment) {
      throw new ConflictError(
        CREDIT_CARD_MESSAGES.PAID_PERIOD_LOCKED(startDate, endDate, payment.paymentDate)
      );
    }
  }

  private async assertOwnership(
    userId: string,
    refs: { accountId?: string; categoryId?: string; fixedExpenseId?: string },
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    if (refs.accountId) {
      const ok = await tx.account.findFirst({
        where: { id: refs.accountId, userId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
    }
    if (refs.categoryId) {
      const ok = await tx.category.findFirst({
        where: { id: refs.categoryId, userId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundError(TRANSACTION_MESSAGES.CATEGORY_NOT_FOUND);
    }
    if (refs.fixedExpenseId) {
      const ok = await tx.fixedExpense.findFirst({
        where: { id: refs.fixedExpenseId, userId },
        select: { id: true },
      });
      if (!ok) throw new NotFoundError(TRANSACTION_MESSAGES.FIXED_EXPENSE_NOT_FOUND);
    }
  }

  async getTransactions(
    userId: string,
    query: TransactionQuery
  ): Promise<{ transactions: Transaction[]; total: number; limit: number; offset: number }> {
    const {
      startDate,
      endDate,
      accountId,
      categoryId,
      categoryIds,
      type,
      limit = 50,
      offset = 0,
      minAmount,
      maxAmount,
    } = query;

    const where: Prisma.TransactionWhereInput = { userId };

    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }
    if (accountId) where.accountId = accountId;
    if (categoryIds?.length) {
      where.categoryId = { in: categoryIds };
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    if (type) where.type = type;
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {
        ...(minAmount !== undefined ? { gte: minAmount } : {}),
        ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
      };
    }

    try {
      const [transactions, total] = await Promise.all([
        this.transactionRepo.findMany(where, {
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
            fixedExpense: { select: { id: true, name: true } },
            _count: { select: { receiptItems: true } },
          },
          orderBy: { date: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.transactionRepo.count(where),
      ]);

      return { transactions, total, limit, offset };
    } catch (error) {
      return logger.fail(error, 'No se pudieron obtener las transacciones del usuario {}', userId);
    }
  }

  async getTransactionById(id: string, userId: string): Promise<Transaction> {
    try {
      const transaction = await this.transactionRepo.findByIdAndUser(id, userId, {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
        receiptItems: true,
      });

      if (!transaction) {
        throw new NotFoundError(TRANSACTION_MESSAGES.NOT_FOUND);
      }

      return transaction;
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener la transaccion {} del usuario {}', id, userId);
    }
  }

  async createTransaction(
    data: CreateTransactionInput,
    userId: string,
    options?: CreateTransactionOptions
  ): Promise<Transaction> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertOwnership(
          userId,
          {
            accountId: data.accountId,
            categoryId: data.categoryId,
            fixedExpenseId: data.fixedExpenseId,
          },
          tx
        );

        const account = await this.lockAccountForBalanceUpdate(tx, data.accountId, userId);
        if (!account) throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);

        const transactionDate = data.date ? new Date(data.date) : new Date();
        if (!options?.skipPaidPeriodLock) {
          await this.assertPeriodNotPaid(tx, account, data.accountId, userId, transactionDate);
        }
        const periodContext = await this.loadPeriodLimitContext(
          tx,
          account,
          data.accountId,
          userId,
          transactionDate,
          data.type
        );
        assertCreditCardPeriodLimitLogged(periodContext, data.amount, data.type, data.accountId);

        const transaction = await tx.transaction.create({
          data: {
            amount: data.amount,
            type: data.type,
            description: data.description,
            date: transactionDate,
            account: { connect: { id: data.accountId } },
            category: { connect: { id: data.categoryId } },
            fixedExpense: data.fixedExpenseId
              ? { connect: { id: data.fixedExpenseId } }
              : undefined,
            isAutoGenerated: data.isAutoGenerated ?? false,
            imageHash: data.imageHash,
            user: { connect: { id: userId } },
            receiptItems: data.receiptItems
              ? {
                  create: data.receiptItems.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                  })),
                }
              : undefined,
          },
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
            receiptItems: true,
          },
        });

        await this.accountsService.updateAccountBalance(
          data.accountId,
          userId,
          data.amount,
          data.type,
          tx
        );

        return transaction;
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo crear la transaccion del usuario {} en la cuenta {}',
        userId,
        data.accountId
      );
    }
  }

  async updateTransaction(
    id: string,
    data: UpdateTransactionInput,
    userId: string
  ): Promise<Transaction> {
    const existing = await this.getTransactionById(id, userId);

    const updateData: Prisma.TransactionUpdateInput = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.accountId !== undefined) updateData.account = { connect: { id: data.accountId } };
    if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } };
    if (data.fixedExpenseId !== undefined)
      updateData.fixedExpense = { connect: { id: data.fixedExpenseId } };
    if (data.imageHash !== undefined) updateData.imageHash = data.imageHash;
    if (data.date !== undefined) updateData.date = new Date(data.date);

    const resultingAccountId = data.accountId ?? existing.accountId;
    const resultingType = (data.type ?? existing.type) as TransactionType;
    const resultingAmount = data.amount ?? Number(existing.amount);
    const resultingDate = data.date ? new Date(data.date) : existing.date;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertOwnership(
          userId,
          {
            accountId: data.accountId,
            categoryId: data.categoryId,
            fixedExpenseId: data.fixedExpenseId,
          },
          tx
        );

        await this.accountsService.updateAccountBalance(
          existing.accountId,
          userId,
          Number(existing.amount),
          existing.type === TRANSACTION_TYPE.INCOME
            ? TRANSACTION_TYPE.EXPENSE
            : TRANSACTION_TYPE.INCOME,
          tx
        );

        const resultingAccount = await this.lockAccountForBalanceUpdate(
          tx,
          resultingAccountId,
          userId
        );
        if (!resultingAccount) throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);

        await this.assertPeriodNotPaid(
          tx,
          resultingAccount,
          resultingAccountId,
          userId,
          resultingDate
        );

        const periodContext = await this.loadPeriodLimitContext(
          tx,
          resultingAccount,
          resultingAccountId,
          userId,
          resultingDate,
          resultingType,
          id
        );
        assertCreditCardPeriodLimitLogged(
          periodContext,
          resultingAmount,
          resultingType,
          resultingAccountId
        );

        const updated = await tx.transaction.update({
          where: { id },
          data: updateData,
          include: {
            account: { select: { id: true, name: true, color: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
          },
        });

        await this.accountsService.updateAccountBalance(
          updated.accountId,
          userId,
          Number(updated.amount),
          updated.type as TransactionType,
          tx
        );

        return updated;
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo actualizar la transaccion {} del usuario {}',
        id,
        userId
      );
    }
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    const transaction = await this.getTransactionById(id, userId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.delete({ where: { id } });

        await this.accountsService.updateAccountBalance(
          transaction.accountId,
          userId,
          Number(transaction.amount),
          transaction.type === TRANSACTION_TYPE.INCOME
            ? TRANSACTION_TYPE.EXPENSE
            : TRANSACTION_TYPE.INCOME,
          tx
        );
      });
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar la transaccion {} del usuario {}', id, userId);
    }
  }

  async getTransactionSummary(
    userId: string,
    query: Pick<TransactionQuery, 'startDate' | 'endDate' | 'accountId' | 'type'>
  ): Promise<CategorySummaryItem[]> {
    const { startDate, endDate, accountId, type } = query;

    const where: Prisma.TransactionWhereInput = { userId };
    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }
    if (accountId) where.accountId = accountId;
    if (type) where.type = type;

    try {
      const rows = await this.transactionRepo.groupByCategory(where);

      const categoryMap = new Map<
        string,
        { expenseTotal: number; incomeTotal: number; count: number }
      >();

      for (const row of rows) {
        if (!row.categoryId) continue;
        const entry = categoryMap.get(row.categoryId) ?? {
          expenseTotal: 0,
          incomeTotal: 0,
          count: 0,
        };
        entry.count += row._count._all;
        if (row.type === TRANSACTION_TYPE.EXPENSE)
          entry.expenseTotal += Number(row._sum.amount ?? 0);
        else entry.incomeTotal += Number(row._sum.amount ?? 0);
        categoryMap.set(row.categoryId, entry);
      }

      const categoryIds = Array.from(categoryMap.keys());
      if (categoryIds.length === 0) return [];

      const cats = await this.categoryRepo.findMany(
        { id: { in: categoryIds } },
        { id: true, name: true, icon: true, color: true }
      );

      return (cats as unknown as CategorySummaryItem['category'][])
        .map((cat) => {
          const data = categoryMap.get(cat.id) ?? { expenseTotal: 0, incomeTotal: 0, count: 0 };
          return {
            category: cat,
            expenseTotal: data.expenseTotal,
            incomeTotal: data.incomeTotal,
            count: data.count,
            netTotal: data.incomeTotal - data.expenseTotal,
          };
        })
        .sort((a, b) => b.expenseTotal - a.expenseTotal);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener el resumen de transacciones del usuario {}',
        userId
      );
    }
  }

  async getReceiptItems(transactionId: string, userId: string): Promise<ReceiptItem[]> {
    await this.getTransactionById(transactionId, userId);

    try {
      return await this.transactionRepo.findReceiptItems(transactionId);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener los items de recibo de la transaccion {} del usuario {}',
        transactionId,
        userId
      );
    }
  }

  async countByCategory(categoryId: string): Promise<number> {
    try {
      return await this.transactionRepo.count({ categoryId });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo contar las transacciones de la categoria {}',
        categoryId
      );
    }
  }

  async findMonthlyCategoryExpenses(
    userId: string,
    categoryId: string,
    range: DateRangeGteLt
  ): Promise<Transaction[]> {
    try {
      return await this.transactionRepo.findMany({
        categoryId,
        userId,
        type: TRANSACTION_TYPE.EXPENSE,
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener los gastos mensuales de la categoria {} del usuario {}',
        categoryId,
        userId
      );
    }
  }

  async findCardStatementTransactions(
    userId: string,
    accountIds: string[],
    range: DateRangeGteLte
  ): Promise<Transaction[]> {
    try {
      return await this.transactionRepo.findMany(
        {
          accountId: { in: accountIds },
          userId,
          type: TRANSACTION_TYPE.EXPENSE,
          date: { gte: range.gte, lte: range.lte },
        },
        { include: CARD_STATEMENT_TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
      );
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las transacciones del estado de cuenta del usuario {}',
        userId
      );
    }
  }

  async findFixedExpensePaymentInMonth(
    fixedExpenseId: string,
    range: DateRangeGteLt
  ): Promise<Transaction | null> {
    try {
      return await this.transactionRepo.findFirst({
        fixedExpenseId,
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo verificar el pago del gasto fijo {} en el mes',
        fixedExpenseId
      );
    }
  }

  async resyncTransactionsForFixedExpense(
    userId: string,
    fixedExpenseId: string,
    data: Prisma.TransactionUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload> {
    try {
      return await this.transactionRepo.updateMany({ fixedExpenseId, userId }, data);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo resincronizar las transacciones del gasto fijo {} del usuario {}',
        fixedExpenseId,
        userId
      );
    }
  }

  async getMonthlyTotalByType(
    userId: string,
    type: TransactionType,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
    try {
      return await this.transactionRepo.aggregate({
        userId,
        type,
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo calcular el total mensual de tipo {} del usuario {}',
        type,
        userId
      );
    }
  }

  async getVariableExpenseTotal(
    userId: string,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
    try {
      return await this.transactionRepo.aggregate({
        userId,
        type: TRANSACTION_TYPE.EXPENSE,
        fixedExpenseId: null,
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo calcular el total de gastos variables del usuario {}',
        userId
      );
    }
  }

  async getCategoryBreakdown(
    userId: string,
    range: DateRangeGteLt,
    type?: TransactionType
  ): Promise<GroupByCategoryRow[]> {
    try {
      return await this.transactionRepo.groupByCategory({
        userId,
        ...(type !== undefined && { type }),
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener el desglose por categoria del usuario {}',
        userId
      );
    }
  }

  async findTransactionsSince(userId: string, since: Date): Promise<Transaction[]> {
    try {
      return await this.transactionRepo.findMany({ userId, date: { gte: since } });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las transacciones del usuario {} desde la fecha indicada',
        userId
      );
    }
  }

  async getTopExpenseCategories(
    userId: string,
    range: DateRangeGteLt,
    take?: number
  ): Promise<GroupExpenseRow[]> {
    try {
      return await this.transactionRepo.groupExpensesByCategory(
        {
          userId,
          type: TRANSACTION_TYPE.EXPENSE,
          date: { gte: range.gte, lt: range.lt },
        },
        take
      );
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las categorias con mayor gasto del usuario {}',
        userId
      );
    }
  }

  async getUserTotalsByType(userIds: string[], range: DateRangeGteLt): Promise<GroupTotalsRow[]> {
    try {
      return await this.transactionRepo.groupTotalsByUser({
        userId: { in: userIds },
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener los totales por tipo para {} usuarios',
        userIds.length
      );
    }
  }

  async getExpensesByUserAndCategory(
    userIds: string[],
    range: DateRangeGteLt
  ): Promise<GroupUserCategoryRow[]> {
    try {
      return await this.transactionRepo.groupExpensesByUserAndCategory({
        userId: { in: userIds },
        type: TRANSACTION_TYPE.EXPENSE,
        date: { gte: range.gte, lt: range.lt },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener los gastos por usuario y categoria para {} usuarios',
        userIds.length
      );
    }
  }

  async countByUser(userId: string): Promise<number> {
    try {
      return await this.transactionRepo.countByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo contar las transacciones del usuario {}', userId);
    }
  }

  async getFirstTransactionDate(userId: string): Promise<{ date: Date } | null> {
    try {
      return await this.transactionRepo.findFirstByUser(userId, { date: 'asc' });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener la fecha de la primera transaccion del usuario {}',
        userId
      );
    }
  }

  async findByImageHash(userId: string, imageHash: string): Promise<TxWithAccountCategory | null> {
    try {
      return (await this.transactionRepo.findFirst(
        { userId, imageHash },
        RECEIPT_TRANSACTION_INCLUDE
      )) as TxWithAccountCategory | null;
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo buscar la transaccion por hash de imagen del usuario {}',
        userId
      );
    }
  }

  async findSimilarByAmountAndDate(
    userId: string,
    window: SimilarTransactionWindow
  ): Promise<TxWithAccountCategory[]> {
    try {
      return (await this.transactionRepo.findMany(
        {
          userId,
          amount: { gte: window.amountGte, lte: window.amountLte },
          date: { gte: window.dateGte, lte: window.dateLte },
        },
        { include: RECEIPT_TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
      )) as unknown as TxWithAccountCategory[];
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron buscar transacciones similares del usuario {}',
        userId
      );
    }
  }
}
