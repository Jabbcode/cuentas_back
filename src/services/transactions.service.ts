import type { Prisma, Transaction, ReceiptItem, PrismaClient } from '@prisma/client';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../schemas/transaction.schema.js';
import {
  assertCreditCardLimit,
  CreditCardBalanceInfo,
} from '../lib/utils/credit-card-limit.utils.js';
import { NotFoundError } from '../lib/errors.js';
import { TRANSACTION_TYPE, SHARED_MESSAGES } from '../lib/constants/shared.constants.js';
import type { TransactionType } from '../lib/constants/shared.constants.js';
import { TRANSACTION_MESSAGES } from '../lib/constants/transaction.constants.js';
import type { AccountsService } from './accounts.service.port.js';
import type { TransactionRepository } from '../repositories/transaction.repository.port.js';
import type { CategoryRepository } from '../repositories/category.repository.port.js';
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
} from './transactions.service.port.js';

const CARD_STATEMENT_TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  fixedExpense: { select: { id: true, name: true } },
} as const;

const RECEIPT_TRANSACTION_INCLUDE = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} as const;

export class TransactionsServiceImpl implements TransactionsService {
  constructor(
    private transactionRepo: TransactionRepository,
    private accountsService: AccountsService,
    private categoryRepo: CategoryRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * Lee la cuenta con FOR UPDATE dentro de la tx para que la validación de límite
   * de tarjeta y el decremento posterior queden serializados por el lock de fila
   * (un SELECT plano no bloquea: dos requests concurrentes podrían leer el mismo
   * saldo, pasar ambas la validación y dejarlo por encima del límite).
   */
  private async lockAccountForBalanceUpdate(
    tx: Prisma.TransactionClient,
    accountId: string,
    userId: string
  ): Promise<CreditCardBalanceInfo | null> {
    const rows = await tx.$queryRaw<
      Array<{
        type: string;
        creditLimit: Prisma.Decimal | null;
        balance: Prisma.Decimal;
        initialBalance: Prisma.Decimal;
      }>
    >`SELECT type, "creditLimit", balance, "initialBalance" FROM "Account" WHERE id = ${accountId} AND "userId" = ${userId} FOR UPDATE`;

    const account = rows[0];
    if (!account) return null;

    return {
      type: account.type,
      creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
      balance: Number(account.balance),
      initialBalance: Number(account.initialBalance),
    };
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
  }

  async getTransactionById(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionRepo.findByIdAndUser(id, userId, {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      receiptItems: true,
    });

    if (!transaction) {
      throw new NotFoundError(TRANSACTION_MESSAGES.NOT_FOUND);
    }

    return transaction;
  }

  async createTransaction(data: CreateTransactionInput, userId: string): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
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

      assertCreditCardLimit(account, data.amount, data.type);

      const transaction = await tx.transaction.create({
        data: {
          amount: data.amount,
          type: data.type,
          description: data.description,
          date: data.date ? new Date(data.date) : new Date(),
          account: { connect: { id: data.accountId } },
          category: { connect: { id: data.categoryId } },
          fixedExpense: data.fixedExpenseId ? { connect: { id: data.fixedExpenseId } } : undefined,
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

    return this.prisma.$transaction(async (tx) => {
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

      assertCreditCardLimit(resultingAccount, resultingAmount, resultingType);

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
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    const transaction = await this.getTransactionById(id, userId);

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
      if (row.type === TRANSACTION_TYPE.EXPENSE) entry.expenseTotal += Number(row._sum.amount ?? 0);
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
  }

  async getReceiptItems(transactionId: string, userId: string): Promise<ReceiptItem[]> {
    await this.getTransactionById(transactionId, userId);

    return this.transactionRepo.findReceiptItems(transactionId);
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.transactionRepo.count({ categoryId });
  }

  async findMonthlyCategoryExpenses(
    userId: string,
    categoryId: string,
    range: DateRangeGteLt
  ): Promise<Transaction[]> {
    return this.transactionRepo.findMany({
      categoryId,
      userId,
      type: TRANSACTION_TYPE.EXPENSE,
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async findCardStatementTransactions(
    userId: string,
    accountIds: string[],
    range: DateRangeGteLte
  ): Promise<Transaction[]> {
    return this.transactionRepo.findMany(
      {
        accountId: { in: accountIds },
        userId,
        type: TRANSACTION_TYPE.EXPENSE,
        date: { gte: range.gte, lte: range.lte },
      },
      { include: CARD_STATEMENT_TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
    );
  }

  async findFixedExpensePaymentInMonth(
    fixedExpenseId: string,
    range: DateRangeGteLt
  ): Promise<Transaction | null> {
    return this.transactionRepo.findFirst({
      fixedExpenseId,
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async resyncTransactionsForFixedExpense(
    userId: string,
    fixedExpenseId: string,
    data: Prisma.TransactionUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload> {
    return this.transactionRepo.updateMany({ fixedExpenseId, userId }, data);
  }

  async getMonthlyTotalByType(
    userId: string,
    type: TransactionType,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
    return this.transactionRepo.aggregate({
      userId,
      type,
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async getVariableExpenseTotal(
    userId: string,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
    return this.transactionRepo.aggregate({
      userId,
      type: TRANSACTION_TYPE.EXPENSE,
      fixedExpenseId: null,
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async getCategoryBreakdown(
    userId: string,
    range: DateRangeGteLt,
    type?: TransactionType
  ): Promise<GroupByCategoryRow[]> {
    return this.transactionRepo.groupByCategory({
      userId,
      ...(type !== undefined && { type }),
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async findTransactionsSince(userId: string, since: Date): Promise<Transaction[]> {
    return this.transactionRepo.findMany({ userId, date: { gte: since } });
  }

  async getTopExpenseCategories(
    userId: string,
    range: DateRangeGteLt,
    take?: number
  ): Promise<GroupExpenseRow[]> {
    return this.transactionRepo.groupExpensesByCategory(
      {
        userId,
        type: TRANSACTION_TYPE.EXPENSE,
        date: { gte: range.gte, lt: range.lt },
      },
      take
    );
  }

  async getUserTotalsByType(userIds: string[], range: DateRangeGteLt): Promise<GroupTotalsRow[]> {
    return this.transactionRepo.groupTotalsByUser({
      userId: { in: userIds },
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async getExpensesByUserAndCategory(
    userIds: string[],
    range: DateRangeGteLt
  ): Promise<GroupUserCategoryRow[]> {
    return this.transactionRepo.groupExpensesByUserAndCategory({
      userId: { in: userIds },
      type: TRANSACTION_TYPE.EXPENSE,
      date: { gte: range.gte, lt: range.lt },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.transactionRepo.countByUser(userId);
  }

  async getFirstTransactionDate(userId: string): Promise<{ date: Date } | null> {
    return this.transactionRepo.findFirstByUser(userId, { date: 'asc' });
  }

  async findByImageHash(userId: string, imageHash: string): Promise<TxWithAccountCategory | null> {
    return this.transactionRepo.findFirst(
      { userId, imageHash },
      RECEIPT_TRANSACTION_INCLUDE
    ) as Promise<TxWithAccountCategory | null>;
  }

  async findSimilarByAmountAndDate(
    userId: string,
    window: SimilarTransactionWindow
  ): Promise<TxWithAccountCategory[]> {
    return this.transactionRepo.findMany(
      {
        userId,
        amount: { gte: window.amountGte, lte: window.amountLte },
        date: { gte: window.dateGte, lte: window.dateLte },
      },
      { include: RECEIPT_TRANSACTION_INCLUDE, orderBy: { date: 'desc' } }
    ) as unknown as Promise<TxWithAccountCategory[]>;
  }
}
