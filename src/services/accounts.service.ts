import { prisma } from '../lib/prisma.js';
import { CreateAccountInput, UpdateAccountInput } from '../schemas/account.schema.js';

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
    throw new Error('Cuenta no encontrada');
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

export async function updateAccountBalance(
  accountId: string,
  amount: number,
  type: 'expense' | 'income'
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');
  }

  const currentBalance = Number(account.balance);
  const newBalance = type === 'income' ? currentBalance + amount : currentBalance - amount;

  return prisma.account.update({
    where: { id: accountId },
    data: { balance: newBalance },
  });
}
