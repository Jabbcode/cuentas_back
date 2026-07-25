import type { Prisma, FixedExpense } from '@prisma/client';

export interface FixedExpenseRepository {
  findAllByUser(
    userId: string,
    filters?: Prisma.FixedExpenseWhereInput,
    include?: Prisma.FixedExpenseInclude,
    orderBy?: Prisma.FixedExpenseOrderByWithRelationInput[]
  ): Promise<FixedExpense[]>;
  findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.FixedExpenseInclude
  ): Promise<FixedExpense | null>;
  findFirst(where: Prisma.FixedExpenseWhereInput): Promise<FixedExpense | null>;
  findMany(
    where: Prisma.FixedExpenseWhereInput,
    include?: Prisma.FixedExpenseInclude
  ): Promise<FixedExpense[]>;
  countByUser(userId: string): Promise<number>;
  create(
    data: Prisma.FixedExpenseCreateInput,
    include?: Prisma.FixedExpenseInclude
  ): Promise<FixedExpense>;
  update(
    id: string,
    data: Prisma.FixedExpenseUpdateInput,
    include?: Prisma.FixedExpenseInclude
  ): Promise<FixedExpense>;
  remove(id: string): Promise<FixedExpense>;
}
