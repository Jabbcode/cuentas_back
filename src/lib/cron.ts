import cron from 'node-cron';
import { prisma } from './prisma.js';
import { createNotification, getPreferences } from '../services/notifications.service.js';
import { sendMonthlySummaryEmail } from './email/index.js';

function startCronJobs() {
  // Daily at 9 AM: alert for debts due in next 3 days
  cron.schedule('0 9 * * *', async () => {
    const now = new Date();
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const debts = await prisma.debt.findMany({
      where: {
        status: 'active',
        dueDate: { gte: now, lte: in3Days },
      },
      include: { user: { select: { id: true, notificationPreferences: true } } },
    });

    for (const debt of debts) {
      const prefs = debt.user.notificationPreferences as { debtDue?: boolean } | null;
      if (!prefs?.debtDue) continue;

      const dueDate = debt.dueDate!.toLocaleDateString('es-ES');
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const existing = await prisma.notification.findFirst({
        where: {
          userId: debt.userId,
          type: 'debt_due',
          metadata: { path: ['debtId'], equals: debt.id },
          createdAt: { gte: startOfDay },
        },
      });
      if (existing) continue;

      await createNotification(
        debt.userId,
        'debt_due',
        `Deuda próxima a vencer: ${debt.creditor}`,
        `Tu deuda con ${debt.creditor} vence el ${dueDate}. Monto pendiente: €${Number(debt.remainingAmount).toFixed(2)}.`,
        { debtId: debt.id, dueDate: debt.dueDate }
      );
    }
  });

  // Monthly on the 1st at 8 AM: send email summary for previous month
  cron.schedule('0 8 1 * *', async () => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const startOfMonth = new Date(prevYear, prevMonth, 1);
    const endOfMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, notificationPreferences: true },
    });

    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    for (const user of users) {
      const prefs = user.notificationPreferences as { monthlyEmail?: boolean } | null;
      if (!prefs?.monthlyEmail) continue;

      const [expenseAgg, incomeAgg, categoryData] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: 'income', date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ['categoryId'],
          where: { userId: user.id, type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 10,
        }),
      ]);

      const categoryIds = categoryData.map((c) => c.categoryId);
      const [categories, budgets] = await Promise.all([
        prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, icon: true },
        }),
        prisma.budget.findMany({
          where: {
            userId: user.id,
            categoryId: { in: categoryIds },
            month: prevMonth + 1,
            year: prevYear,
          },
          select: { categoryId: true, amount: true },
        }),
      ]);
      const catMap = new Map(categories.map((c) => [c.id, c]));
      const budgetMap = new Map(budgets.map((b) => [b.categoryId, Number(b.amount)]));

      const breakdown = categoryData.map((c) => ({
        name: catMap.get(c.categoryId)?.name ?? 'Sin categoría',
        icon: catMap.get(c.categoryId)?.icon ?? undefined,
        spent: Number(c._sum.amount ?? 0),
        budget: budgetMap.get(c.categoryId),
      }));

      try {
        await sendMonthlySummaryEmail({
          to: user.email,
          userName: user.name,
          month: monthNames[prevMonth],
          year: prevYear,
          totalExpenses: Number(expenseAgg._sum.amount ?? 0),
          totalIncome: Number(incomeAgg._sum.amount ?? 0),
          categoryBreakdown: breakdown,
        });
      } catch {
        // Email send failure should not crash the cron
      }
    }
  });
}

export { startCronJobs };
