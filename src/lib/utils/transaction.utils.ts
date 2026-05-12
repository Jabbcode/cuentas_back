import type { Prisma } from '@prisma/client';
import type { TransactionQuery } from '../../schemas/transaction.schema.js';

export function buildTransactionWhereInput(
  userId: string,
  filters: Pick<
    TransactionQuery,
    | 'startDate'
    | 'endDate'
    | 'accountId'
    | 'categoryId'
    | 'categoryIds'
    | 'type'
    | 'tag'
    | 'minAmount'
    | 'maxAmount'
  >
): Prisma.TransactionWhereInput {
  const {
    startDate,
    endDate,
    accountId,
    categoryId,
    categoryIds,
    type,
    tag,
    minAmount,
    maxAmount,
  } = filters;

  const where: Prisma.TransactionWhereInput = { userId };

  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  if (accountId) where.accountId = accountId;

  if (categoryIds?.length) {
    where.categoryId = { in: categoryIds };
  } else if (categoryId) {
    where.categoryId = categoryId;
  }

  if (type) where.type = type;
  if (tag) where.tags = { some: { tag: { name: tag.toLowerCase(), userId } } };

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {
      ...(minAmount !== undefined ? { gte: minAmount } : {}),
      ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
    };
  }

  return where;
}
