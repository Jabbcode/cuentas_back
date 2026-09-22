import { Prisma } from '@prisma/client';
import type { Transaction, ReceiptItem, PrismaClient } from '@prisma/client';
import type { TransactionRepository } from '../interfaces/transaction.repository.port.js';
import type { TransactionType } from '../../lib/constants/shared.constants.js';

export class TransactionRepositoryImpl implements TransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async findMany(
    where: Prisma.TransactionWhereInput,
    options?: {
      include?: Prisma.TransactionInclude;
      orderBy?: Prisma.TransactionOrderByWithRelationInput;
      take?: number;
      skip?: number;
    }
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({ where, ...options });
  }

  async count(where: Prisma.TransactionWhereInput): Promise<number> {
    return this.prisma.transaction.count({ where });
  }

  async findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.TransactionInclude
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where: { id, userId }, include });
  }

  async findFirst(
    where: Prisma.TransactionWhereInput,
    include?: Prisma.TransactionInclude
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where, include });
  }

  async updateMany(
    where: Prisma.TransactionWhereInput,
    data: Prisma.TransactionUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.transaction.updateMany({ where, data });
  }

  groupByCategory(where: Prisma.TransactionWhereInput) {
    return this.prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
  }

  groupExpensesByCategory(where: Prisma.TransactionWhereInput, take = 10) {
    return this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take,
    });
  }

  groupTotalsByUser(where: Prisma.TransactionWhereInput) {
    return this.prisma.transaction.groupBy({
      by: ['userId', 'type'],
      where,
      _sum: { amount: true },
    });
  }

  groupExpensesByUserAndCategory(where: Prisma.TransactionWhereInput) {
    return this.prisma.transaction.groupBy({
      by: ['userId', 'categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
  }

  async aggregate(
    where: Prisma.TransactionWhereInput
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }> {
    return this.prisma.transaction.aggregate({ where, _sum: { amount: true } });
  }

  async findReceiptItems(transactionId: string): Promise<ReceiptItem[]> {
    return this.prisma.receiptItem.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.transaction.count({ where: { userId } });
  }

  async findFirstByUser(
    userId: string,
    orderBy: Prisma.TransactionOrderByWithRelationInput
  ): Promise<{ date: Date } | null> {
    return this.prisma.transaction.findFirst({
      where: { userId },
      orderBy,
      select: { date: true },
    });
  }

  async groupByCategoryAndMonth(params: {
    userId: string;
    type: TransactionType;
    gte: Date;
    lte: Date;
    accountId?: string;
  }): Promise<Array<{ categoryId: string; month: string; total: Prisma.Decimal; count: number }>> {
    const { userId, type, gte, lte, accountId } = params;
    const accountFilter = accountId ? Prisma.sql`AND t."accountId" = ${accountId}` : Prisma.empty;

    return this.prisma.$queryRaw<
      Array<{ categoryId: string; month: string; total: Prisma.Decimal; count: number }>
    >(Prisma.sql`
      SELECT t."categoryId"                                   AS "categoryId",
             to_char(date_trunc('month', t."date"), 'YYYY-MM') AS "month",
             SUM(t."amount")                                   AS "total",
             COUNT(*)::int                                     AS "count"
      FROM "Transaction" t
      WHERE t."userId" = ${userId} AND t."type" = ${type}
        AND t."date" >= ${gte} AND t."date" <= ${lte}
        ${accountFilter}
      GROUP BY 1, 2
    `);
  }
}
