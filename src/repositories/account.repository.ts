import { prisma } from '../lib/prisma.js';
import type { Prisma, Account, Transfer } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';

export async function findAllByUser(userId: string): Promise<Account[]> {
  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function findByIdAndUser(id: string, userId: string): Promise<Account | null> {
  return prisma.account.findFirst({ where: { id, userId } });
}

export async function findCreditCardsByUser(
  userId: string,
  filters?: {
    paymentAccountId?: { not: null };
    cutoffDay?: { not: null };
    paymentDueDay?: { not: null };
  }
): Promise<Account[]> {
  return prisma.account.findMany({
    where: { userId, type: 'credit_card', ...filters },
  });
}

export async function countByUser(
  userId: string,
  where?: Prisma.AccountWhereInput
): Promise<number> {
  return prisma.account.count({ where: { userId, ...where } });
}

export async function create(data: Prisma.AccountCreateInput): Promise<Account> {
  return prisma.account.create({ data });
}

export async function update(
  id: string,
  userId: string,
  data: Prisma.AccountUpdateInput
): Promise<Account> {
  // Ownership check vive aquí (no en updateMany): data puede traer relaciones con
  // connect/disconnect (paymentAccount), incompatibles con AccountUpdateManyMutationInput.
  const existing = await prisma.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new NotFoundError('Cuenta no encontrada');
  return prisma.account.update({ where: { id }, data });
}

export async function updateBalance(id: string, newBalance: number): Promise<Account> {
  return prisma.account.update({ where: { id }, data: { balance: newBalance } });
}

export async function decrementBalance(id: string, amount: number): Promise<Account> {
  return prisma.account.update({
    where: { id },
    data: { balance: { decrement: amount } },
  });
}

export async function remove(id: string, userId: string): Promise<Account> {
  const existing = await prisma.account.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new NotFoundError('Cuenta no encontrada');
  return prisma.account.delete({ where: { id } });
}

export async function createTransfer(
  data: Prisma.TransferCreateInput
): Promise<Transfer & { fromAccount: Account; toAccount: Account }> {
  return prisma.transfer.create({
    data,
    include: { fromAccount: true, toAccount: true },
  });
}

export async function findTransfersByAccount(
  accountId: string,
  userId: string
): Promise<(Transfer & { fromAccount: Account; toAccount: Account })[]> {
  return prisma.transfer.findMany({
    where: {
      userId,
      OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
    },
    include: { fromAccount: true, toAccount: true },
    orderBy: { date: 'desc' },
  });
}
