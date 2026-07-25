import type { Prisma, PrismaClient } from '@prisma/client';
import {
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  PayFixedExpenseInput,
} from '../schemas/fixed-expense.schema.js';
import { NotFoundError, ConflictError, AppError } from '../lib/errors.js';
import { calculateNextDueDate, getMonthRange } from '../lib/utils/date.utils.js';
import type { FixedExpenseRepository } from '../repositories/fixed-expense.repository.port.js';
import type { DebtsService } from './debts.service.port.js';
import type { CreditCardsService } from './credit-cards.service.port.js';
import type { TransactionsService } from './transactions.service.port.js';
import type { AccountsService } from './accounts.service.port.js';
import type { CategoriesService } from './categories.service.port.js';
import type { RecurringDebtPaymentsService } from './recurring-debt-payments.service.port.js';
import { CATEGORY_SYSTEM_KEYS } from '../lib/constants/category-system-keys.js';
import { FIXED_EXPENSE_MESSAGES } from '../lib/constants/fixed-expense.constants.js';
import { TRANSACTION_TYPE } from '../lib/constants/shared.constants.js';
import type {
  FixedExpensesService,
  FixedExpenseWithRelations,
  FixedExpenseWithTransactions,
  FixedExpenseWithCategory,
  FixedExpensesSummary,
  AutoGenerateSummary,
  AutoGenerateFailure,
} from './fixed-expenses.service.port.js';

export class FixedExpensesServiceImpl implements FixedExpensesService {
  constructor(
    private fixedExpenseRepo: FixedExpenseRepository,
    private accountsService: AccountsService,
    private categoriesService: CategoriesService,
    private debtsService: DebtsService,
    private creditCardsService: CreditCardsService,
    private transactionsService: TransactionsService,
    private recurringDebtPaymentsService: RecurringDebtPaymentsService,
    private prisma: PrismaClient
  ) {}

