import type { Prisma, Debt } from '@prisma/client';

export interface DebtRepository {
  create(data: Prisma.DebtCreateInput): Promise<Debt>;
  findAllByUser(where: Prisma.DebtWhereInput, include?: Prisma.DebtInclude): Promise<Debt[]>;
  findByIdAndUser(id: string, userId: string, include?: Prisma.DebtInclude): Promise<Debt | null>;
  countByUser(userId: string): Promise<number>;
  update(id: string, data: Prisma.DebtUpdateInput): Promise<Debt>;
  remove(id: string): Promise<void>;
}
