import { prisma } from '../lib/prisma.js';
import type { Prisma, Debt } from '@prisma/client';

export async function create(data: Prisma.DebtCreateInput): Promise<Debt> {
  return prisma.debt.create({ data });
}

export async function findAllByUser(
  where: Prisma.DebtWhereInput,
  include?: Prisma.DebtInclude
): Promise<Debt[]> {
  return prisma.debt.findMany({
    where,
    include,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.DebtInclude
): Promise<Debt | null> {
  return prisma.debt.findFirst({ where: { id, userId }, include });
}

export async function countByUser(userId: string): Promise<number> {
  return prisma.debt.count({ where: { userId } });
}

export async function update(id: string, data: Prisma.DebtUpdateInput): Promise<Debt> {
  return prisma.debt.update({ where: { id }, data });
}

export async function remove(id: string): Promise<void> {
  await prisma.debt.delete({ where: { id } });
}
