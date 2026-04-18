import { prisma } from '../lib/prisma.js';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from '../schemas/transaction.schema.js';
import { updateAccountBalance } from './accounts.service.js';

export async function getTransactions(userId: string, query: TransactionQuery) {
  const { startDate, endDate, accountId, categoryId, type, limit = 50, offset = 0 } = query;

  const where: Record<string, unknown> = { userId };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
  }

  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (type) where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
        fixedExpense: { select: { id: true, name: true } },
        _count: {
          select: { receiptItems: true },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, limit, offset };
}

export async function getTransactionById(id: string, userId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      receiptItems: true,
    },
  });

  if (!transaction) {
    throw new Error('Transacción no encontrada');
  }

  return transaction;
}

export async function createTransaction(data: CreateTransactionInput, userId: string) {
  const transaction = await prisma.transaction.create({
    data: {
      amount: data.amount,
      type: data.type,
      description: data.description,
      date: data.date ? new Date(data.date) : new Date(),
      accountId: data.accountId,
      categoryId: data.categoryId,
      fixedExpenseId: data.fixedExpenseId,
      imageHash: data.imageHash,
      userId,
      receiptItems: data.receiptItems ? {
        create: data.receiptItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      } : undefined,
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
      receiptItems: true,
    },
  });

  // Update account balance
  await updateAccountBalance(data.accountId, data.amount, data.type);

  return transaction;
}

export async function updateTransaction(id: string, data: UpdateTransactionInput, userId: string) {
  const existing = await getTransactionById(id, userId);

  // Revert old balance change
  await updateAccountBalance(
    existing.accountId,
    Number(existing.amount),
    existing.type === 'income' ? 'expense' : 'income'
  );

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  // Apply new balance change
  await updateAccountBalance(
    updated.accountId,
    Number(updated.amount),
    updated.type as 'expense' | 'income'
  );

  return updated;
}

export async function deleteTransaction(id: string, userId: string) {
  const transaction = await getTransactionById(id, userId);

  // Revert balance change
  await updateAccountBalance(
    transaction.accountId,
    Number(transaction.amount),
    transaction.type === 'income' ? 'expense' : 'income'
  );

  return prisma.transaction.delete({
    where: { id },
  });
}

export async function getReceiptItems(transactionId: string, userId: string) {
  // Verify transaction belongs to user
  await getTransactionById(transactionId, userId);

  return prisma.receiptItem.findMany({
    where: { transactionId },
    orderBy: { createdAt: 'asc' },
  });
}
