import type { Prisma, PrismaClient, Debt } from '@prisma/client';
import type { CreateDebtInput, UpdateDebtInput, PayDebtInput } from '../schemas/debt.schema.js';
import { calculateNextDueDate, getMonthRange } from '../lib/utils/date.utils.js';
import { createTransaction } from './transactions.service.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import { calculateDebtPaymentBreakdown, getDebtStatus } from '../lib/utils/debt.utils.js';
import type { DebtRepository } from '../repositories/debt.repository.port.js';
import type { AccountsService } from './accounts.service.port.js';
import type { RecurringDebtPaymentRepository } from '../repositories/recurring-debt-payment.repository.port.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import {
  CATEGORY_SYSTEM_KEYS,
  SYSTEM_CATEGORY_DEFAULTS,
} from '../lib/constants/category-system-keys.js';
import type {
  DebtsService,
  DebtWithPayments,
  DebtWithPaymentsNoCount,
  PayDebtResult,
  DebtsSummary,
} from './debts.service.port.js';

export class DebtsServiceImpl implements DebtsService {
  constructor(
    private debtRepo: DebtRepository,
    private accountsService: AccountsService,
    private recurringRepo: RecurringDebtPaymentRepository,
    private prisma: PrismaClient
  ) {}

  async createDebt(userId: string, data: CreateDebtInput): Promise<Debt> {
    const debt = await this.debtRepo.create({
      user: { connect: { id: userId } },
      creditor: data.creditor,
      description: data.description,
      totalAmount: data.totalAmount,
      remainingAmount: data.totalAmount,
      interestRate: data.interestRate,
      interestType: data.interestType,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: 'active',
    });

    return debt;
  }

  async getDebts(userId: string, status?: string): Promise<DebtWithPayments[]> {
    const where: Prisma.DebtWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    const debts = await this.debtRepo.findAllByUser(where, {
      payments: {
        include: { account: { select: { id: true, name: true } } },
        orderBy: { paymentDate: 'desc' },
      },
      _count: { select: { payments: true } },
    } as Prisma.DebtInclude);

    return debts as unknown as DebtWithPayments[];
  }

  async getDebtById(debtId: string, userId: string): Promise<DebtWithPaymentsNoCount> {
    const debt = await this.debtRepo.findByIdAndUser(debtId, userId, {
      payments: {
        include: { account: { select: { id: true, name: true } } },
        orderBy: { paymentDate: 'desc' },
      },
    } as Prisma.DebtInclude);

    if (!debt) {
      throw new NotFoundError('Deuda no encontrada');
    }

    return debt as unknown as DebtWithPaymentsNoCount;
  }

  async updateDebt(debtId: string, userId: string, data: UpdateDebtInput): Promise<Debt> {
    const existingDebt = await this.debtRepo.findByIdAndUser(debtId, userId);

    if (!existingDebt) {
      throw new NotFoundError('Deuda no encontrada');
    }

    const debt = await this.debtRepo.update(debtId, {
      creditor: data.creditor,
      description: data.description,
      interestRate: data.interestRate,
      interestType: data.interestType,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      status: data.status,
    });

    return debt;
  }

  async deleteDebt(debtId: string, userId: string): Promise<{ message: string }> {
    const debt = await this.debtRepo.findByIdAndUser(debtId, userId);

    if (!debt) {
      throw new NotFoundError('Deuda no encontrada');
    }

    // Cascade delete will handle payments and transactions
    await this.debtRepo.remove(debtId);

    return { message: 'Deuda eliminada correctamente' };
  }

