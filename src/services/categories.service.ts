import { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import * as categoryRepo from '../repositories/category.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import { getMonthRange } from '../lib/utils/date.utils.js';

export async function getCategories(userId: string, type?: 'expense' | 'income') {
  return categoryRepo.findAllByUser(userId, type);
}

export async function getCategoryById(id: string, userId: string) {
  const category = await categoryRepo.findByIdAndUser(id, userId);

  if (!category) {
    throw new NotFoundError('Categoría no encontrada');
  }

  return category;
}

export async function createCategory(data: CreateCategoryInput, userId: string) {
  return categoryRepo.create({ ...data, user: { connect: { id: userId } } });
}

export async function updateCategory(id: string, data: UpdateCategoryInput, userId: string) {
  await getCategoryById(id, userId);

  return categoryRepo.update(id, data);
}

export async function deleteCategory(id: string, userId: string) {
  await getCategoryById(id, userId);

  // Check if category has transactions
  const transactionCount = await transactionRepo.count({ categoryId: id });

  if (transactionCount > 0) {
    throw new ConflictError('No se puede eliminar una categoría con transacciones asociadas');
  }

  return categoryRepo.remove(id);
}

export async function getCategorySpending(categoryId: string, userId: string) {
  const category = await getCategoryById(categoryId, userId);

  const now = new Date();
  const { start: startOfMonth, end: endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth());

  const transactions = await transactionRepo.findMany({
    categoryId,
    userId,
    type: 'expense',
    date: { gte: startOfMonth, lt: endOfMonth },
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
