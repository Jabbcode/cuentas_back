import { prisma } from '../lib/prisma.js';
import type { OAuthState } from '@prisma/client';

export async function create(userId: string, expiresAt: Date): Promise<OAuthState> {
  return prisma.oAuthState.create({
    data: { userId, expiresAt },
  });
}

export async function findById(id: string): Promise<OAuthState | null> {
  return prisma.oAuthState.findUnique({ where: { id } });
}

export async function consume(id: string): Promise<void> {
  await prisma.oAuthState.delete({ where: { id } });
}

export async function deleteExpired(): Promise<void> {
  await prisma.oAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
