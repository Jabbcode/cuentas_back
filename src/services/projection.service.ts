import { groupByCategory } from '../lib/utils/projection.utils.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';

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
  type FeWithCat = {
    id: string;
    name: string;
    amount: number | { toString(): string };
    dueDay: number;
    type: string;
    category: { id: string; name: string; icon: string | null; color: string | null } | null;
  };
  const fixedExpenses = (await fixedExpenseRepo.findAllByUser(
    userId,
    { isActive: true },
    { category: { select: { id: true, name: true, icon: true, color: true } } },
    [{ sortOrder: 'asc' }, { dueDay: 'asc' }]
  )) as unknown as FeWithCat[];

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

  const expensesPercentage =
    currentMonthSummary.totalExpenses > 0
      ? (expensesDiff / currentMonthSummary.totalExpenses) * 100
      : 0;

  const incomePercentage =
    currentMonthSummary.totalIncome > 0 ? (incomeDiff / currentMonthSummary.totalIncome) * 100 : 0;

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

async function getCurrentMonthSummary(userId: string, currentMonth: Date) {
  const fixedExpenses = await fixedExpenseRepo.findAllByUser(userId, { isActive: true });

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
