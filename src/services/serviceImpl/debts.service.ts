import type { Prisma, PrismaClient, Debt } from '@prisma/client';
import type { CreateDebtInput, UpdateDebtInput, PayDebtInput } from '../../schemas/debt.schema.js';
import { calculateNextDueDate, getMonthRange } from '../../lib/utils/date.utils.js';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import { calculateDebtPaymentBreakdown, getDebtStatus } from '../../lib/utils/debt.utils.js';
import type { DebtRepository } from '../../repositories/interfaces/debt.repository.port.js';
import type { AccountsService } from '../interfaces/accounts.service.port.js';
import type { RecurringDebtPaymentRepository } from '../../repositories/interfaces/recurring-debt-payment.repository.port.js';
import type { TransactionsService } from '../interfaces/transactions.service.port.js';
import type { FixedExpenseRepository } from '../../repositories/interfaces/fixed-expense.repository.port.js';
import { DEBT_STATUS, DEBT_MESSAGES } from '../../lib/constants/debt.constants.js';
import { TRANSACTION_TYPE } from '../../lib/constants/shared.constants.js';
import { RECURRING_FREQUENCY } from '../../lib/constants/recurring-debt-payment.constants.js';
import {
  CATEGORY_SYSTEM_KEYS,
  SYSTEM_CATEGORY_DEFAULTS,
} from '../../lib/constants/category-system-keys.js';
import type {
  DebtsService,
  DebtWithPayments,
  DebtWithPaymentsNoCount,
  PayDebtResult,
  DebtsSummary,
} from '../interfaces/debts.service.port.js';

const logger = createLogger('DEBTS');

export class DebtsServiceImpl implements DebtsService {
  constructor(
    private debtRepo: DebtRepository,
    private accountsService: AccountsService,
    // ADR-009 (enmienda Fase 6): excepción por ciclo de construcción —
    // RecurringDebtPaymentsService ya depende de DebtsService, así que
    // DebtsService no puede depender de RecurringDebtPaymentsService. La
    // lectura (findFirst) y la escritura simple (update de nextDueDate,
    // ya calculado por calculateNextDueDate, y lastProcessed) no tienen
    // lógica de negocio en el repo, se inyecta directo.
    private recurringRepo: RecurringDebtPaymentRepository,
    private transactionsService: TransactionsService,
    // ADR-009 (enmienda Fase 6): excepción por ciclo de construcción —
    // FixedExpensesService ya depende de DebtsService, así que DebtsService
    // no puede depender de FixedExpensesService. Esta lectura (findFirst)
    // no tiene lógica de negocio, se inyecta el repo.
    private fixedExpenseRepo: FixedExpenseRepository,
    private prisma: PrismaClient
  ) {}

  async createDebt(userId: string, data: CreateDebtInput): Promise<Debt> {
    try {
      return await this.debtRepo.create({
        user: { connect: { id: userId } },
        creditor: data.creditor,
        description: data.description,
        totalAmount: data.totalAmount,
        remainingAmount: data.totalAmount,
        interestRate: data.interestRate,
        interestType: data.interestType,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: DEBT_STATUS.ACTIVE,
      });
    } catch (error) {
      return logger.fail(error, 'No se pudo crear la deuda del usuario {}', userId);
    }
  }

  async getDebts(userId: string, status?: string): Promise<DebtWithPayments[]> {
    try {
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
    } catch (error) {
      return logger.fail(error, 'No se pudieron obtener las deudas del usuario {}', userId);
    }
  }

  async getDebtById(debtId: string, userId: string): Promise<DebtWithPaymentsNoCount> {
    try {
      const debt = await this.debtRepo.findByIdAndUser(debtId, userId, {
        payments: {
          include: { account: { select: { id: true, name: true } } },
          orderBy: { paymentDate: 'desc' },
        },
      } as Prisma.DebtInclude);

      if (!debt) {
        throw new NotFoundError(DEBT_MESSAGES.NOT_FOUND);
      }

      return debt as unknown as DebtWithPaymentsNoCount;
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener la deuda {} del usuario {}', debtId, userId);
    }
  }

