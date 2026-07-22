import type { Prisma } from '@prisma/client';
import type {
  CreateRecurringDebtPaymentInput,
  UpdateRecurringDebtPaymentInput,
} from '../schemas/recurring-debt-payment.schema.js';

export type RdpCreated = Prisma.RecurringDebtPaymentGetPayload<{
  include: {
    account: { select: { id: true; name: true } };
    debt: { select: { id: true; creditor: true; description: true; remainingAmount: true } };
  };
}>;

export type RdpWithFullRelations = Prisma.RecurringDebtPaymentGetPayload<{
  include: {
    account: { select: { id: true; name: true; balance: true } };
    debt: {
      select: {
        id: true;
        creditor: true;
        description: true;
        remainingAmount: true;
        status: true;
      };
    };
  };
}>;

export interface ProcessPendingResultEntry {
  id: string;
  status: 'processed' | 'skipped' | 'error' | 'deactivated';
  reason?: string;
  nextDueDate?: Date;
  error?: string;
}

export interface ProcessPendingResult {
  processed: number;
  skipped: number;
  errors: number;
  deactivated: number;
  results: ProcessPendingResultEntry[];
}

export interface RecurringDebtPaymentsService {
  createRecurringDebtPayment(
    userId: string,
    data: CreateRecurringDebtPaymentInput
  ): Promise<RdpCreated>;
  getRecurringDebtPayments(userId: string, debtId?: string): Promise<RdpWithFullRelations[]>;
  getRecurringDebtPaymentById(id: string, userId: string): Promise<RdpWithFullRelations>;
  updateRecurringDebtPayment(
    id: string,
    userId: string,
    data: UpdateRecurringDebtPaymentInput
  ): Promise<RdpCreated>;
  deleteRecurringDebtPayment(id: string, userId: string): Promise<{ message: string }>;
  processPendingRecurringPayments(): Promise<ProcessPendingResult>;
}
