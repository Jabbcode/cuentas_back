import { prisma } from '../lib/prisma.js';
import { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';

export async function getCategories(userId: string, type?: 'expense' | 'income') {
  return prisma.category.findMany({
    where: {
      userId,
      ...(type && { type }),
    },
    orderBy: { name: 'asc' },
  });
}

export async function getCategoryById(id: string, userId: string) {
  const category = await prisma.category.findFirst({
    where: { id, userId },
  });

  if (!category) {
    throw new Error('Categoría no encontrada');
  }

  return category;
}

export async function createCategory(data: CreateCategoryInput, userId: string) {
  return prisma.category.create({
    data: {
      ...data,
      userId,
    },
  });
}

export async function updateCategory(id: string, data: UpdateCategoryInput, userId: string) {
  await getCategoryById(id, userId);

  return prisma.category.update({
    where: { id },
    data,
  });
}

export async function deleteCategory(id: string, userId: string) {
  await getCategoryById(id, userId);

  // Check if category has transactions
  const transactionCount = await prisma.transaction.count({
    where: { categoryId: id },
  });

  if (transactionCount > 0) {
    throw new Error('No se puede eliminar una categoría con transacciones asociadas');
  }

  return prisma.category.delete({
    where: { id },
  });
}

export async function getCategorySpending(categoryId: string, userId: string) {
  const category = await getCategoryById(categoryId, userId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      categoryId,
      userId,
      type: 'expense',
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  const spent = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const limit = category.monthlyLimit ? Number(category.monthlyLimit) : null;
  const percentage = limit && limit > 0 ? (spent / limit) * 100 : null;

  return {
    categoryId: category.id,
    categoryName: category.name,
    spent,
    limit,
    remaining: limit ? Math.max(0, limit - spent) : null,
    percentage,
    isOverLimit: limit ? spent > limit : false,
  };
}
