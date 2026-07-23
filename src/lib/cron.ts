import cron from 'node-cron';
import { prisma } from './prisma.js';
import { notificationsService, fixedExpensesService } from '../bootstrap.js';
import { sendMonthlySummaryEmail } from './email/index.js';
import { getMonthRange } from './utils/date.utils.js';
import * as userRepo from '../repositories/user.repository.js';

function startCronJobs() {
  // Daily at 7 AM: auto-generate transactions for fixed expenses with autoGenerate=true
  cron.schedule('0 7 * * *', async () => {
    try {
      const { createdByUser, failedByUser } =
        await fixedExpensesService.autoGenerateFixedExpenseTransactions(new Date());

      for (const [userId, count] of Object.entries(createdByUser)) {
        await notificationsService.createNotification(
          userId,
          'auto_generated',
          'Transacciones generadas automáticamente',
          `Se generaron ${count} transacción${count > 1 ? 'es' : ''} automática${count > 1 ? 's' : ''} hoy.`,
          { created: count }
        );
      }

      for (const [userId, failures] of Object.entries(failedByUser)) {
        const names = failures.map((f) => f.fixedExpenseName).join(', ');
        await notificationsService.createNotification(
          userId,
          'auto_generate_failed',
          'No se pudieron generar algunos gastos fijos',
          `No se generaron automáticamente: ${names}. Revisa el detalle de cada gasto fijo.`,
          { failures }
        );
      }
    } catch (err) {
      // Cron errors must not crash the server
      console.error('[cron:auto-generate]', err instanceof Error ? err.message : err);
    }
  });

  // Daily at 9 AM: alert for debts due in next 3 days
  cron.schedule('0 9 * * *', async () => {
    try {
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

        try {
          await notificationsService.createNotification(
            debt.userId,
            'debt_due',
            `Deuda próxima a vencer: ${debt.creditor}`,
            `Tu deuda con ${debt.creditor} vence el ${dueDate}. Monto pendiente: €${Number(debt.remainingAmount).toFixed(2)}.`,
            { debtId: debt.id, dueDate: debt.dueDate }
          );
        } catch (err) {
          console.error(
            '[cron:debt-due]',
            `debt=${debt.id}`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } catch (err) {
      console.error('[cron:debt-due]', err instanceof Error ? err.message : err);
    }
  });

  // Monthly on the 1st at 8 AM: send email summary for previous month
  cron.schedule('0 8 1 * *', async () => {
    try {
      await sendMonthlySummaries();
    } catch (err) {
      console.error('[cron:monthly-email]', err instanceof Error ? err.message : err);
    }
  });
}

async function sendMonthlySummaries(): Promise<void> {
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const { start: startOfMonth, end: endOfMonth } = getMonthRange(prevYear, prevMonth);

  const users = await userRepo.findMany(
    {},
    { id: true, email: true, name: true, notificationPreferences: true }
  );

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

  const eligible = users.filter((user) => {
    const prefs = user.notificationPreferences as { monthlyEmail?: boolean } | null;
    return !!prefs?.monthlyEmail;
  });

  if (eligible.length === 0) return;

  const summaries = await notificationsService.buildMonthlySummariesBatch(
    eligible.map((u) => u.id),
    { start: startOfMonth, end: endOfMonth }
  );

  for (const user of eligible) {
    const summary = summaries.get(user.id)!;

    try {
      await sendMonthlySummaryEmail({
        to: user.email,
        userName: user.name,
        month: monthNames[prevMonth],
        year: prevYear,
        ...summary,
      });
    } catch (err) {
      // Email send failure must not crash the cron
      console.error('[cron:monthly-email]', err instanceof Error ? err.message : err);
    }
  }
}

export { startCronJobs };
