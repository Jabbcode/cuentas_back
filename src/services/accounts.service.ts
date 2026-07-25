import type { Prisma, PrismaClient, Account } from '@prisma/client';
import {
  CreateAccountInput,
  UpdateAccountInput,
  TransferInput,
} from '../schemas/account.schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { AccountRepository } from '../repositories/account.repository.port.js';
import type { AccountsService, TransferWithAccounts } from './accounts.service.port.js';
import { TRANSACTION_TYPE, SHARED_MESSAGES } from '../lib/constants/shared.constants.js';
import type { TransactionType } from '../lib/constants/shared.constants.js';
import { ACCOUNT_MESSAGES } from '../lib/constants/account.constants.js';

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
      throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
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
      throw new ValidationError(ACCOUNT_MESSAGES.SAME_ORIGIN_DESTINATION);
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepo.findByIdAndUser(fromAccountId, userId),
      this.accountRepo.findByIdAndUser(toAccountId, userId),
    ]);

    if (!fromAccount) throw new NotFoundError(ACCOUNT_MESSAGES.ORIGIN_NOT_FOUND);
    if (!toAccount) throw new NotFoundError(ACCOUNT_MESSAGES.DESTINATION_NOT_FOUND);
    if (Number(fromAccount.balance) < amount)
      throw new ValidationError(ACCOUNT_MESSAGES.INSUFFICIENT_BALANCE_ORIGIN);

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
    type: TransactionType,
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    const result = await tx.account.updateMany({
      where: { id: accountId, userId },
      data: {
        balance: type === TRANSACTION_TYPE.INCOME ? { increment: amount } : { decrement: amount },
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
    }
  }
}