  private async handleRecurringPaymentSideEffects(
    debtId: string,
    userId: string,
    accountId: string,
    amount: number
  ): Promise<void> {
    const recurringPayment = await this.recurringRepo.findFirst({
      debtId,
      isActive: true,
      frequency: 'monthly',
    });

    if (!recurringPayment) return;

    const newNextDueDate = calculateNextDueDate(
      recurringPayment.frequency,
      recurringPayment.dayOfMonth,
      recurringPayment.dayOfWeek,
      new Date()
    );

    await this.recurringRepo.update(recurringPayment.id, {
      nextDueDate: newNextDueDate,
      lastProcessed: new Date(),
    });

    const fixedExpense = await fixedExpenseRepo.findFirst({
      userId,
      recurringDebtPaymentId: recurringPayment.id,
      isActive: true,
    });

    if (!fixedExpense) return;

    const now = new Date();
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(
      now.getFullYear(),
      now.getMonth()
    );

    const existingPayment = await transactionRepo.findFirst({
      fixedExpenseId: fixedExpense.id,
      date: { gte: startOfMonth, lt: endOfMonth },
    });

    if (!existingPayment) {
      try {
        await createTransaction(
          {
            amount,
            type: 'expense',
            description: `Pago: ${fixedExpense.name}`,
            date: new Date().toISOString(),
            accountId,
            categoryId: fixedExpense.categoryId,
            fixedExpenseId: fixedExpense.id,
          },
          userId
        );
      } catch (error) {
        // Fixed expense transaction failure must not roll back the debt payment
        console.error(
          '[debt-pay:fixed-expense-tx]',
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  async payDebt(debtId: string, userId: string, data: PayDebtInput): Promise<PayDebtResult> {
    const debt = await this.debtRepo.findByIdAndUser(debtId, userId);
    if (!debt) throw new NotFoundError('Deuda no encontrada');
    if (debt.status === 'paid') throw new ConflictError('Esta deuda ya está pagada');
    const account = await this.accountsService.getAccountById(data.accountId, userId);
    if (Number(account.balance) < data.amount)
      throw new ValidationError('Saldo insuficiente en la cuenta');
    const { principal, interest, newRemainingAmount } = calculateDebtPaymentBreakdown(
      Number(debt.remainingAmount),
      data.amount,
      debt.interestRate ? Number(debt.interestRate) : null,
      debt.interestType
    );
    const result = await this.prisma.$transaction(async (tx) => {
      const debtPaymentDefaults = SYSTEM_CATEGORY_DEFAULTS[CATEGORY_SYSTEM_KEYS.DEBT_PAYMENT];
      const cat = await tx.category.upsert({
        where: {
          userId_systemKey: { userId, systemKey: CATEGORY_SYSTEM_KEYS.DEBT_PAYMENT },
        },
        update: {},
        create: {
          userId,
          systemKey: CATEGORY_SYSTEM_KEYS.DEBT_PAYMENT,
          name: debtPaymentDefaults.name,
          type: debtPaymentDefaults.type,
          icon: debtPaymentDefaults.icon,
          color: debtPaymentDefaults.color,
        },
      });
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: data.accountId,
          categoryId: cat.id,
          amount: data.amount,
          type: 'expense',
          description: `Pago de deuda: ${debt.creditor} - ${debt.description}`,
          date: new Date(),
        },
      });
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { decrement: data.amount } },
      });
      const payment = await tx.debtPayment.create({
        data: {
          debtId: debt.id,
          userId,
          accountId: data.accountId,
          amount: data.amount,
          principal,
          interest,
          transactionId: transaction.id,
          notes: data.notes,
          paymentDate: new Date(),
        },
      });
      const updatedDebt = await tx.debt.update({
        where: { id: debt.id },
        data: {
          remainingAmount: newRemainingAmount,
          status: getDebtStatus(newRemainingAmount, debt.dueDate),
        },
        include: { payments: { orderBy: { paymentDate: 'desc' } } },
      });
      return { debt: updatedDebt, payment, transaction };
    });
    await this.handleRecurringPaymentSideEffects(debt.id, userId, data.accountId, data.amount);
    return result as unknown as PayDebtResult;
  }

  async getDebtsSummary(userId: string): Promise<DebtsSummary> {
    const debts = await this.debtRepo.findAllByUser({ userId });

    const activeDebts = debts.filter((d) => d.status === 'active');
    const overdueDebts = debts.filter((d) => d.status === 'overdue');

    // Total debt should include both active and overdue debts
    const totalActiveAmount = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
    const totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
    const totalDebt = totalActiveAmount + totalOverdueAmount;

    // Get debts due soon (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueSoon = activeDebts.filter(
      (d) => d.dueDate && d.dueDate <= sevenDaysFromNow && d.dueDate >= new Date()
    );

    return {
      totalActiveDebts: activeDebts.length,
      totalOverdueDebts: overdueDebts.length,
      totalDebtAmount: totalDebt,
      totalOverdueAmount: totalOverdueAmount,
      debtsDueSoon: dueSoon.length,
      upcomingDebts: dueSoon.map((d) => ({
        id: d.id,
        creditor: d.creditor,
        description: d.description,
        remainingAmount: d.remainingAmount,
        dueDate: d.dueDate,
      })),
    };
  }
}
