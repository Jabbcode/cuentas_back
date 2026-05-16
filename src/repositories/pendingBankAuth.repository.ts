import { prisma } from '../lib/prisma.js';
import type { TrueLayerAccount } from '../types/index.js';
import type { PendingBankAuth } from '@prisma/client';

export async function create(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: Date,
  truelayerAccounts: TrueLayerAccount[],
  expiresAt: Date
): Promise<PendingBankAuth> {
  return prisma.pendingBankAuth.create({
    data: {
      userId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      truelayerAccounts:
        truelayerAccounts as unknown as import('@prisma/client').Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

export async function findById(id: string): Promise<PendingBankAuth | null> {
  return prisma.pendingBankAuth.findUnique({ where: { id } });
}

export async function remove(id: string): Promise<void> {
  await prisma.pendingBankAuth.delete({ where: { id } });
}
