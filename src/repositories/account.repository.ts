import type { Prisma, Account, Transfer, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../lib/errors.js';
import type { AccountRepository } from './account.repository.port.js';
import { ACCOUNT_TYPES } from '../lib/constants/account.constants.js';
import { SHARED_MESSAGES } from '../lib/constants/shared.constants.js';

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
      where: { userId, type: ACCOUNT_TYPES.CREDIT_CARD, ...filters },
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
    if (!existing) throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
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
    if (!existing) throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
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
