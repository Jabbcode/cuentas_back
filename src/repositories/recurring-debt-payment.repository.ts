import { prisma } from '../lib/prisma.js';
import type { Prisma, RecurringDebtPayment } from '@prisma/client';

export async function create(
  data: Prisma.RecurringDebtPaymentCreateInput,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment> {
  return prisma.recurringDebtPayment.create({ data, include });
}

export async function findAllByUser(
  userId: string,
  debtId?: string,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment[]> {
  return prisma.recurringDebtPayment.findMany({
    where: { userId, ...(debtId && { debtId }) },
    include,
    orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
  });
}

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment | null> {
  return prisma.recurringDebtPayment.findFirst({ where: { id, userId }, include });
}

export async function findFirst(
  where: Prisma.RecurringDebtPaymentWhereInput
): Promise<RecurringDebtPayment | null> {
  return prisma.recurringDebtPayment.findFirst({ where });
}

export async function findUnique(id: string): Promise<RecurringDebtPayment | null> {
  return prisma.recurringDebtPayment.findUnique({ where: { id } });
}

export async function findDuePayments(
  today: Date,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment[]> {
  return prisma.recurringDebtPayment.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: today },
      debt: { status: { not: 'paid' } },
    },
    include,
  });
}

export async function update(
  id: string,
  data: Prisma.RecurringDebtPaymentUpdateInput,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment> {
  return prisma.recurringDebtPayment.update({ where: { id }, data, include });
}

export async function remove(id: string): Promise<void> {
  await prisma.recurringDebtPayment.delete({ where: { id } });
}
