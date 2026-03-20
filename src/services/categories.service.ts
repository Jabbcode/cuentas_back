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
