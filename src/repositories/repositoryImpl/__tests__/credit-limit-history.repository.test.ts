import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { CreditLimitHistoryRepositoryImpl } from '../credit-limit-history.repository.js';
import { fakePrismaModels } from './prisma-fakes.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return fakePrismaModels(
    {
      creditLimitHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    overrides
  );
}

describe('CreditLimitHistoryRepositoryImpl', () => {
  it('findByAccounts filtra por accountId y por account.userId, ordenado por effectiveFrom asc', async () => {
    const prisma = fakePrisma();
    const repo = new CreditLimitHistoryRepositoryImpl(prisma);

    await repo.findByAccounts(['card-1', 'card-2'], 'user-1');

    expect(prisma.creditLimitHistory.findMany).toHaveBeenCalledWith({
      where: { accountId: { in: ['card-1', 'card-2'] }, account: { userId: 'user-1' } },
      orderBy: { effectiveFrom: 'asc' },
    });
  });
});
