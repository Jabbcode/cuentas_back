import { prisma } from '../lib/prisma.js';

interface ProjectionData {
  month: string;
  year: number;
  monthNumber: number;
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
  expensesByCategory: CategoryProjection[];
  incomesByCategory: CategoryProjection[];
  comparison: {
    previousMonth: string;
    expensesDiff: number;
    incomeDiff: number;
    netDiff: number;
    expensesPercentage: number;
    incomePercentage: number;
  };
}

interface CategoryProjection {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  items: {
    id: string;
    name: string;
    amount: number;
    dueDay: number;
  }[];
}

export async function getNextMonthProjection(userId: string): Promise<ProjectionData> {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const monthNumber = nextMonth.getMonth() + 1;

  // Obtener todos los gastos/ingresos fijos activos
  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { dueDay: 'asc' },
    ],
  });

  // Separar por tipo
  const expenses = fixedExpenses.filter((fe) => fe.type === 'expense');
  const incomes = fixedExpenses.filter((fe) => fe.type === 'income');

  // Calcular totales
  const totalExpenses = expenses.reduce((sum, fe) => sum + Number(fe.amount), 0);
  const totalIncome = incomes.reduce((sum, fe) => sum + Number(fe.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  // Agrupar por categoría
  const expensesByCategory = groupByCategory(expenses);
  const incomesByCategory = groupByCategory(incomes);

  // Comparación con mes actual
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthSummary = await getCurrentMonthSummary(userId, currentMonth);

  const expensesDiff = totalExpenses - currentMonthSummary.totalExpenses;
  const incomeDiff = totalIncome - currentMonthSummary.totalIncome;
  const netDiff = netBalance - currentMonthSummary.netBalance;

  const expensesPercentage = currentMonthSummary.totalExpenses > 0
    ? ((expensesDiff / currentMonthSummary.totalExpenses) * 100)
    : 0;

  const incomePercentage = currentMonthSummary.totalIncome > 0
    ? ((incomeDiff / currentMonthSummary.totalIncome) * 100)
    : 0;

  return {
    month: nextMonth.toISOString(),
    year,
    monthNumber,
    totalExpenses,
    totalIncome,
    netBalance,
    expensesByCategory,
    incomesByCategory,
    comparison: {
      previousMonth: currentMonth.toISOString(),
      expensesDiff,
      incomeDiff,
      netDiff,
      expensesPercentage: Math.round(expensesPercentage * 10) / 10,
      incomePercentage: Math.round(incomePercentage * 10) / 10,
    },
  };
}

function groupByCategory(items: any[]): CategoryProjection[] {
  const grouped = new Map<string, CategoryProjection>();

  items.forEach((item) => {
    const catId = item.category?.id || 'uncategorized';
    const catName = item.category?.name || 'Sin categoría';
    const catIcon = item.category?.icon || null;
    const catColor = item.category?.color || null;

    if (!grouped.has(catId)) {
      grouped.set(catId, {
        categoryId: catId,
        categoryName: catName,
        categoryIcon: catIcon,
        categoryColor: catColor,
        total: 0,
        items: [],
      });
    }

    const category = grouped.get(catId)!;
    category.total += Number(item.amount);
    category.items.push({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      dueDay: item.dueDay,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}

async function getCurrentMonthSummary(userId: string, currentMonth: Date) {
  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: {
      userId,
      isActive: true,
    },
  });

  const expenses = fixedExpenses.filter((fe) => fe.type === 'expense');
  const incomes = fixedExpenses.filter((fe) => fe.type === 'income');

  const totalExpenses = expenses.reduce((sum, fe) => sum + Number(fe.amount), 0);
  const totalIncome = incomes.reduce((sum, fe) => sum + Number(fe.amount), 0);

  return {
    totalExpenses,
    totalIncome,
    netBalance: totalIncome - totalExpenses,
  };
}
