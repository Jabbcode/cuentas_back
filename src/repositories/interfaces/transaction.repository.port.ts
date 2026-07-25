import type { Prisma, Transaction, ReceiptItem } from '@prisma/client';

export interface TransactionRepository {
  findMany(
    where: Prisma.TransactionWhereInput,
    options?: {
      include?: Prisma.TransactionInclude;
      orderBy?: Prisma.TransactionOrderByWithRelationInput;
      take?: number;
      skip?: number;
    }
  ): Promise<Transaction[]>;
  count(where: Prisma.TransactionWhereInput): Promise<number>;
  findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.TransactionInclude
  ): Promise<Transaction | null>;
  findFirst(
    where: Prisma.TransactionWhereInput,
    include?: Prisma.TransactionInclude
  ): Promise<Transaction | null>;
  updateMany(
    where: Prisma.TransactionWhereInput,
    data: Prisma.TransactionUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload>;
  groupByCategory(where: Prisma.TransactionWhereInput): Promise<
    Array<{
      categoryId: string;
      type: string;
      _sum: { amount: Prisma.Decimal | null };
      _count: { _all: number };
    }>
  >;
  groupExpensesByCategory(
    where: Prisma.TransactionWhereInput,
    take?: number
  ): Promise<Array<{ categoryId: string; _sum: { amount: Prisma.Decimal | null } }>>;
  groupTotalsByUser(
    where: Prisma.TransactionWhereInput
  ): Promise<Array<{ userId: string; type: string; _sum: { amount: Prisma.Decimal | null } }>>;
  groupExpensesByUserAndCategory(where: Prisma.TransactionWhereInput): Promise<
    Array<{
      userId: string;
      categoryId: string;
      _sum: { amount: Prisma.Decimal | null };
    }>
  >;
  aggregate(
    where: Prisma.TransactionWhereInput
  ): Promise<{ _sum: { amount: Prisma.Decimal | null } }>;
  findReceiptItems(transactionId: string): Promise<ReceiptItem[]>;
  countByUser(userId: string): Promise<number>;
  findFirstByUser(
    userId: string,
    orderBy: Prisma.TransactionOrderByWithRelationInput
  ): Promise<{ date: Date } | null>;
}
