import type { Prisma, Account, Transfer } from '@prisma/client';
import {
  CreateAccountInput,
  UpdateAccountInput,
  TransferInput,
} from '../schemas/account.schema.js';

export type TransferWithAccounts = Transfer & { fromAccount: Account; toAccount: Account };

export interface AccountsService {
  getAccounts(userId: string): Promise<Account[]>;
  getAccountById(id: string, userId: string): Promise<Account>;
  createAccount(data: CreateAccountInput, userId: string): Promise<Account>;
  updateAccount(id: string, data: UpdateAccountInput, userId: string): Promise<Account>;
  deleteAccount(id: string, userId: string): Promise<Account>;
  transferFunds(data: TransferInput, userId: string): Promise<TransferWithAccounts>;
  getTransfersByAccount(accountId: string, userId: string): Promise<TransferWithAccounts[]>;
  updateAccountBalance(
    accountId: string,
    userId: string,
    amount: number,
    type: 'expense' | 'income',
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}
