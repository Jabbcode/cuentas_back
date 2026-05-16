import { prisma } from '../lib/prisma.js';
import type { BankConnection, Prisma } from '@prisma/client';

export async function findAllActiveByUser(userId: string): Promise<BankConnection[]> {
  return prisma.bankConnection.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findAllActive(): Promise<BankConnection[]> {
  return prisma.bankConnection.findMany({
    where: { isActive: true },
  });
}

export async function findByIdAndUser(id: string, userId: string): Promise<BankConnection | null> {
  return prisma.bankConnection.findFirst({ where: { id, userId } });
}

export async function findByTruelayerAccountId(
  userId: string,
  truelayerAccountId: string
): Promise<BankConnection | null> {
  return prisma.bankConnection.findFirst({ where: { userId, truelayerAccountId } });
}

export async function create(data: Prisma.BankConnectionCreateInput): Promise<BankConnection> {
  return prisma.bankConnection.create({ data });
}

export async function updateTokens(
  id: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: Date
): Promise<BankConnection> {
  return prisma.bankConnection.update({
    where: { id },
    data: { accessToken, refreshToken, tokenExpiresAt },
  });
}

export async function updateLastSyncedAt(id: string, lastSyncedAt: Date): Promise<BankConnection> {
  return prisma.bankConnection.update({
    where: { id },
    data: { lastSyncedAt },
  });
}

export async function deactivate(id: string): Promise<BankConnection> {
  return prisma.bankConnection.update({
    where: { id },
    data: { isActive: false },
  });
}
