import { prisma } from '../lib/prisma.js';
import type { Prisma, Account, Transfer, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';
import type { AccountRepository } from './account.repository.port.js';

export class AccountRepositoryImpl implements AccountRepository {
  constructor(private prisma: PrismaClient) {}

  async findAllByUser(userId: string): Promise<Account[]> {
    return this.prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async findByIdAndUser(id: string, userId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({ where: { id, userId } });
  }

  async findCreditCardsByUser(
    userId: string,
    filters?: {
      paymentAccountId?: { not: null };
      cutoffDay?: { not: null };
      paymentDueDay?: { not: null };
    }
  ): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { userId, type: 'credit_card', ...filters },
    });
  }

  async countByUser(userId: string, where?: Prisma.AccountWhereInput): Promise<number> {
    return this.prisma.account.count({ where: { userId, ...where } });
  }

  async create(data: Prisma.AccountCreateInput): Promise<Account> {
    return this.prisma.account.create({ data });
  }

  async update(id: string, userId: string, data: Prisma.AccountUpdateInput): Promise<Account> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Cuenta no encontrada');
    return this.prisma.account.update({ where: { id }, data });
  }

  async updateBalance(id: string, newBalance: number): Promise<Account> {
    return this.prisma.account.update({ where: { id }, data: { balance: newBalance } });
  }

  async decrementBalance(id: string, amount: number): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { balance: { decrement: amount } },
    });
  }

  async remove(id: string, userId: string): Promise<Account> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Cuenta no encontrada');
    return this.prisma.account.delete({ where: { id } });
  }

  async createTransfer(
    data: Prisma.TransferCreateInput
  ): Promise<Transfer & { fromAccount: Account; toAccount: Account }> {
    return this.prisma.transfer.create({
      data,
      include: { fromAccount: true, toAccount: true },
    });
  }

  async findTransfersByAccount(
    accountId: string,
    userId: string
  ): Promise<(Transfer & { fromAccount: Account; toAccount: Account })[]> {
    return this.prisma.transfer.findMany({
      where: {
        userId,
        OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      },
      include: { fromAccount: true, toAccount: true },
      orderBy: { date: 'desc' },
    });
  }
}

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
