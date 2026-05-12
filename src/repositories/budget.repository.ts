import { prisma } from '../lib/prisma.js';
import type { Prisma, Budget } from '@prisma/client';

export async function findAllByUserAndPeriod(
  userId: string,
  month: number,
  year: number,
  include?: Prisma.BudgetInclude
): Promise<Budget[]> {
  return prisma.budget.findMany({
    where: { userId, month, year },
    include,
    orderBy: { category: { name: 'asc' } },
  });
}

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.BudgetInclude
): Promise<Budget | null> {
  return prisma.budget.findFirst({ where: { id, userId }, include });
}

export async function findFirst(where: Prisma.BudgetWhereInput): Promise<Budget | null> {
  return prisma.budget.findFirst({ where });
}

export async function create(
  data: Prisma.BudgetCreateInput,
  include?: Prisma.BudgetInclude
): Promise<Budget> {
  return prisma.budget.create({ data, include });
}

export async function update(
  id: string,
  data: Prisma.BudgetUpdateInput,
  include?: Prisma.BudgetInclude
): Promise<Budget> {
  return prisma.budget.update({ where: { id }, data, include });
}

export async function remove(id: string): Promise<Budget> {
  return prisma.budget.delete({ where: { id } });
}
