import type { Prisma, Transaction, ReceiptItem } from '@prisma/client';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
} from '../schemas/transaction.schema.js';
import type { TransactionType } from '../lib/constants/shared.constants.js';

export type TxWithAccountCategory = Prisma.TransactionGetPayload<{
  include: {
    account: { select: { id: true; name: true } };
    category: { select: { id: true; name: true } };
  };
}>;

export interface GroupByCategoryRow {
  categoryId: string;
  type: string;
  _sum: { amount: Prisma.Decimal | null };
  _count: { _all: number };
}

export interface GroupExpenseRow {
  categoryId: string;
  _sum: { amount: Prisma.Decimal | null };
}

export interface GroupTotalsRow {
  userId: string;
  type: string;
  _sum: { amount: Prisma.Decimal | null };
}

export interface GroupUserCategoryRow {
  userId: string;
  categoryId: string;
  _sum: { amount: Prisma.Decimal | null };
}

export interface CategorySummaryItem {
  category: { id: string; name: string; icon: string | null; color: string | null };
  expenseTotal: number;
  incomeTotal: number;
  count: number;
  netTotal: number;
}

export interface DateRangeGte {
  gte: Date;
}

export interface DateRangeGteLt {
  gte: Date;
  lt: Date;
}

export interface DateRangeGteLte {
  gte: Date;
  lte: Date;
}

export interface SimilarTransactionWindow {
  amountGte: number;
  amountLte: number;
  dateGte: Date;
  dateLte: Date;
}

export interface TransactionsService {
  // Métodos del dueño (consumidor: transactions.controller.ts)
  getTransactions(
    userId: string,
    query: TransactionQuery
  ): Promise<{ transactions: Transaction[]; total: number; limit: number; offset: number }>;
  getTransactionById(id: string, userId: string): Promise<Transaction>;
  createTransaction(data: CreateTransactionInput, userId: string): Promise<Transaction>;
  updateTransaction(id: string, data: UpdateTransactionInput, userId: string): Promise<Transaction>;
  deleteTransaction(id: string, userId: string): Promise<void>;
  getTransactionSummary(
    userId: string,
    query: Pick<TransactionQuery, 'startDate' | 'endDate' | 'accountId' | 'type'>
  ): Promise<CategorySummaryItem[]>;
  getReceiptItems(transactionId: string, userId: string): Promise<ReceiptItem[]>;

  // Métodos de negocio (uno por uso real de los 8 consumidores)
  countByCategory(categoryId: string): Promise<number>;
  findMonthlyCategoryExpenses(
    userId: string,
    categoryId: string,
    range: DateRangeGteLt
  ): Promise<Transaction[]>;
  findCardStatementTransactions(
    userId: string,
    accountIds: string[],
    range: DateRangeGteLte
  ): Promise<Transaction[]>;
  findFixedExpensePaymentInMonth(
    fixedExpenseId: string,
    range: DateRangeGteLt
  ): Promise<Transaction | null>;
  resyncTransactionsForFixedExpense(
    userId: string,
    fixedExpenseId: string,
    data: Prisma.TransactionUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload>;
  getMonthlyTotalByType(
    userId: string,
    type: TransactionType,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  getVariableExpenseTotal(
    userId: string,
    range: DateRangeGteLt
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  getCategoryBreakdown(
    userId: string,
    range: DateRangeGteLt,
    type?: TransactionType
  ): Promise<GroupByCategoryRow[]>;
  findTransactionsSince(userId: string, since: Date): Promise<Transaction[]>;
  getTopExpenseCategories(
    userId: string,
    range: DateRangeGteLt,
    take?: number
  ): Promise<GroupExpenseRow[]>;
  getUserTotalsByType(userIds: string[], range: DateRangeGteLt): Promise<GroupTotalsRow[]>;
  getExpensesByUserAndCategory(
    userIds: string[],
    range: DateRangeGteLt
  ): Promise<GroupUserCategoryRow[]>;
  countByUser(userId: string): Promise<number>;
  getFirstTransactionDate(userId: string): Promise<{ date: Date } | null>;
  findByImageHash(userId: string, imageHash: string): Promise<TxWithAccountCategory | null>;
  findSimilarByAmountAndDate(
    userId: string,
    window: SimilarTransactionWindow
  ): Promise<TxWithAccountCategory[]>;
}
