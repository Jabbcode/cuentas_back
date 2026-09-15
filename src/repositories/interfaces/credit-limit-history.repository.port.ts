import type { CreditLimitHistory } from '@prisma/client';

export interface CreditLimitHistoryRepository {
  findByAccounts(accountIds: string[], userId: string): Promise<CreditLimitHistory[]>;
}
