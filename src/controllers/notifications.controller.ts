import { Response, NextFunction } from 'express';
import * as notificationsService from '../services/notifications.service.js';
import { notificationPreferencesSchema } from '../schemas/notification.schema.js';
import { AuthRequest } from '../types/index.js';
import { prisma } from '../lib/prisma.js';
import { sendMonthlySummaryEmail } from '../lib/email/index.js';

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationsService.getNotifications(req.user!.userId);
    const unreadCount = await notificationsService.getUnreadCount(req.user!.userId);
    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const notification = await notificationsService.markAsRead(id, req.user!.userId);
    res.json(notification);
  } catch (error) {
    if (error instanceof Error && error.message === 'Notificación no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationsService.markAllAsRead(req.user!.userId);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await notificationsService.deleteNotification(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Notificación no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const prefs = await notificationsService.getPreferences(req.user!.userId);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const prefs = notificationPreferencesSchema.partial().parse(req.body);
    const updated = await notificationsService.updatePreferences(req.user!.userId, prefs);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// TEST ONLY — remove before production
export async function sendTestEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const [expenseAgg, incomeAgg, categoryData] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'income', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
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
        where: { userId, categoryId: { in: categoryIds }, month, year },
        select: { categoryId: true, amount: true },
      }),
    ]);
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, Number(b.amount)]));

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

    await sendMonthlySummaryEmail({
      to: user.email,
      userName: user.name,
      month: monthNames[month - 1],
      year,
      totalExpenses: Number(expenseAgg._sum.amount ?? 0),
      totalIncome: Number(incomeAgg._sum.amount ?? 0),
      categoryBreakdown: categoryData.map((c) => ({
        name: catMap.get(c.categoryId)?.name ?? 'Sin categoría',
        icon: catMap.get(c.categoryId)?.icon ?? undefined,
        spent: Number(c._sum.amount ?? 0),
        budget: budgetMap.get(c.categoryId),
      })),
    });

    res.json({ message: `Email enviado a ${user.email}` });
  } catch (error) {
    next(error);
  }
}
