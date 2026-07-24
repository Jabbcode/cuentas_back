import type { Prisma, Debt, PrismaClient } from '@prisma/client';
import type { DebtRepository } from './debt.repository.port.js';

export class DebtRepositoryImpl implements DebtRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.DebtCreateInput): Promise<Debt> {
    return this.prisma.debt.create({ data });
  }

  async findAllByUser(where: Prisma.DebtWhereInput, include?: Prisma.DebtInclude): Promise<Debt[]> {
    return this.prisma.debt.findMany({
      where,
      include,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.DebtInclude
  ): Promise<Debt | null> {
    return this.prisma.debt.findFirst({ where: { id, userId }, include });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.debt.count({ where: { userId } });
  }

  async update(id: string, data: Prisma.DebtUpdateInput): Promise<Debt> {
    return this.prisma.debt.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.debt.delete({ where: { id } });
  }
}