  async getFixedExpenses(userId: string, activeOnly = false): Promise<FixedExpenseWithRelations[]> {
    return this.fixedExpenseRepo.findAllByUser(
      userId,
      activeOnly ? { isActive: true } : undefined,
      {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
      [{ dueDay: 'asc' }]
    ) as unknown as Promise<FixedExpenseWithRelations[]>;
  }

  async getFixedExpenseById(id: string, userId: string): Promise<FixedExpenseWithTransactions> {
    const fixedExpense = await this.fixedExpenseRepo.findByIdAndUser(id, userId, {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: { orderBy: { date: 'desc' }, take: 12 },
    });

    if (!fixedExpense) {
      throw new NotFoundError(FIXED_EXPENSE_MESSAGES.NOT_FOUND);
    }

    return fixedExpense as unknown as FixedExpenseWithTransactions;
  }

  async createFixedExpense(
    data: CreateFixedExpenseInput,
    userId: string
  ): Promise<FixedExpenseWithRelations> {
    return this.fixedExpenseRepo.create(
      { ...data, userId } as unknown as Prisma.FixedExpenseCreateInput,
      {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
      }
    ) as unknown as Promise<FixedExpenseWithRelations>;
  }

  async updateFixedExpense(
    id: string,
    data: UpdateFixedExpenseInput,
    userId: string
  ): Promise<FixedExpenseWithRelations> {
    const existingExpense = await this.getFixedExpenseById(id, userId);

    // Preparar actualizaciones para transacciones asociadas
    const transactionUpdates: Prisma.TransactionUncheckedUpdateManyInput = {};

    if (data.categoryId && data.categoryId !== existingExpense.categoryId) {
      transactionUpdates.categoryId = data.categoryId;
    }

    if (data.accountId && data.accountId !== existingExpense.accountId) {
      transactionUpdates.accountId = data.accountId;
    }

    // Si hay cambios en categoría o cuenta, actualizar las transacciones asociadas
    if (Object.keys(transactionUpdates).length > 0) {
      await this.transactionsService.resyncTransactionsForFixedExpense(
        userId,
        id,
        transactionUpdates as Prisma.TransactionUpdateManyMutationInput
      );
    }

    // Si este fixed expense está asociado a un recurring debt payment, sincronizar cambios
    if (existingExpense.recurringDebtPaymentId) {
      // Obtener el recurring payment actual para calcular nextDueDate
      const recurringPayment = await this.recurringDebtPaymentsService.findRecurringPaymentById(
        existingExpense.recurringDebtPaymentId
      );

      if (recurringPayment) {
        const recurringPaymentUpdates: any = {};

        if (data.dueDay !== undefined && data.dueDay !== existingExpense.dueDay) {
          recurringPaymentUpdates.dayOfMonth = data.dueDay;
        }

        if (data.amount !== undefined && data.amount !== Number(existingExpense.amount)) {
          recurringPaymentUpdates.amount = data.amount;
        }

        if (data.accountId && data.accountId !== existingExpense.accountId) {
          recurringPaymentUpdates.accountId = data.accountId;
        }

        // Recalcular nextDueDate si cambia dayOfMonth
        if (recurringPaymentUpdates.dayOfMonth !== undefined) {
          recurringPaymentUpdates.nextDueDate = calculateNextDueDate(
            recurringPayment.frequency,
            recurringPaymentUpdates.dayOfMonth,
            recurringPayment.dayOfWeek,
            new Date()
          );
        }

        // Actualizar el recurring debt payment si hay cambios
        if (Object.keys(recurringPaymentUpdates).length > 0) {
          await this.recurringDebtPaymentsService.updateRecurringPaymentFields(
            existingExpense.recurringDebtPaymentId,
            recurringPaymentUpdates
          );
        }
      }
    }

    return this.fixedExpenseRepo.update(id, data as Prisma.FixedExpenseUpdateInput, {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    }) as unknown as Promise<FixedExpenseWithRelations>;
  }

  async deleteFixedExpense(id: string, userId: string) {
    await this.getFixedExpenseById(id, userId);

    return this.fixedExpenseRepo.remove(id);
  }

  async payFixedExpense(id: string, data: PayFixedExpenseInput, userId: string) {
    const fixedExpense = await this.getFixedExpenseById(id, userId);

    const amount = data.amount ?? Number(fixedExpense.amount);
    const date = data.date ?? new Date().toISOString();

    const transaction = await this.transactionsService.createTransaction(
      {
        amount,
        type: fixedExpense.type as 'expense' | 'income',
        description: `Pago: ${fixedExpense.name}`,
        date,
        accountId: fixedExpense.accountId,
        categoryId: fixedExpense.categoryId,
        fixedExpenseId: fixedExpense.id,
      },
      userId
    );

    // If this is a credit card fixed expense, also record the payment in the credit card
    if (fixedExpense.creditCardAccountId) {
      try {
        await this.creditCardsService.payCreditCardStatement(
          fixedExpense.creditCardAccountId,
          userId,
          {
            amount,
            paymentAccountId: fixedExpense.accountId,
            paymentDate: date,
          }
        );
      } catch (error) {
        // El pago del estado de cuenta ya existía: se ignora y el flujo continúa.
        if (!(error instanceof ConflictError)) {
          throw error;
        }
      }
    }

    // If this is a recurring debt payment fixed expense, also record the payment in the debt
    if (fixedExpense.recurringDebtPaymentId) {
      try {
        // Get the recurring payment to find the debtId
        const recurringPayment = await this.recurringDebtPaymentsService.findRecurringPaymentById(
          fixedExpense.recurringDebtPaymentId
        );

        if (recurringPayment) {
          await this.debtsService.payDebt(recurringPayment.debtId, userId, {
            amount,
            accountId: fixedExpense.accountId,
            notes: `Pago automático desde gasto fijo`,
          });
        }
      } catch (error) {
        // Log error but don't fail the whole transaction
        console.error('Error registering debt payment:', error);
      }
    }

    return transaction;
  }

  async autoGenerateFixedExpenseTransactions(today: Date): Promise<AutoGenerateSummary> {
    const todayDay = today.getDate();
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(
      today.getFullYear(),
      today.getMonth()
    );
    // lastDayOfMonth se deriva por separado (no del `end` exclusivo de getMonthRange,
    // que cae en el mes siguiente): aquí necesitamos el número de día, no un límite de comparación.
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isLastDay = todayDay === lastDayOfMonth;

    const fixedExpenses = await this.prisma.fixedExpense.findMany({
      where: {
        isActive: true,
        autoGenerate: true,
        dueDay: isLastDay ? { gte: todayDay } : todayDay,
      },
      include: {
        user: { select: { id: true } },
      },
    });

    const createdByUser: Record<string, number> = {};
    const failedByUser: Record<string, AutoGenerateFailure[]> = {};

    if (fixedExpenses.length === 0) return { createdByUser, failedByUser };

    const existingTxs = await this.prisma.transaction.findMany({
      where: {
        fixedExpenseId: { in: fixedExpenses.map((fe) => fe.id) },
        date: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { fixedExpenseId: true },
    });
    const alreadyGenerated = new Set(existingTxs.map((t) => t.fixedExpenseId));

    for (const fe of fixedExpenses) {
      if (alreadyGenerated.has(fe.id)) continue;

      try {
        await this.transactionsService.createTransaction(
          {
            amount: Number(fe.amount),
            type: fe.type as 'expense' | 'income',
            description: `Auto: ${fe.name}`,
            date: today.toISOString(),
            accountId: fe.accountId,
            categoryId: fe.categoryId,
            fixedExpenseId: fe.id,
            isAutoGenerated: true,
          },
          fe.userId
        );

        createdByUser[fe.userId] = (createdByUser[fe.userId] ?? 0) + 1;
      } catch (err) {
        console.error(
          '[cron:auto-generate]',
          `fe=${fe.id}`,
          err instanceof Error ? err.message : err
        );
        // Errores de negocio tipados (ej. límite de tarjeta) se reportan al usuario via
        // notificación en vez de fallar en silencio; errores inesperados solo se loguean.
        if (err instanceof AppError) {
          const failures = failedByUser[fe.userId] ?? [];
          failures.push({ fixedExpenseName: fe.name, message: err.message });
          failedByUser[fe.userId] = failures;
        }
      }
    }

    return { createdByUser, failedByUser };
  }

  async reorderFixedExpenses(
    userId: string,
    itemOrders: { id: string; sortOrder: number }[]
  ): Promise<{ success: boolean }> {
    // Verificar que todos los items pertenecen al usuario
    const itemIds = itemOrders.map((item) => item.id);
    const allItems = await this.fixedExpenseRepo.findAllByUser(userId, { id: { in: itemIds } });
    const items = allItems.map((fe) => ({ id: fe.id }));

    if (items.length !== itemIds.length) {
      throw new NotFoundError(FIXED_EXPENSE_MESSAGES.SOME_NOT_FOUND);
    }

    // Actualizar el orden de cada item
    await this.prisma.$transaction(
      itemOrders.map(({ id, sortOrder }) =>
        this.prisma.fixedExpense.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );

    return { success: true };
  }

  async getFixedExpensesSummary(userId: string): Promise<FixedExpensesSummary> {
    // Sync credit card fixed expenses before getting summary
    await this.syncCreditCardFixedExpenses(userId);

    // Sync recurring debt payment fixed expenses
    await this.syncRecurringDebtPaymentFixedExpenses(userId);

    const now = new Date();
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(
      now.getFullYear(),
      now.getMonth()
    );

    type FeWithTx = Prisma.FixedExpenseGetPayload<{
      include: { account: true; category: true; transactions: true };
    }>;
    const fixedExpenses = (await this.fixedExpenseRepo.findAllByUser(
      userId,
      undefined,
      {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
        transactions: { where: { date: { gte: startOfMonth, lt: endOfMonth } } },
      },
      [{ sortOrder: 'asc' }, { dueDay: 'asc' }]
    )) as unknown as FeWithTx[];

    // Solo contar los activos para los totales mensuales
    const activeFixedExpenses = fixedExpenses.filter((fe) => fe.isActive);

    const totalMonthlyExpenses = activeFixedExpenses
      .filter((fe) => fe.type === TRANSACTION_TYPE.EXPENSE)
      .reduce((sum, fe) => sum + Number(fe.amount), 0);

    const totalMonthlyIncome = activeFixedExpenses
      .filter((fe) => fe.type === TRANSACTION_TYPE.INCOME)
      .reduce((sum, fe) => sum + Number(fe.amount), 0);

    const paidThisMonth = activeFixedExpenses.filter((fe) => fe.transactions.length > 0);
    const pendingThisMonth = activeFixedExpenses.filter((fe) => fe.transactions.length === 0);

    return {
      totalMonthlyExpenses,
      totalMonthlyIncome,
      totalCount: activeFixedExpenses.length,
      paidCount: paidThisMonth.length,
      pendingCount: pendingThisMonth.length,
      items: fixedExpenses.map((fe) => ({
        ...fe,
        isPaidThisMonth: fe.transactions.length > 0 && fe.isActive,
        transactions: undefined,
      })),
    } as unknown as FixedExpensesSummary;
  }

  async getActiveFixedExpenses(userId: string) {
    return this.fixedExpenseRepo.findAllByUser(userId, { isActive: true });
  }

  async getActiveFixedExpensesWithCategory(userId: string) {
    return this.fixedExpenseRepo.findAllByUser(
      userId,
      { isActive: true },
      { category: { select: { id: true, name: true, icon: true, color: true } } },
      [{ sortOrder: 'asc' }, { dueDay: 'asc' }]
    ) as unknown as Promise<FixedExpenseWithCategory[]>;
  }

  async getActiveExpenseFixedExpenses(userId: string) {
    return this.fixedExpenseRepo.findAllByUser(userId, {
      isActive: true,
      type: TRANSACTION_TYPE.EXPENSE,
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.fixedExpenseRepo.countByUser(userId);
  }

  /**
   * Sync credit card fixed expenses
   * Creates or updates fixed expenses for credit cards with pending payments
   */
  private async syncCreditCardFixedExpenses(userId: string) {
    // Get all credit cards with payment account configured
    const creditCards = await this.accountsService.getConfiguredCreditCards(userId);

    // Get or create category for credit card payments
    const category = await this.categoriesService.getOrCreateSystemCategory(
      userId,
      CATEGORY_SYSTEM_KEYS.CREDIT_CARD_PAYMENT
    );

    for (const card of creditCards) {
      try {
        const statement = await this.creditCardsService.getCreditCardStatement(card.id, userId);
        const { closedPeriod, currentPeriod } = statement;

        // Find existing fixed expense for this credit card
        const existingFixedExpense = await this.fixedExpenseRepo.findFirst({
          userId,
          creditCardAccountId: card.id,
        });

        // Determine which amount to use (Option C):
        // 1. If there's a closed period pending payment -> use that (urgent)
        // 2. Otherwise, if current period has balance -> use that (projection)
        let amountToUse = 0;
        let shouldShow = false;

        if (closedPeriod.balance > 0 && !closedPeriod.isPaid) {
          // Urgent: closed period needs to be paid
          amountToUse = closedPeriod.balance;
          shouldShow = true;
        } else if (currentPeriod.balance > 0) {
          // Projection: current period accumulating
          amountToUse = currentPeriod.balance;
          shouldShow = true;
        }

        if (shouldShow) {
          if (existingFixedExpense) {
            // Update existing fixed expense
            await this.fixedExpenseRepo.update(existingFixedExpense.id, {
              amount: amountToUse,
              dueDay: card.paymentDueDay!,
              isActive: true,
              accountId: card.paymentAccountId!,
              categoryId: category.id,
            } as unknown as Prisma.FixedExpenseUpdateInput);
          } else {
            // Create new fixed expense
            await this.fixedExpenseRepo.create({
              name: `Pago Tarjeta ${card.name}`,
              amount: amountToUse,
              type: TRANSACTION_TYPE.EXPENSE,
              dueDay: card.paymentDueDay!,
              isActive: true,
              account: { connect: { id: card.paymentAccountId! } },
              category: { connect: { id: category.id } },
              creditCardAccount: { connect: { id: card.id } },
              user: { connect: { id: userId } },
            });
          }
        } else if (existingFixedExpense) {
          // Deactivate fixed expense if no balance
          await this.fixedExpenseRepo.update(existingFixedExpense.id, { isActive: false });
        }
      } catch (error) {
        // Skip this card if there's an error (e.g., dates not configured)
        console.error(`Error syncing fixed expense for card ${card.name}:`, error);
      }
    }
  }

  /**
   * Sync recurring debt payment fixed expenses
   * Creates or updates fixed expenses for monthly recurring debt payments
   */
  private async syncRecurringDebtPaymentFixedExpenses(userId: string) {
    // Get all active monthly recurring debt payments
    const recurringPayments =
      await this.recurringDebtPaymentsService.getRecurringDebtPayments(userId);

    // Filter active monthly payments in memory (findAllByUser doesn't filter frequency)
    const monthlyActive = recurringPayments.filter((p) => p.isActive && p.frequency === 'monthly');

    // Get or create category for debt payments
    const category = await this.categoriesService.getOrCreateSystemCategory(
      userId,
      CATEGORY_SYSTEM_KEYS.DEBT_PAYMENT
    );

    // Precargar en una sola query los fixed expenses ya asociados a estos pagos recurrentes
    const existingFixedExpenses = await this.fixedExpenseRepo.findMany({
      userId,
      recurringDebtPaymentId: { in: monthlyActive.map((p) => p.id) },
    });
    const fixedExpenseByPaymentId = new Map(
      existingFixedExpenses
        .filter((fe) => fe.recurringDebtPaymentId)
        .map((fe) => [fe.recurringDebtPaymentId as string, fe])
    );

    for (const payment of monthlyActive) {
      try {
        // Skip if debt is already paid
        if ((payment as unknown as { debt: { status: string } }).debt.status === 'paid') {
          // Deactivate fixed expense if exists
          const existingFixedExpense = fixedExpenseByPaymentId.get(payment.id);

          if (existingFixedExpense) {
            await this.fixedExpenseRepo.update(existingFixedExpense.id, { isActive: false });
          }
          continue;
        }

        // Find existing fixed expense for this recurring payment
        const existingFixedExpense = fixedExpenseByPaymentId.get(payment.id);

        const paymentWithDebt = payment as unknown as {
          debt: { creditor: string; description: string | null };
        };
        const fixedExpenseData = {
          name: `Pago Deuda: ${paymentWithDebt.debt.creditor}${paymentWithDebt.debt.description ? ` - ${paymentWithDebt.debt.description}` : ''}`,
          amount: payment.amount,
          type: TRANSACTION_TYPE.EXPENSE,
          dueDay: payment.dayOfMonth!,
          isActive: true,
          accountId: payment.accountId,
          categoryId: category.id,
        };

        if (existingFixedExpense) {
          // Update existing fixed expense
          await this.fixedExpenseRepo.update(
            existingFixedExpense.id,
            fixedExpenseData as unknown as Prisma.FixedExpenseUpdateInput
          );
        } else {
          // Create new fixed expense
          await this.fixedExpenseRepo.create({
            name: fixedExpenseData.name,
            amount: fixedExpenseData.amount,
            type: fixedExpenseData.type,
            dueDay: fixedExpenseData.dueDay,
            isActive: fixedExpenseData.isActive,
            account: { connect: { id: payment.accountId } },
            category: { connect: { id: category.id } },
            recurringDebtPayment: { connect: { id: payment.id } },
            user: { connect: { id: userId } },
          });
        }
      } catch (error) {
        console.error(`Error syncing fixed expense for debt:`, error);
      }
    }
  }
}
