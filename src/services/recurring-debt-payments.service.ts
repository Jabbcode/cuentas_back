import type { Prisma } from '@prisma/client';
import type {
  CreateRecurringDebtPaymentInput,
  UpdateRecurringDebtPaymentInput,
} from '../schemas/recurring-debt-payment.schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { calculateNextDueDate } from '../lib/utils/date.utils.js';
import type { RecurringDebtPaymentRepository } from '../repositories/recurring-debt-payment.repository.port.js';
import type { DebtRepository } from '../repositories/debt.repository.port.js';
import type { AccountsService } from './accounts.service.port.js';
import type { DebtsService } from './debts.service.port.js';
import type {
  RecurringDebtPaymentsService,
  RdpCreated,
  RdpWithFullRelations,
  ProcessPendingResult,
  ProcessPendingResultEntry,
} from './recurring-debt-payments.service.port.js';

export class RecurringDebtPaymentsServiceImpl implements RecurringDebtPaymentsService {
  constructor(
    private recurringRepo: RecurringDebtPaymentRepository,
    private debtRepo: DebtRepository,
    private accountsService: AccountsService,
    private debtsService: DebtsService
  ) {}

  async createRecurringDebtPayment(
    userId: string,
    data: CreateRecurringDebtPaymentInput
  ): Promise<RdpCreated> {
    // Verify debt exists and belongs to user
    const debt = await this.debtRepo.findByIdAndUser(data.debtId, userId);

    if (!debt) {
      throw new NotFoundError('Deuda no encontrada');
    }

    if (debt.status === 'paid') {
      throw new ConflictError('No se pueden configurar pagos recurrentes para una deuda pagada');
    }

    // Verify account exists and belongs to user
    await this.accountsService.getAccountById(data.accountId, userId);

    // Calculate next due date
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const nextDueDate = calculateNextDueDate(
      data.frequency,
      data.dayOfMonth || null,
      data.dayOfWeek || null,
      startDate
    );

    const recurringPayment = await this.recurringRepo.create(
      {
        user: { connect: { id: userId } },
        debt: { connect: { id: data.debtId } },
        amount: data.amount,
        account: { connect: { id: data.accountId } },
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextDueDate,
        notes: data.notes,
      },
      {
        account: { select: { id: true, name: true } },
        debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
      }
    );

    return recurringPayment as unknown as RdpCreated;
  }

  async getRecurringDebtPayments(userId: string, debtId?: string): Promise<RdpWithFullRelations[]> {
    const recurringPayments = await this.recurringRepo.findAllByUser(userId, debtId, {
      account: { select: { id: true, name: true, balance: true } },
      debt: {
        select: {
          id: true,
          creditor: true,
          description: true,
          remainingAmount: true,
          status: true,
        },
      },
    });

    return recurringPayments as unknown as RdpWithFullRelations[];
  }

  async getRecurringDebtPaymentById(id: string, userId: string): Promise<RdpWithFullRelations> {
    const recurringPayment = await this.recurringRepo.findByIdAndUser(id, userId, {
      account: { select: { id: true, name: true, balance: true } },
      debt: {
        select: {
          id: true,
          creditor: true,
          description: true,
          remainingAmount: true,
          status: true,
        },
      },
    });

    if (!recurringPayment) {
      throw new NotFoundError('Pago recurrente no encontrado');
    }

    return recurringPayment as unknown as RdpWithFullRelations;
  }

  async updateRecurringDebtPayment(
    id: string,
    userId: string,
    data: UpdateRecurringDebtPaymentInput
  ): Promise<RdpCreated> {
    const existing = await this.recurringRepo.findByIdAndUser(id, userId);

    if (!existing) {
      throw new NotFoundError('Pago recurrente no encontrado');
    }

    // If frequency changes, recalculate nextDueDate
    let nextDueDate = existing.nextDueDate;
    if (data.frequency || data.dayOfMonth !== undefined || data.dayOfWeek !== undefined) {
      const frequency = data.frequency || existing.frequency;
      const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
      const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;

      nextDueDate = calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, new Date());
    }

    const updated = await this.recurringRepo.update(
      id,
      {
        amount: data.amount,
        accountId: data.accountId,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isActive: data.isActive,
        notes: data.notes,
        nextDueDate,
      } as unknown as Prisma.RecurringDebtPaymentUpdateInput,
      {
        account: { select: { id: true, name: true } },
        debt: { select: { id: true, creditor: true, description: true, remainingAmount: true } },
      }
    );

    return updated as unknown as RdpCreated;
  }

  async deleteRecurringDebtPayment(id: string, userId: string): Promise<{ message: string }> {
    const recurringPayment = await this.recurringRepo.findByIdAndUser(id, userId);

    if (!recurringPayment) {
      throw new NotFoundError('Pago recurrente no encontrado');
    }

    await this.recurringRepo.remove(id);

    return { message: 'Pago recurrente eliminado correctamente' };
  }

  async processPendingRecurringPayments(): Promise<ProcessPendingResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active recurring payments that are due
    type RdpWithDebtAccount = Prisma.RecurringDebtPaymentGetPayload<{
      include: { debt: true; account: true };
    }>;
    const duePayments = (await this.recurringRepo.findDuePayments(today, {
      debt: true,
      account: true,
    })) as unknown as RdpWithDebtAccount[];

    const results: ProcessPendingResultEntry[] = [];

    for (const recurringPayment of duePayments) {
      try {
        // Check if end date has passed
        if (recurringPayment.endDate && new Date(recurringPayment.endDate) < today) {
          // Deactivate if end date passed
          await this.recurringRepo.update(recurringPayment.id, { isActive: false });
          results.push({
            id: recurringPayment.id,
            status: 'deactivated',
            reason: 'End date reached',
          });
          continue;
        }

        // Check if account has sufficient balance
        if (Number(recurringPayment.account.balance) < Number(recurringPayment.amount)) {
          results.push({
            id: recurringPayment.id,
            status: 'skipped',
            reason: 'Insufficient balance',
          });
          continue;
        }

        // Process the payment
        await this.debtsService.payDebt(recurringPayment.debtId, recurringPayment.userId, {
          amount: Number(recurringPayment.amount),
          accountId: recurringPayment.accountId,
          notes: `Pago automático (recurrente) - ${recurringPayment.notes || ''}`,
        });

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(
          recurringPayment.frequency,
          recurringPayment.dayOfMonth,
          recurringPayment.dayOfWeek,
          today
        );

        // Update recurring payment
        await this.recurringRepo.update(recurringPayment.id, { lastProcessed: today, nextDueDate });

        results.push({ id: recurringPayment.id, status: 'processed', nextDueDate });
      } catch (error: unknown) {
        results.push({
          id: recurringPayment.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed: results.filter((r) => r.status === 'processed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      deactivated: results.filter((r) => r.status === 'deactivated').length,
      results,
    };
  }
}
