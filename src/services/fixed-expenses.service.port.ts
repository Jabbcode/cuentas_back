import type { Prisma, FixedExpense, Transaction } from '@prisma/client';
import type {
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  PayFixedExpenseInput,
} from '../schemas/fixed-expense.schema.js';

export type FixedExpenseWithRelations = Prisma.FixedExpenseGetPayload<{
  include: {
    account: { select: { id: true; name: true; color: true } };
    category: { select: { id: true; name: true; icon: true; color: true } };
  };
}>;

export type FixedExpenseWithTransactions = Prisma.FixedExpenseGetPayload<{
  include: {
    account: { select: { id: true; name: true; color: true } };
    category: { select: { id: true; name: true; icon: true; color: true } };
    transactions: true;
  };
}>;

export type FixedExpenseWithCategory = Prisma.FixedExpenseGetPayload<{
  include: {
    category: { select: { id: true; name: true; icon: true; color: true } };
  };
}>;

export interface FixedExpensesSummaryItem extends FixedExpenseWithRelations {
  isPaidThisMonth: boolean;
}

export interface FixedExpensesSummary {
  totalMonthlyExpenses: number;
  totalMonthlyIncome: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  items: FixedExpensesSummaryItem[];
}

export interface AutoGenerateFailure {
  fixedExpenseName: string;
  message: string;
}

export interface AutoGenerateSummary {
  createdByUser: Record<string, number>;
  failedByUser: Record<string, AutoGenerateFailure[]>;
}

export interface FixedExpensesService {
  getFixedExpenses(userId: string, activeOnly?: boolean): Promise<FixedExpenseWithRelations[]>;
  getFixedExpenseById(id: string, userId: string): Promise<FixedExpenseWithTransactions>;
  createFixedExpense(
    data: CreateFixedExpenseInput,
    userId: string
  ): Promise<FixedExpenseWithRelations>;
  updateFixedExpense(
    id: string,
    data: UpdateFixedExpenseInput,
    userId: string
  ): Promise<FixedExpenseWithRelations>;
  deleteFixedExpense(id: string, userId: string): Promise<FixedExpense>;
  payFixedExpense(id: string, data: PayFixedExpenseInput, userId: string): Promise<Transaction>;
  getFixedExpensesSummary(userId: string): Promise<FixedExpensesSummary>;
  reorderFixedExpenses(
    userId: string,
    itemOrders: { id: string; sortOrder: number }[]
  ): Promise<{ success: boolean }>;
  autoGenerateFixedExpenseTransactions(today: Date): Promise<AutoGenerateSummary>;
  getActiveFixedExpenses(userId: string): Promise<FixedExpense[]>;
  getActiveFixedExpensesWithCategory(userId: string): Promise<FixedExpenseWithCategory[]>;
  getActiveExpenseFixedExpenses(userId: string): Promise<FixedExpense[]>;
  countByUser(userId: string): Promise<number>;
}
