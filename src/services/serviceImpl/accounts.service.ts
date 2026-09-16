import type { Prisma, PrismaClient, Account } from '@prisma/client';
import {
  CreateAccountInput,
  UpdateAccountInput,
  TransferInput,
} from '../../schemas/account.schema.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import type { AccountRepository } from '../../repositories/interfaces/account.repository.port.js';
import type { CreditLimitHistoryRepository } from '../../repositories/interfaces/credit-limit-history.repository.port.js';
import type { AccountsService, TransferWithAccounts } from '../interfaces/accounts.service.port.js';
import { TRANSACTION_TYPE, SHARED_MESSAGES } from '../../lib/constants/shared.constants.js';
import type { TransactionType } from '../../lib/constants/shared.constants.js';
import { ACCOUNT_MESSAGES, ACCOUNT_TYPES } from '../../lib/constants/account.constants.js';

const logger = createLogger('ACCOUNTS');

export class AccountsServiceImpl implements AccountsService {
  constructor(
    private accountRepo: AccountRepository,
    private prisma: PrismaClient,
    private creditLimitHistoryRepo: CreditLimitHistoryRepository
  ) {}

  async getAccounts(userId: string): Promise<Account[]> {
    try {
      return await this.accountRepo.findAllByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudieron obtener las cuentas del usuario {}', userId);
    }
  }

  async getAccountById(id: string, userId: string): Promise<Account> {
    try {
      const account = await this.accountRepo.findByIdAndUser(id, userId);

      if (!account) {
        throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      return account;
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener la cuenta {} del usuario {}', id, userId);
    }
  }

  async findAccountById(id: string, userId: string): Promise<Account | null> {
    try {
      return await this.accountRepo.findByIdAndUser(id, userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo buscar la cuenta {} del usuario {}', id, userId);
    }
  }

  async getCreditCards(userId: string): Promise<Account[]> {
    try {
      return await this.accountRepo.findCreditCardsByUser(userId);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las tarjetas de credito del usuario {}',
        userId
      );
    }
  }

  async getConfiguredCreditCards(userId: string): Promise<Account[]> {
    try {
      return await this.accountRepo.findCreditCardsByUser(userId, {
        paymentAccountId: { not: null },
        cutoffDay: { not: null },
        paymentDueDay: { not: null },
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las tarjetas de credito configuradas del usuario {}',
        userId
      );
    }
  }

  async countByUser(userId: string): Promise<number> {
    try {
      return await this.accountRepo.countByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo contar las cuentas del usuario {}', userId);
    }
  }

  async createAccount(data: CreateAccountInput, userId: string): Promise<Account> {
    try {
      const { paymentAccountId, ...rest } = data;
      const account = await this.accountRepo.create({
        ...rest,
        user: { connect: { id: userId } },
        ...(paymentAccountId && { paymentAccount: { connect: { id: paymentAccountId } } }),
      });

      if (data.type === ACCOUNT_TYPES.CREDIT_CARD && data.creditLimit != null) {
        await this.creditLimitHistoryRepo.create(account.id, data.creditLimit, account.createdAt);
      }

      return account;
    } catch (error) {
      return logger.fail(error, 'No se pudo crear la cuenta del usuario {}', userId);
    }
  }

  async updateAccount(id: string, data: UpdateAccountInput, userId: string): Promise<Account> {
    const existing = await this.getAccountById(id, userId);

    try {
      const { paymentAccountId, ...rest } = data;
      const limitChanged =
        data.creditLimit !== undefined && data.creditLimit !== Number(existing.creditLimit);
      const limitEntry =
        limitChanged && data.creditLimit != null
          ? { creditLimit: data.creditLimit, effectiveFrom: new Date() }
          : null;

      return await this.accountRepo.updateWithCreditLimitHistory(
        id,
        userId,
        {
          ...rest,
          ...(paymentAccountId !== undefined && {
            paymentAccount: paymentAccountId
              ? { connect: { id: paymentAccountId } }
              : { disconnect: true },
          }),
        },
        limitEntry
      );
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar la cuenta {} del usuario {}', id, userId);
    }
  }

  async deleteAccount(id: string, userId: string): Promise<Account> {
    await this.getAccountById(id, userId);

    try {
      return await this.accountRepo.remove(id, userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar la cuenta {} del usuario {}', id, userId);
    }
  }

  async transferFunds(data: TransferInput, userId: string): Promise<TransferWithAccounts> {
    const { fromAccountId, toAccountId, amount, note } = data;

    try {
      if (fromAccountId === toAccountId) {
        throw new ValidationError(ACCOUNT_MESSAGES.SAME_ORIGIN_DESTINATION);
      }

      const [fromAccount, toAccount] = await Promise.all([
        this.accountRepo.findByIdAndUser(fromAccountId, userId),
        this.accountRepo.findByIdAndUser(toAccountId, userId),
      ]);

      if (!fromAccount) throw new NotFoundError(ACCOUNT_MESSAGES.ORIGIN_NOT_FOUND);
      if (!toAccount) throw new NotFoundError(ACCOUNT_MESSAGES.DESTINATION_NOT_FOUND);
      if (Number(fromAccount.balance) < amount) {
        logger.warn(
          'Transferencia rechazada: cuenta {} balance={} monto={}',
          fromAccountId,
          fromAccount.balance,
          amount
        );
        throw new ValidationError(ACCOUNT_MESSAGES.INSUFFICIENT_BALANCE_ORIGIN);
      }

      return await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo transferir del usuario {} desde la cuenta {} hacia la cuenta {}',
        userId,
        fromAccountId,
        toAccountId
      );
    }
  }

  async getTransfersByAccount(accountId: string, userId: string): Promise<TransferWithAccounts[]> {
    await this.getAccountById(accountId, userId);

    try {
      return await this.accountRepo.findTransfersByAccount(accountId, userId);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las transferencias de la cuenta {} del usuario {}',
        accountId,
        userId
      );
    }
  }

  async updateAccountBalance(
    accountId: string,
    userId: string,
    amount: number,
    type: TransactionType,
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    try {
      const result = await tx.account.updateMany({
        where: { id: accountId, userId },
        data: {
          balance: type === TRANSACTION_TYPE.INCOME ? { increment: amount } : { decrement: amount },
        },
      });

      if (result.count === 0) {
        throw new NotFoundError(SHARED_MESSAGES.ACCOUNT_NOT_FOUND);
      }
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo actualizar el balance de la cuenta {} del usuario {}',
        accountId,
        userId
      );
    }
  }
}
