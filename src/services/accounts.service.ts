import { prisma } from '../lib/prisma.js';
import {
  CreateAccountInput,
  UpdateAccountInput,
  TransferInput,
} from '../schemas/account.schema.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

export async function getAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new NotFoundError('Cuenta no encontrada');
  }

  return account;
}

export async function createAccount(data: CreateAccountInput, userId: string) {
  return prisma.account.create({
    data: {
      ...data,
      userId,
    },
  });
}

export async function updateAccount(id: string, data: UpdateAccountInput, userId: string) {
  await getAccountById(id, userId);

  return prisma.account.update({
    where: { id },
    data,
  });
}

export async function deleteAccount(id: string, userId: string) {
  await getAccountById(id, userId);

  return prisma.account.delete({
    where: { id },
  });
}

export async function transferFunds(data: TransferInput, userId: string) {
  const { fromAccountId, toAccountId, amount, note } = data;

  if (fromAccountId === toAccountId) {
    throw new ValidationError('Las cuentas de origen y destino deben ser diferentes');
  }

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: fromAccountId, userId } }),
    prisma.account.findFirst({ where: { id: toAccountId, userId } }),
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
  return prisma.transfer.findMany({
    where: {
      userId,
      OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
    },
    include: { fromAccount: true, toAccount: true },
    orderBy: { date: 'desc' },
  });
}

export async function updateAccountBalance(
  accountId: string,
  userId: string,
  amount: number,
  type: 'expense' | 'income'
) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) {
    throw new NotFoundError('Cuenta no encontrada');
  }

  const currentBalance = Number(account.balance);
  const newBalance = type === 'income' ? currentBalance + amount : currentBalance - amount;

  return prisma.account.update({
    where: { id: accountId },
    data: { balance: newBalance },
  });
}
