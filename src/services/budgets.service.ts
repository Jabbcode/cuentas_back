import { prisma } from '../lib/prisma.js';
import type { CreateBudgetInput, UpdateBudgetInput } from '../schemas/budget.schema.js';

const categorySelect = { select: { id: true, name: true, icon: true, color: true } };

export async function getBudgets(userId: string, month: number, year: number) {
  const budgets = await prisma.budget.findMany({
    where: { userId, month, year },
    include: { category: categorySelect },
    orderBy: { category: { name: 'asc' } },
  });

  if (budgets.length === 0) return [];

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const spentData = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'expense',
      date: { gte: startOfMonth, lte: endOfMonth },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(spentData.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]));

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
  const budget = await prisma.budget.findFirst({
    where: { id, userId },
    include: { category: categorySelect },
  });

  if (!budget) throw new Error('Presupuesto no encontrado');

  return budget;
}

export async function createBudget(data: CreateBudgetInput, userId: string) {
  const existing = await prisma.budget.findFirst({
    where: { userId, categoryId: data.categoryId, month: data.month, year: data.year },
  });

  if (existing) {
    throw new Error('Ya existe un presupuesto para esta categoría en este mes');
  }

  return prisma.budget.create({
    data: { ...data, userId },
    include: { category: categorySelect },
  });
}

export async function updateBudget(id: string, data: UpdateBudgetInput, userId: string) {
  await getBudgetById(id, userId);

  return prisma.budget.update({
    where: { id },
    data,
    include: { category: categorySelect },
  });
}

export async function deleteBudget(id: string, userId: string) {
  await getBudgetById(id, userId);
  return prisma.budget.delete({ where: { id } });
}
