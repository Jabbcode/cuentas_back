import type { CreditLimitHistory, PrismaClient } from '@prisma/client';
import type { CreditLimitHistoryRepository } from '../interfaces/credit-limit-history.repository.port.js';

export class CreditLimitHistoryRepositoryImpl implements CreditLimitHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  async findByAccounts(accountIds: string[], userId: string): Promise<CreditLimitHistory[]> {
    return this.prisma.creditLimitHistory.findMany({
      where: { accountId: { in: accountIds }, account: { userId } },
      orderBy: { effectiveFrom: 'asc' },
    });
  }

  async create(
    accountId: string,
    creditLimit: number,
    effectiveFrom: Date
  ): Promise<CreditLimitHistory> {
    return this.prisma.creditLimitHistory.create({
      data: { accountId, creditLimit, effectiveFrom },
    });
  }
}
