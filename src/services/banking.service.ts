import type { BankConnection } from '@prisma/client';
import type { ConfirmMappingsInput } from '../schemas/banking.schema.js';
import type { TrueLayerAccount, BankConnectionStatus } from '../types/index.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import * as oauthStateRepo from '../repositories/oauthState.repository.js';
import * as pendingBankAuthRepo from '../repositories/pendingBankAuth.repository.js';
import * as bankConnectionRepo from '../repositories/bankConnection.repository.js';
import * as accountRepo from '../repositories/account.repository.js';
import { createTrueLayerAdapter } from '../banking/providers/truelayer/TrueLayerAdapter.js';
import { SyncOrchestrator } from '../banking/sync/SyncOrchestrator.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PENDING_AUTH_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getProvider() {
  return createTrueLayerAdapter();
}

export async function getProviders(countryCode?: string) {
  const provider = getProvider();
  return provider.getProviders(countryCode);
}

export async function initConnect(userId: string): Promise<{ authUrl: string }> {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
  const state = await oauthStateRepo.create(userId, expiresAt);

  const provider = getProvider();
  const authUrl = provider.getAuthUrl(state.id);

  return { authUrl };
}

export async function handleCallback(
  code: string,
  stateToken: string
): Promise<{ pendingAuthId: string; userId: string }> {
  const oauthState = await oauthStateRepo.findById(stateToken);

  if (!oauthState) {
    throw new ValidationError('Invalid or expired OAuth state');
  }

  if (oauthState.expiresAt < new Date()) {
    await oauthStateRepo.consume(stateToken);
    throw new ValidationError('OAuth state has expired');
  }

  await oauthStateRepo.consume(stateToken);

  const provider = getProvider();
  const tokens = await provider.exchangeCode(code);

  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const accounts = await provider.getAccounts(tokens.access_token);

  const expiresAt = new Date(Date.now() + PENDING_AUTH_TTL_MS);
  const pending = await pendingBankAuthRepo.create(
    oauthState.userId,
    tokens.access_token,
    tokens.refresh_token,
    tokenExpiresAt,
    accounts,
    expiresAt
  );

  return { pendingAuthId: pending.id, userId: oauthState.userId };
}

export async function getPendingAccounts(
  pendingAuthId: string,
  userId: string
): Promise<{ accounts: TrueLayerAccount[] }> {
  const pending = await pendingBankAuthRepo.findById(pendingAuthId);

  if (!pending) {
    throw new NotFoundError('Pending bank auth not found');
  }

  if (pending.userId !== userId) {
    throw new ForbiddenError();
  }

  if (pending.expiresAt < new Date()) {
    await pendingBankAuthRepo.remove(pendingAuthId);
    throw new ValidationError('Pending bank auth has expired');
  }

  return { accounts: pending.truelayerAccounts as unknown as TrueLayerAccount[] };
}

export async function confirmMappings(
  data: ConfirmMappingsInput,
  userId: string
): Promise<{ connections: BankConnection[] }> {
  const pending = await pendingBankAuthRepo.findById(data.pendingAuthId);

  if (!pending) {
    throw new NotFoundError('Pending bank auth not found');
  }

  if (pending.userId !== userId) {
    throw new ForbiddenError();
  }

  if (pending.expiresAt < new Date()) {
    await pendingBankAuthRepo.remove(data.pendingAuthId);
    throw new ValidationError('Pending bank auth has expired');
  }

  const truelayerAccounts = pending.truelayerAccounts as unknown as TrueLayerAccount[];
  const connections: BankConnection[] = [];

  for (const mapping of data.mappings) {
    const tlAccount = truelayerAccounts.find((a) => a.account_id === mapping.truelayerAccountId);

    if (!tlAccount) {
      throw new ValidationError(
        `TrueLayer account ${mapping.truelayerAccountId} not found in pending auth`
      );
    }

    const appAccount = await accountRepo.findByIdAndUser(mapping.appAccountId, userId);
    if (!appAccount) {
      throw new NotFoundError(`App account ${mapping.appAccountId} not found`);
    }

    const bankName = tlAccount.provider?.display_name ?? 'Unknown Bank';
    const connection = await bankConnectionRepo.create({
      user: { connect: { id: userId } },
      provider: 'truelayer',
      truelayerAccountId: mapping.truelayerAccountId,
      accountName: tlAccount.display_name,
      bankName,
      currency: tlAccount.currency,
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      tokenExpiresAt: pending.tokenExpiresAt,
      account: { connect: { id: mapping.appAccountId } },
    });

    connections.push(connection);
  }

  await pendingBankAuthRepo.remove(data.pendingAuthId);

  // Trigger initial sync in background for each new connection
  const provider = getProvider();
  const orchestrator = new SyncOrchestrator(provider);
  for (const conn of connections) {
    orchestrator.sync(conn).catch(() => {
      // Background sync failure should not block the response
    });
  }

  return { connections };
}

export async function getConnections(userId: string): Promise<BankConnection[]> {
  return bankConnectionRepo.findAllActiveByUser(userId);
}

export async function disconnect(connectionId: string, userId: string): Promise<void> {
  const connection = await bankConnectionRepo.findByIdAndUser(connectionId, userId);

  if (!connection) {
    throw new NotFoundError('Bank connection not found');
  }

  await bankConnectionRepo.deactivate(connectionId);
}

export async function triggerSync(
  connectionId: string,
  userId: string
): Promise<{ synced: number }> {
  const connection = await bankConnectionRepo.findByIdAndUser(connectionId, userId);

  if (!connection) {
    throw new NotFoundError('Bank connection not found');
  }

  if (!connection.isActive) {
    throw new ValidationError('Bank connection is inactive');
  }

  const provider = getProvider();
  const orchestrator = new SyncOrchestrator(provider);
  const result = await orchestrator.sync(connection);

  return { synced: result.synced };
}

export async function getStatus(userId: string): Promise<{
  isConnected: boolean;
  connections: BankConnectionStatus[];
}> {
  const connections = await bankConnectionRepo.findAllActiveByUser(userId);

  const statuses: BankConnectionStatus[] = connections.map((c) => ({
    id: c.id,
    bankName: c.bankName,
    accountName: c.accountName,
    lastSyncedAt: c.lastSyncedAt,
    isActive: c.isActive,
    accountId: c.accountId,
  }));

  return {
    isConnected: connections.length > 0,
    connections: statuses,
  };
}
