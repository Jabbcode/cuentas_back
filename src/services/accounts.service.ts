import { prisma } from '../lib/prisma.js';
import type { Prisma, PrismaClient, Account } from '@prisma/client';
import {
  CreateAccountInput,
  UpdateAccountInput,
  TransferInput,
} from '../schemas/account.schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import * as accountRepo from '../repositories/account.repository.js';
import type { AccountRepository } from '../repositories/account.repository.port.js';
import type { AccountsService, TransferWithAccounts } from './accounts.service.port.js';

export class AccountsServiceImpl implements AccountsService {
  constructor(
    private accountRepo: AccountRepository,
    private prisma: PrismaClient
  ) {}

  async getAccounts(userId: string): Promise<Account[]> {
    return this.accountRepo.findAllByUser(userId);
  }

  async getAccountById(id: string, userId: string): Promise<Account> {
    const account = await this.accountRepo.findByIdAndUser(id, userId);

    if (!account) {
      throw new NotFoundError('Cuenta no encontrada');
    }

    return account;
  }

  async createAccount(data: CreateAccountInput, userId: string): Promise<Account> {
    const { paymentAccountId, ...rest } = data;
    return this.accountRepo.create({
      ...rest,
      user: { connect: { id: userId } },
      ...(paymentAccountId && { paymentAccount: { connect: { id: paymentAccountId } } }),
    });
  }

  async updateAccount(id: string, data: UpdateAccountInput, userId: string): Promise<Account> {
    await this.getAccountById(id, userId);

    const { paymentAccountId, ...rest } = data;
    return this.accountRepo.update(id, userId, {
      ...rest,
      ...(paymentAccountId !== undefined && {
        paymentAccount: paymentAccountId
          ? { connect: { id: paymentAccountId } }
          : { disconnect: true },
      }),
    });
  }

  async deleteAccount(id: string, userId: string): Promise<Account> {
    await this.getAccountById(id, userId);

    return this.accountRepo.remove(id, userId);
  }

  async transferFunds(data: TransferInput, userId: string): Promise<TransferWithAccounts> {
    const { fromAccountId, toAccountId, amount, note } = data;

    if (fromAccountId === toAccountId) {
      throw new ValidationError('Las cuentas de origen y destino deben ser diferentes');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepo.findByIdAndUser(fromAccountId, userId),
      this.accountRepo.findByIdAndUser(toAccountId, userId),
    ]);

    if (!fromAccount) throw new NotFoundError('Cuenta origen no encontrada');
    if (!toAccount) throw new NotFoundError('Cuenta destino no encontrada');
    if (Number(fromAccount.balance) < amount)
      throw new ValidationError('Saldo insuficiente en la cuenta origen');

    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      });
      await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });
      return tx.transfer.create({
        data: { fromAccountId, toAccountId, amount, note, userId },
        include: { fromAccount: true, toAccount: true },
      });
    });
  }

  async getTransfersByAccount(accountId: string, userId: string): Promise<TransferWithAccounts[]> {
    await this.getAccountById(accountId, userId);
    return this.accountRepo.findTransfersByAccount(accountId, userId);
  }

  async updateAccountBalance(
    accountId: string,
    userId: string,
    amount: number,
    type: 'expense' | 'income',
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    const result = await tx.account.updateMany({
      where: { id: accountId, userId },
      data: { balance: type === 'income' ? { increment: amount } : { decrement: amount } },
    });

    if (result.count === 0) {
      throw new NotFoundError('Cuenta no encontrada');
    }
  }
}

export async function getAccounts(userId: string) {
  return accountRepo.findAllByUser(userId);
}

export async function getAccountById(id: string, userId: string) {
  const account = await accountRepo.findByIdAndUser(id, userId);

  if (!account) {
    throw new NotFoundError('Cuenta no encontrada');
  }

  return account;
}

export async function createAccount(data: CreateAccountInput, userId: string) {
  const { paymentAccountId, ...rest } = data;
  return accountRepo.create({
    ...rest,
    user: { connect: { id: userId } },
    ...(paymentAccountId && { paymentAccount: { connect: { id: paymentAccountId } } }),
  });
}

export async function updateAccount(id: string, data: UpdateAccountInput, userId: string) {
  await getAccountById(id, userId);

  const { paymentAccountId, ...rest } = data;
  return accountRepo.update(id, userId, {
    ...rest,
    ...(paymentAccountId !== undefined && {
      paymentAccount: paymentAccountId
        ? { connect: { id: paymentAccountId } }
        : { disconnect: true },
    }),
  });
}

export async function deleteAccount(id: string, userId: string) {
  await getAccountById(id, userId);

  return accountRepo.remove(id, userId);
}

export async function transferFunds(data: TransferInput, userId: string) {
  const { fromAccountId, toAccountId, amount, note } = data;

  if (fromAccountId === toAccountId) {
    throw new ValidationError('Las cuentas de origen y destino deben ser diferentes');
  }

  const [fromAccount, toAccount] = await Promise.all([
    accountRepo.findByIdAndUser(fromAccountId, userId),
    accountRepo.findByIdAndUser(toAccountId, userId),
  ]);

  if (!fromAccount) throw new NotFoundError('Cuenta origen no encontrada');
  if (!toAccount) throw new NotFoundError('Cuenta destino no encontrada');
  if (Number(fromAccount.balance) < amount)
    throw new ValidationError('Saldo insuficiente en la cuenta origen');

  return prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });
    await tx.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
    });
    return tx.transfer.create({
      data: { fromAccountId, toAccountId, amount, note, userId },
      include: { fromAccount: true, toAccount: true },
    });
  });
}

export async function getTransfersByAccount(accountId: string, userId: string) {
  await getAccountById(accountId, userId);
  return accountRepo.findTransfersByAccount(accountId, userId);
}

export async function updateAccountBalance(
  accountId: string,
  userId: string,
  amount: number,
  type: 'expense' | 'income',
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  const result = await tx.account.updateMany({
    where: { id: accountId, userId },
    data: { balance: type === 'income' ? { increment: amount } : { decrement: amount } },
  });

  if (result.count === 0) {
    throw new NotFoundError('Cuenta no encontrada');
  }
}