  async updateDebt(debtId: string, userId: string, data: UpdateDebtInput): Promise<Debt> {
    try {
      const existingDebt = await this.debtRepo.findByIdAndUser(debtId, userId);

      if (!existingDebt) {
        throw new NotFoundError(DEBT_MESSAGES.NOT_FOUND);
      }

      return await this.debtRepo.update(debtId, {
        creditor: data.creditor,
        description: data.description,
        interestRate: data.interestRate,
        interestType: data.interestType,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: data.status,
      });
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar la deuda {} del usuario {}', debtId, userId);
    }
  }

  async deleteDebt(debtId: string, userId: string): Promise<{ message: string }> {
    try {
      const debt = await this.debtRepo.findByIdAndUser(debtId, userId);

      if (!debt) {
        throw new NotFoundError(DEBT_MESSAGES.NOT_FOUND);
      }

      // Cascade delete will handle payments and transactions
      await this.debtRepo.remove(debtId);

      return { message: DEBT_MESSAGES.DELETED };
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar la deuda {} del usuario {}', debtId, userId);
    }
  }

  private async handleRecurringPaymentSideEffects(
    debtId: string,
    userId: string,
    accountId: string,
    amount: number
  ): Promise<void> {
    try {
      const recurringPayment = await this.recurringRepo.findFirst({
        debtId,
        isActive: true,
        frequency: RECURRING_FREQUENCY.MONTHLY,
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

      const fixedExpense = await this.fixedExpenseRepo.findFirst({
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

      const existingPayment = await this.transactionsService.findFixedExpensePaymentInMonth(
        fixedExpense.id,
        { gte: startOfMonth, lt: endOfMonth }
      );

      if (!existingPayment) {
        try {
          await this.transactionsService.createTransaction(
            {
              amount,
              type: TRANSACTION_TYPE.EXPENSE,
              description: `Pago: ${fixedExpense.name}`,
              date: new Date().toISOString(),
              accountId,
              categoryId: fixedExpense.categoryId,
              fixedExpenseId: fixedExpense.id,
            },
            userId
          );
        } catch (error) {
          // El fallo de la transaccion del gasto fijo no debe revertir el pago de la deuda
          logger.error(
            error,
            'No se pudo crear la transaccion del gasto fijo {} tras el pago recurrente de la deuda {}',
            fixedExpense.id,
            debtId
          );
        }
      }
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron procesar los efectos del pago recurrente de la deuda {} del usuario {}',
        debtId,
        userId
      );
    }
  }

  async payDebt(debtId: string, userId: string, data: PayDebtInput): Promise<PayDebtResult> {
    try {
      const debt = await this.debtRepo.findByIdAndUser(debtId, userId);
      if (!debt) throw new NotFoundError(DEBT_MESSAGES.NOT_FOUND);
      if (debt.status === DEBT_STATUS.PAID) throw new ConflictError(DEBT_MESSAGES.ALREADY_PAID);
      const account = await this.accountsService.getAccountById(data.accountId, userId);
      if (Number(account.balance) < data.amount)
        throw new ValidationError(DEBT_MESSAGES.INSUFFICIENT_BALANCE);
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
            type: TRANSACTION_TYPE.EXPENSE,
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
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo procesar el pago de la deuda {} del usuario {}',
        debtId,
        userId
      );
    }
  }

  async getDebtsSummary(userId: string): Promise<DebtsSummary> {
    try {
      const debts = await this.debtRepo.findAllByUser({ userId });

      const activeDebts = debts.filter((d) => d.status === DEBT_STATUS.ACTIVE);
      const overdueDebts = debts.filter((d) => d.status === DEBT_STATUS.OVERDUE);

      // Total debt should include both active and overdue debts
      const totalActiveAmount = activeDebts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
      const totalOverdueAmount = overdueDebts.reduce(
        (sum, d) => sum + Number(d.remainingAmount),
        0
      );
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
    } catch (error) {
      return logger.fail(error, 'No se pudo calcular el resumen de deudas del usuario {}', userId);
    }
  }

  async countByUser(userId: string): Promise<number> {
    try {
      return await this.debtRepo.countByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo contar las deudas del usuario {}', userId);
    }
  }
}
