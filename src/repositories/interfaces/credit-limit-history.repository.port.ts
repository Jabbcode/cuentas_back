import type { CreditLimitHistory } from '@prisma/client';

export interface CreditLimitHistoryRepository {
  findByAccounts(accountIds: string[], userId: string): Promise<CreditLimitHistory[]>;
  create(accountId: string, creditLimit: number, effectiveFrom: Date): Promise<CreditLimitHistory>;
}
