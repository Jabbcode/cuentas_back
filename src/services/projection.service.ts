import { prisma } from '../lib/prisma.js';

// ─── Financial Projection (days-based) ────────────────────────────────────────

export interface ProjectedFixedExpense {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  dueDate: string;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export interface ProjectedDebtPayment {
  id: string;
  debtName: string;
  amount: number;
  dueDate: string;
  frequency: string;
}

export interface TimelinePoint {
  date: string;
  projectedBalance: number;
}

export interface FinancialProjection {
  period: { days: number; from: string; to: string };
  currentBalance: number;
  projectedBalance: number;
  outflows: {
    fixedExpenses: ProjectedFixedExpense[];
    fixedIncome: ProjectedFixedExpense[];
    debtPayments: ProjectedDebtPayment[];
    totalExpenses: number;
    totalIncome: number;
    totalDebt: number;
  };
  historical: { monthlyAverage: number; forPeriod: number };
  timeline: TimelinePoint[];
}

export async function getFinancialProjection(
  userId: string,
  days: number
): Promise<FinancialProjection> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);

  const threeMonthsAgo = new Date(from.getFullYear(), from.getMonth() - 3, 1);

  const [accountsResult, fixedExpenses, debtPayments, historicalData] = await Promise.all([
    prisma.account.aggregate({ where: { userId }, _sum: { balance: true } }),
    prisma.fixedExpense.findMany({
      where: { userId, isActive: true },
      include: { category: { select: { name: true, icon: true, color: true } } },
    }),
    prisma.recurringDebtPayment.findMany({
      where: {
        userId,
        isActive: true,
        nextDueDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
        debt: { status: { not: 'paid' } },
      },
      include: { debt: { select: { creditor: true, description: true } } },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'expense', date: { gte: threeMonthsAgo } },
      _sum: { amount: true },
    }),
  ]);

  const currentBalance = Number(accountsResult._sum.balance ?? 0);

  const projectedFixed = fixedExpenses.flatMap((fe) =>
    getDatesInPeriod(fe.dueDay, from, to).map((date) => ({
      id: fe.id,
      name: fe.name,
      amount: Number(fe.amount),
      type: fe.type as 'expense' | 'income',
      dueDate: date.toISOString(),
      categoryName: fe.category?.name ?? null,
      categoryIcon: fe.category?.icon ?? null,
      categoryColor: fe.category?.color ?? null,
    }))
  );

  const projectedFixedExpenses = projectedFixed
    .filter((fe) => fe.type === 'expense')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const projectedFixedIncome = projectedFixed
    .filter((fe) => fe.type === 'income')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const projectedDebtPayments: ProjectedDebtPayment[] = debtPayments
    .map((dp) => ({
      id: dp.id,
      debtName: dp.debt.creditor ?? dp.debt.description ?? 'Deuda',
      amount: Number(dp.amount),
      dueDate: dp.nextDueDate.toISOString(),
      frequency: dp.frequency,
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const monthlyAverage = Number(historicalData._sum.amount ?? 0) / 3;
  const forPeriod = (monthlyAverage / 30) * days;

  const totalExpenses = projectedFixedExpenses.reduce((s, fe) => s + fe.amount, 0);
  const totalIncome = projectedFixedIncome.reduce((s, fe) => s + fe.amount, 0);
  const totalDebt = projectedDebtPayments.reduce((s, dp) => s + dp.amount, 0);
  const projectedBalance = currentBalance + totalIncome - totalExpenses - totalDebt - forPeriod;

  const timeline = buildTimeline(
    currentBalance,
    projectedFixed,
    projectedDebtPayments,
    monthlyAverage,
    from,
    to
  );

  return {
    period: { days, from: from.toISOString(), to: to.toISOString() },
    currentBalance,
    projectedBalance,
    outflows: {
      fixedExpenses: projectedFixedExpenses,
      fixedIncome: projectedFixedIncome,
      debtPayments: projectedDebtPayments,
      totalExpenses,
      totalIncome,
      totalDebt,
    },
    historical: { monthlyAverage, forPeriod },
    timeline,
  };
}

function getDatesInPeriod(dueDay: number, from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(dueDay, daysInMonth);
    const date = new Date(year, month, day);

    if (date >= from && date <= to) dates.push(date);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return dates;
}

function buildTimeline(
  currentBalance: number,
  fixedItems: ProjectedFixedExpense[],
  debtPayments: ProjectedDebtPayment[],
  monthlyAverage: number,
  from: Date,
  to: Date
): TimelinePoint[] {
  const dailyHistorical = monthlyAverage / 30;
  type Event = { date: Date; delta: number };

  const events: Event[] = [
    ...fixedItems.map((fe) => ({
      date: new Date(fe.dueDate),
      delta: fe.type === 'income' ? fe.amount : -fe.amount,
    })),
    ...debtPayments.map((dp) => ({ date: new Date(dp.dueDate), delta: -dp.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const points: TimelinePoint[] = [];
  let balance = currentBalance;
  let eventIndex = 0;
  let lastDate = new Date(from);

  points.push({ date: from.toISOString(), projectedBalance: roundTwo(balance) });

  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 7);
    const checkpoint = cursor > to ? new Date(to) : new Date(cursor);

    while (eventIndex < events.length && events[eventIndex].date <= checkpoint) {
      balance += events[eventIndex].delta;
      eventIndex++;
    }

    const daysDiff = Math.round((checkpoint.getTime() - lastDate.getTime()) / 86_400_000);
    balance -= dailyHistorical * daysDiff;
    lastDate = new Date(checkpoint);

    points.push({ date: checkpoint.toISOString(), projectedBalance: roundTwo(balance) });
    if (cursor >= to) break;
  }

  return points;
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── End Financial Projection ──────────────────────────────────────────────────

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
    orderBy: [{ sortOrder: 'asc' }, { dueDay: 'asc' }],
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
