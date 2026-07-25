import type { Prisma, Debt, DebtPayment, Transaction } from '@prisma/client';
import type { CreateDebtInput, UpdateDebtInput, PayDebtInput } from '../schemas/debt.schema.js';

export type DebtWithPayments = Prisma.DebtGetPayload<{
  include: {
    payments: { include: { account: { select: { id: true; name: true } } } };
    _count: { select: { payments: true } };
  };
}>;

export type DebtWithPaymentsNoCount = Prisma.DebtGetPayload<{
  include: {
    payments: { include: { account: { select: { id: true; name: true } } } };
  };
}>;

export interface PayDebtResult {
  debt: DebtWithPaymentsNoCount;
  payment: DebtPayment;
  transaction: Transaction;
}

export interface DebtsSummary {
  totalActiveDebts: number;
  totalOverdueDebts: number;
  totalDebtAmount: number;
  totalOverdueAmount: number;
  debtsDueSoon: number;
  upcomingDebts: Array<{
    id: string;
    creditor: string;
    description: string;
    remainingAmount: Prisma.Decimal;
    dueDate: Date | null;
  }>;
}

export interface DebtsService {
  createDebt(userId: string, data: CreateDebtInput): Promise<Debt>;
  getDebts(userId: string, status?: string): Promise<DebtWithPayments[]>;
  getDebtById(debtId: string, userId: string): Promise<DebtWithPaymentsNoCount>;
  updateDebt(debtId: string, userId: string, data: UpdateDebtInput): Promise<Debt>;
  deleteDebt(debtId: string, userId: string): Promise<{ message: string }>;
  payDebt(debtId: string, userId: string, data: PayDebtInput): Promise<PayDebtResult>;
  getDebtsSummary(userId: string): Promise<DebtsSummary>;
  countByUser(userId: string): Promise<number>;
}
