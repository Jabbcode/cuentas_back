import type { CreateBudgetInput, UpdateBudgetInput } from '../schemas/budget.schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import type { NotificationPreferences } from '../schemas/notification.schema.js';
import { createNotification } from './notifications.service.js';
import * as budgetRepo from '../repositories/budget.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as notificationRepo from '../repositories/notification.repository.js';
import * as userRepo from '../repositories/user.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';

const categorySelect = { category: { select: { id: true, name: true, icon: true, color: true } } };

export async function getBudgets(userId: string, month: number, year: number) {
  const budgets = await budgetRepo.findAllByUserAndPeriod(userId, month, year, categorySelect);

  if (budgets.length === 0) return [];

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const spentData = await transactionRepo.groupByCategory({
    userId,
    type: 'expense',
    date: { gte: startOfMonth, lte: endOfMonth },
    categoryId: { in: budgets.map((b) => b.categoryId) },
  });

  const spentMap = new Map<string, number>();
  for (const s of spentData) {
    if (!s.categoryId) continue;
    spentMap.set(s.categoryId, (spentMap.get(s.categoryId) ?? 0) + Number(s._sum.amount ?? 0));
  }

  return budgets.map((budget) => {
    const amount = Number(budget.amount);
    const alertAt = budget.alertAt ? Number(budget.alertAt) : 80;
    const spent = spentMap.get(budget.categoryId) ?? 0;
    const percentage = amount > 0 ? (spent / amount) * 100 : 0;

    return {
      ...budget,
      amount,
      alertAt,
      spent,
      remaining: Math.max(0, amount - spent),
      percentage,
      isOverBudget: spent > amount,
      isNearLimit: percentage >= alertAt && spent <= amount,
    };
  });
}

export async function getBudgetById(id: string, userId: string) {
  const budget = await budgetRepo.findByIdAndUser(id, userId, categorySelect);

  if (!budget) throw new NotFoundError('Presupuesto no encontrado');

  return budget;
}

export async function createBudget(data: CreateBudgetInput, userId: string) {
  const existing = await budgetRepo.findFirst({
    userId,
    categoryId: data.categoryId,
    month: data.month,
    year: data.year,
  });

  if (existing) {
    throw new ConflictError('Ya existe un presupuesto para esta categoría en este mes');
  }

  const { categoryId, ...rest } = data;
  return budgetRepo.create(
    { ...rest, user: { connect: { id: userId } }, category: { connect: { id: categoryId } } },
    categorySelect
  );
}

export async function updateBudget(id: string, data: UpdateBudgetInput, userId: string) {
  await getBudgetById(id, userId);

  return budgetRepo.update(id, data, categorySelect);
}

export async function deleteBudget(id: string, userId: string) {
  await getBudgetById(id, userId);
  return budgetRepo.remove(id);
}

export async function checkBudgetAndNotify(userId: string, categoryId: string) {
  const user = await userRepo.findById(userId, { notificationPreferences: true });
  const prefs = user?.notificationPreferences as NotificationPreferences | null;
  if (!prefs?.categoryLimit) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budget = await budgetRepo.findFirst({ userId, categoryId, month, year });
  if (!budget) return;

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const result = await transactionRepo.aggregate({
    userId,
    categoryId,
    type: 'expense',
    date: { gte: startOfMonth, lte: endOfMonth },
  });

  const spent = Number(result._sum.amount ?? 0);
  const limit = Number(budget.amount);
  const alertAt = budget.alertAt ? Number(budget.alertAt) : 80;
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;

  const isOver = spent > limit;
  const isNear = !isOver && percentage >= alertAt;

  if (!isOver && !isNear) return;

  // Avoid duplicate notifications of the same type this month
  const existing = await notificationRepo.findFirst({
    userId,
    type: 'category_limit',
    metadata: { path: ['categoryId'], equals: categoryId },
    createdAt: { gte: startOfMonth },
  });
  if (existing) return;

  const category = await categoryRepo.findByIdAndUser(categoryId, userId);
  const categoryName = category?.name ?? categoryId;

  if (isOver) {
    await createNotification(
      userId,
      'category_limit',
      `Presupuesto superado: ${categoryName}`,
      `Has superado el presupuesto de €${limit.toFixed(2)} en ${categoryName}. Gasto actual: €${spent.toFixed(2)}.`,
      { categoryId, spent, limit, percentage }
    );
  } else {
    await createNotification(
      userId,
      'category_limit',
      `Presupuesto al ${Math.round(percentage)}%: ${categoryName}`,
      `Llevas €${spent.toFixed(2)} de €${limit.toFixed(2)} en ${categoryName} este mes.`,
      { categoryId, spent, limit, percentage }
    );
  }
}
