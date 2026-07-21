import { prisma } from '../lib/prisma.js';
import type { Prisma, Transaction, ReceiptItem } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';

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
  userId: string,
  data: Prisma.TransactionUncheckedUpdateManyInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction> {
  const result = await prisma.transaction.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Transacción no encontrada');
  return prisma.transaction.findFirstOrThrow({ where: { id, userId }, include });
}

export async function updateMany(
  where: Prisma.TransactionWhereInput,
  data: Prisma.TransactionUpdateManyMutationInput
): Promise<Prisma.BatchPayload> {
  return prisma.transaction.updateMany({ where, data });
}

export async function remove(id: string, userId: string): Promise<void> {
  const result = await prisma.transaction.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Transacción no encontrada');
}

export function groupByCategory(where: Prisma.TransactionWhereInput) {
  return prisma.transaction.groupBy({
    by: ['categoryId', 'type'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });
}

export function groupExpensesByCategory(where: Prisma.TransactionWhereInput, take = 10) {
  return prisma.transaction.groupBy({
    by: ['categoryId'],
    where,
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take,
  });
}

export function groupTotalsByUser(where: Prisma.TransactionWhereInput) {
  return prisma.transaction.groupBy({
    by: ['userId', 'type'],
    where,
    _sum: { amount: true },
  });
}

export function groupExpensesByUserAndCategory(where: Prisma.TransactionWhereInput) {
  return prisma.transaction.groupBy({
    by: ['userId', 'categoryId'],
    where,
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
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
