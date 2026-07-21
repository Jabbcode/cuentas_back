import { prisma } from '../lib/prisma.js';
import type { Prisma, FixedExpense } from '@prisma/client';

export async function findAllByUser(
  userId: string,
  filters?: Prisma.FixedExpenseWhereInput,
  include?: Prisma.FixedExpenseInclude,
  orderBy?: Prisma.FixedExpenseOrderByWithRelationInput[]
): Promise<FixedExpense[]> {
  return prisma.fixedExpense.findMany({
    where: { userId, ...filters },
    include,
    orderBy,
  });
}

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense | null> {
  return prisma.fixedExpense.findFirst({ where: { id, userId }, include });
}

export async function findFirst(
  where: Prisma.FixedExpenseWhereInput
): Promise<FixedExpense | null> {
  return prisma.fixedExpense.findFirst({ where });
}

export async function findMany(
  where: Prisma.FixedExpenseWhereInput,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense[]> {
  return prisma.fixedExpense.findMany({ where, include });
}

export async function countByUser(userId: string): Promise<number> {
  return prisma.fixedExpense.count({ where: { userId } });
}

export async function create(
  data: Prisma.FixedExpenseCreateInput,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense> {
  return prisma.fixedExpense.create({ data, include });
}

export async function update(
  id: string,
  data: Prisma.FixedExpenseUpdateInput,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense> {
  return prisma.fixedExpense.update({ where: { id }, data, include });
}

export async function remove(id: string): Promise<FixedExpense> {
  return prisma.fixedExpense.delete({ where: { id } });
}
