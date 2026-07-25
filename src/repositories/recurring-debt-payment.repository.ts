import type { Prisma, RecurringDebtPayment, PrismaClient } from '@prisma/client';
import type { RecurringDebtPaymentRepository } from './recurring-debt-payment.repository.port.js';

export class RecurringDebtPaymentRepositoryImpl implements RecurringDebtPaymentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(
    data: Prisma.RecurringDebtPaymentCreateInput,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment> {
    return this.prisma.recurringDebtPayment.create({ data, include });
  }

  async findAllByUser(
    userId: string,
    debtId?: string,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment[]> {
    return this.prisma.recurringDebtPayment.findMany({
      where: { userId, ...(debtId && { debtId }) },
      include,
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
    });
  }

  async findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment | null> {
    return this.prisma.recurringDebtPayment.findFirst({ where: { id, userId }, include });
  }

  async findFirst(
    where: Prisma.RecurringDebtPaymentWhereInput
  ): Promise<RecurringDebtPayment | null> {
    return this.prisma.recurringDebtPayment.findFirst({ where });
  }

  async findUnique(id: string): Promise<RecurringDebtPayment | null> {
    return this.prisma.recurringDebtPayment.findUnique({ where: { id } });
  }

  async findDuePayments(
    today: Date,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment[]> {
    return this.prisma.recurringDebtPayment.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
        debt: { status: { not: 'paid' } },
      },
      include,
    });
  }

  async update(
    id: string,
    data: Prisma.RecurringDebtPaymentUpdateInput,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment> {
    return this.prisma.recurringDebtPayment.update({ where: { id }, data, include });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.recurringDebtPayment.delete({ where: { id } });
  }
}
