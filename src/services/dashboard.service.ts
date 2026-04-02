import { prisma } from '../lib/prisma.js';

export async function getSummary(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [accounts, monthlyTransactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { balance: true, type: true, creditLimit: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { amount: true, type: true },
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

  const monthlyIncome = monthlyTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  const byCategory = transactions.reduce<Record<string, { category: typeof transactions[0]['category']; total: number }>>((acc, t) => {
    const catId = t.category.id;
    if (!acc[catId]) {
      acc[catId] = { category: t.category, total: 0 };
    }
    acc[catId].total += Number(t.amount);
    return acc;
  }, {});

  const total = Object.values(byCategory).reduce((sum, c) => sum + c.total, 0);

  return Object.values(byCategory)
    .map((c) => ({
      ...c.category,
      total: c.total,
      percentage: total > 0 ? Math.round((c.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getMonthlyTrend(userId: string, months = 6) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate },
    },
    select: { amount: true, type: true, date: true },
  });

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

export async function getFixedVsVariable(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Obtener el total de gastos fijos configurados (activos, tipo expense)
  const fixedExpensesConfig = await prisma.fixedExpense.findMany({
    where: {
      userId,
      isActive: true,
      type: 'expense',
    },
    select: { amount: true },
  });

  const fixedExpensesTotal = fixedExpensesConfig.reduce(
    (sum, fe) => sum + Number(fe.amount),
    0
  );

  // Obtener transacciones variables (gastos sin fixedExpenseId)
  const variableTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'expense',
      fixedExpenseId: null,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    select: { amount: true },
  });

  const variableExpensesTotal = variableTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

  const total = fixedExpensesTotal + variableExpensesTotal;

  return {
    fixed: fixedExpensesTotal,
    variable: variableExpensesTotal,
    total,
    fixedPercentage: total > 0 ? Math.round((fixedExpensesTotal / total) * 100) : 0,
    variablePercentage: total > 0 ? Math.round((variableExpensesTotal / total) * 100) : 0,
  };
}
