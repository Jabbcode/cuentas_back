import { prisma } from '../lib/prisma.js';
import type { Prisma, Transaction, ReceiptItem } from '@prisma/client';

export async function findMany(
  where: Prisma.TransactionWhereInput,
  options?: {
    include?: Prisma.TransactionInclude;
    orderBy?: Prisma.TransactionOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }
): Promise<Transaction[]> {
  return prisma.transaction.findMany({ where, ...options });
}

export async function count(where: Prisma.TransactionWhereInput): Promise<number> {
  return prisma.transaction.count({ where });
}

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.TransactionInclude
): Promise<Transaction | null> {
  return prisma.transaction.findFirst({ where: { id, userId }, include });
}

export async function findFirst(
  where: Prisma.TransactionWhereInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction | null> {
  return prisma.transaction.findFirst({ where, include });
}

export async function create(
  data: Prisma.TransactionCreateInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction> {
  return prisma.transaction.create({ data, include });
}

export async function update(
  id: string,
  data: Prisma.TransactionUpdateInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction> {
  return prisma.transaction.update({ where: { id }, data, include });
}

export async function updateMany(
  where: Prisma.TransactionWhereInput,
  data: Prisma.TransactionUpdateManyMutationInput
): Promise<Prisma.BatchPayload> {
  return prisma.transaction.updateMany({ where, data });
}

export async function remove(id: string): Promise<Transaction> {
  return prisma.transaction.delete({ where: { id } });
}

export function groupByCategory(where: Prisma.TransactionWhereInput) {
  return prisma.transaction.groupBy({
    by: ['categoryId', 'type'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });
}

export async function aggregate(
  where: Prisma.TransactionWhereInput
): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
  return prisma.transaction.aggregate({ where, _sum: { amount: true } });
}

export async function findReceiptItems(transactionId: string): Promise<ReceiptItem[]> {
  return prisma.receiptItem.findMany({
    where: { transactionId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function countByUser(userId: string): Promise<number> {
  return prisma.transaction.count({ where: { userId } });
}

export async function findFirstByUser(
  userId: string,
  orderBy: Prisma.TransactionOrderByWithRelationInput
): Promise<{ date: Date } | null> {
  return prisma.transaction.findFirst({
    where: { userId },
    orderBy,
    select: { date: true },
  });
}
