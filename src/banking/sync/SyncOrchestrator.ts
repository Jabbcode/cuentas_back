import type { BankConnection } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { IBankingProvider } from '../ports/IBankingProvider.js';
import type { TrueLayerTransaction, SyncResult } from '../../types/index.js';
import * as bankConnectionRepo from '../../repositories/bankConnection.repository.js';
import * as categoryRepo from '../../repositories/category.repository.js';
import * as transactionRepo from '../../repositories/transaction.repository.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const BANKING_CATEGORY_NAME = 'Bancario';

async function findOrCreateBankingCategory(userId: string): Promise<string> {
  const existing = await categoryRepo.findFirst({ userId, name: BANKING_CATEGORY_NAME });
  if (existing) return existing.id;

  const created = await categoryRepo.create({
    name: BANKING_CATEGORY_NAME,
    type: 'expense',
    user: { connect: { id: userId } },
  });

  return created.id;
}

function mapTransaction(
  tx: TrueLayerTransaction,
  connection: BankConnection,
  categoryId: string
): Prisma.TransactionCreateInput {
  const isExpense = tx.amount < 0;

  return {
    amount: Math.abs(tx.amount),
    type: isExpense ? 'expense' : 'income',
    description: tx.description,
    date: new Date(tx.timestamp),
    source: 'bank_sync',
    externalId: tx.transaction_id,
    bankMetadata: {
      merchant_name: tx.merchant_name ?? null,
      transaction_category: tx.transaction_category ?? null,
      transaction_type: tx.transaction_type,
      running_balance: tx.running_balance ?? null,
    } as Prisma.InputJsonValue,
    account: { connect: { id: connection.accountId } },
    category: { connect: { id: categoryId } },
    user: { connect: { id: connection.userId } },
  };
}

export class SyncOrchestrator {
  private readonly provider: IBankingProvider;

  constructor(provider: IBankingProvider) {
    this.provider = provider;
  }

  async sync(connection: BankConnection): Promise<SyncResult> {
    let currentAccessToken = connection.accessToken;
    let currentRefreshToken = connection.refreshToken;

    const tokenExpiresAt = new Date(connection.tokenExpiresAt);
    const refreshThreshold = new Date(Date.now() + TOKEN_REFRESH_THRESHOLD_MS);

    if (tokenExpiresAt < refreshThreshold) {
      const refreshed = await this.provider.refreshToken(currentRefreshToken);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

      await bankConnectionRepo.updateTokens(
        connection.id,
        refreshed.access_token,
        refreshed.refresh_token,
        newExpiresAt
      );

      currentAccessToken = refreshed.access_token;
      currentRefreshToken = refreshed.refresh_token;
    }

    const from = connection.lastSyncedAt ?? new Date(Date.now() - THIRTY_DAYS_MS);
    const to = new Date();

    const truelayerTxs = await this.provider.getTransactions(
      currentAccessToken,
      connection.truelayerAccountId,
      from,
      to
    );

    const categoryId = await findOrCreateBankingCategory(connection.userId);
    let synced = 0;

    for (const tx of truelayerTxs) {
      const existing = await transactionRepo.findFirst({ externalId: tx.transaction_id });
      if (existing) continue;

      const data = mapTransaction(tx, connection, categoryId);
      await transactionRepo.create(data);
      synced++;
    }

    await bankConnectionRepo.updateLastSyncedAt(connection.id, to);

    return { connectionId: connection.id, synced };
  }
}
