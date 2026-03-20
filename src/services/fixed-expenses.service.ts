import { prisma } from '../lib/prisma.js';
import { CreateFixedExpenseInput, UpdateFixedExpenseInput, PayFixedExpenseInput } from '../schemas/fixed-expense.schema.js';
import { createTransaction } from './transactions.service.js';

export async function getFixedExpenses(userId: string, activeOnly = false) {
  return prisma.fixedExpense.findMany({
    where: {
      userId,
      ...(activeOnly && { isActive: true }),
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
    orderBy: { dueDay: 'asc' },
  });
}

export async function getFixedExpenseById(id: string, userId: string) {
  const fixedExpense = await prisma.fixedExpense.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: {
        orderBy: { date: 'desc' },
        take: 12,
      },
    },
  });

  if (!fixedExpense) {
    throw new Error('Gasto fijo no encontrado');
  }

  return fixedExpense;
}

export async function createFixedExpense(data: CreateFixedExpenseInput, userId: string) {
  return prisma.fixedExpense.create({
    data: {
      ...data,
      userId,
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });
}

export async function updateFixedExpense(id: string, data: UpdateFixedExpenseInput, userId: string) {
  await getFixedExpenseById(id, userId);

  return prisma.fixedExpense.update({
    where: { id },
    data,
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });
}

export async function deleteFixedExpense(id: string, userId: string) {
  await getFixedExpenseById(id, userId);

  return prisma.fixedExpense.delete({
    where: { id },
  });
}

export async function payFixedExpense(id: string, data: PayFixedExpenseInput, userId: string) {
  const fixedExpense = await getFixedExpenseById(id, userId);

  const amount = data.amount ?? Number(fixedExpense.amount);
  const date = data.date ?? new Date().toISOString();

  const transaction = await createTransaction(
    {
      amount,
      type: fixedExpense.type as 'expense' | 'income',
      description: `Pago: ${fixedExpense.name}`,
      date,
      accountId: fixedExpense.accountId,
      categoryId: fixedExpense.categoryId,
      fixedExpenseId: fixedExpense.id,
    },
    userId
  );

  return transaction;
}

export async function getFixedExpensesSummary(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { userId, isActive: true },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      transactions: {
        where: {
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      },
    },
    orderBy: { dueDay: 'asc' },
  });

  const totalMonthlyExpenses = fixedExpenses
    .filter((fe) => fe.type === 'expense')
    .reduce((sum, fe) => sum + Number(fe.amount), 0);

  const totalMonthlyIncome = fixedExpenses
    .filter((fe) => fe.type === 'income')
    .reduce((sum, fe) => sum + Number(fe.amount), 0);

  const paidThisMonth = fixedExpenses.filter((fe) => fe.transactions.length > 0);
  const pendingThisMonth = fixedExpenses.filter((fe) => fe.transactions.length === 0);

  return {
    totalMonthlyExpenses,
    totalMonthlyIncome,
    totalCount: fixedExpenses.length,
    paidCount: paidThisMonth.length,
    pendingCount: pendingThisMonth.length,
    items: fixedExpenses.map((fe) => ({
      ...fe,
      isPaidThisMonth: fe.transactions.length > 0,
      transactions: undefined,
    })),
  };
}
