import type { Prisma } from '@prisma/client';
import * as accountRepo from '../repositories/account.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';
import { getMonthRange } from '../lib/utils/date.utils.js';

export async function getSummary(userId: string) {
  const now = new Date();
  const { start: startOfMonth, end: endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth());

  const [accounts, incomeAgg, expenseAgg] = await Promise.all([
    accountRepo.findAllByUser(userId),
    transactionRepo.aggregate({
      userId,
      type: 'income',
      date: { gte: startOfMonth, lt: endOfMonth },
    }),
    transactionRepo.aggregate({
      userId,
      type: 'expense',
      date: { gte: startOfMonth, lt: endOfMonth },
    }),
  ]);

  const totalBalance = accounts.reduce((sum, acc) => {
    // For credit cards, add available credit (limit - used)
    if (acc.type === 'credit_card' && acc.creditLimit) {
      const used = Math.abs(Number(acc.balance));
      const available = Number(acc.creditLimit) - used;
      return sum + available;
    }
    // For other accounts, add balance normally
    return sum + Number(acc.balance);
  }, 0);

  const monthlyIncome = Number(incomeAgg._sum.amount ?? 0);
  const monthlyExpenses = Number(expenseAgg._sum.amount ?? 0);

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: monthlyIncome - monthlyExpenses,
    month: now.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
  };
}

export async function getByCategory(userId: string, type: 'expense' | 'income' = 'expense') {
  const now = new Date();
  const { start: startOfMonth, end: endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth());

  const rows = await transactionRepo.groupByCategory({
    userId,
    type,
    date: { gte: startOfMonth, lt: endOfMonth },
  });

  const totalByCategory = new Map<string, number>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    const current = totalByCategory.get(row.categoryId) ?? 0;
    totalByCategory.set(row.categoryId, current + Number(row._sum.amount ?? 0));
  }

  const total = Array.from(totalByCategory.values()).reduce((sum, t) => sum + t, 0);
  const categoryIds = Array.from(totalByCategory.keys());

  if (categoryIds.length === 0) return [];

  type CategoryMeta = {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    monthlyLimit: Prisma.Decimal | null;
  };
  const categories = (await categoryRepo.findMany(
    { id: { in: categoryIds } },
    {
      id: true,
      name: true,
      icon: true,
      color: true,
      monthlyLimit: true,
    }
  )) as unknown as CategoryMeta[];

  return categories
    .map((c) => {
      const catTotal = totalByCategory.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        monthlyLimit: c.monthlyLimit ? Number(c.monthlyLimit) : undefined,
        total: catTotal,
        percentage: total > 0 ? Math.round((catTotal / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function getMonthlyTrend(userId: string, months = 6) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const transactions = await transactionRepo.findMany({ userId, date: { gte: startDate } });

  const monthlyData: Record<string, { income: number; expenses: number }> = {};

  // Initialize all months
  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
    const key = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
    monthlyData[key] = { income: 0, expenses: 0 };
  }

  // Aggregate transactions
  transactions.forEach((t) => {
    const date = new Date(t.date);
    const key = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
    if (monthlyData[key]) {
      if (t.type === 'income') {
        monthlyData[key].income += Number(t.amount);
      } else {
        monthlyData[key].expenses += Number(t.amount);
      }
    }
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    income: data.income,
    expenses: data.expenses,
    net: data.income - data.expenses,
  }));
}

export async function getMonthlySummary(userId: string, month: number, year: number) {
  const { start: startOfMonth, end: endOfMonth } = getMonthRange(year, month - 1);

  const rows = await transactionRepo.groupByCategory({
    userId,
    date: { gte: startOfMonth, lt: endOfMonth },
  });

  let totalExpenses = 0;
  let totalIncome = 0;
  const expenseTotalByCategory = new Map<string, number>();

  for (const row of rows) {
    const amount = Number(row._sum.amount ?? 0);
    if (row.type === 'income') {
      totalIncome += amount;
    } else if (row.type === 'expense') {
      totalExpenses += amount;
      if (row.categoryId) {
        const current = expenseTotalByCategory.get(row.categoryId) ?? 0;
        expenseTotalByCategory.set(row.categoryId, current + amount);
      }
    }
  }

  const categoryIds = Array.from(expenseTotalByCategory.keys());
  type CategoryMeta = { id: string; name: string; icon: string | null; color: string | null };
  const categoryMetas =
    categoryIds.length > 0
      ? ((await categoryRepo.findMany(
          { id: { in: categoryIds } },
          { id: true, name: true, icon: true, color: true }
        )) as unknown as CategoryMeta[])
      : [];

  const categories = categoryMetas
    .map((c) => {
      const total = expenseTotalByCategory.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        total,
        percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { month, year, totalExpenses, totalIncome, net: totalIncome - totalExpenses, categories };
}

export async function getFixedVsVariable(userId: string) {
  const now = new Date();
  const { start: startOfMonth, end: endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth());

  // Obtener el total de gastos fijos configurados (activos, tipo expense)
  const fixedExpensesConfig = await fixedExpenseRepo.findAllByUser(userId, {
    isActive: true,
    type: 'expense',
  });

  const fixedExpensesTotal = fixedExpensesConfig.reduce((sum, fe) => sum + Number(fe.amount), 0);

  // Obtener transacciones variables (gastos sin fixedExpenseId)
  const variableAgg = await transactionRepo.aggregate({
    userId,
    type: 'expense',
    fixedExpenseId: null,
    date: { gte: startOfMonth, lt: endOfMonth },
  });

  const variableExpensesTotal = Number(variableAgg._sum.amount ?? 0);

  const total = fixedExpensesTotal + variableExpensesTotal;

  return {
    fixed: fixedExpensesTotal,
    variable: variableExpensesTotal,
    total,
    fixedPercentage: total > 0 ? Math.round((fixedExpensesTotal / total) * 100) : 0,
    variablePercentage: total > 0 ? Math.round((variableExpensesTotal / total) * 100) : 0,
  };
}
