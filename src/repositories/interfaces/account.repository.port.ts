import type { Prisma, Account, Transfer } from '@prisma/client';

export interface AccountRepository {
  findAllByUser(userId: string): Promise<Account[]>;
  findByIdAndUser(id: string, userId: string): Promise<Account | null>;
  findCreditCardsByUser(
    userId: string,
    filters?: {
      paymentAccountId?: { not: null };
      cutoffDay?: { not: null };
      paymentDueDay?: { not: null };
    }
  ): Promise<Account[]>;
  countByUser(userId: string, where?: Prisma.AccountWhereInput): Promise<number>;
  create(data: Prisma.AccountCreateInput): Promise<Account>;
  update(id: string, userId: string, data: Prisma.AccountUpdateInput): Promise<Account>;
  updateBalance(id: string, newBalance: number): Promise<Account>;
  decrementBalance(id: string, amount: number): Promise<Account>;
  remove(id: string, userId: string): Promise<Account>;
  createTransfer(
    data: Prisma.TransferCreateInput
  ): Promise<Transfer & { fromAccount: Account; toAccount: Account }>;
  findTransfersByAccount(
    accountId: string,
    userId: string
  ): Promise<(Transfer & { fromAccount: Account; toAccount: Account })[]>;
}
