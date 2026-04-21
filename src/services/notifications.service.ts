import { prisma } from '../lib/prisma.js';
import type { NotificationPreferences } from '../schemas/notification.schema.js';

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new Error('Notificación no encontrada');

  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

export async function deleteNotification(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new Error('Notificación no encontrada');

  return prisma.notification.delete({ where: { id } });
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      ...(metadata !== undefined
        ? {
            metadata: metadata as Parameters<
              typeof prisma.notification.create
            >[0]['data']['metadata'],
          }
        : {}),
    },
  });
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  if (!user) throw new Error('Usuario no encontrado');

  return user.notificationPreferences as NotificationPreferences;
}

export async function updatePreferences(userId: string, prefs: Partial<NotificationPreferences>) {
  const current = await getPreferences(userId);
  const updated = { ...current, ...prefs };

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: updated },
  });

  return updated;
}

export async function checkBudgetAndNotify(userId: string, categoryId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const prefs = user?.notificationPreferences as NotificationPreferences | null;
  if (!prefs?.categoryLimit) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budget = await prisma.budget.findFirst({
    where: { userId, categoryId, month, year },
    include: { category: { select: { name: true } } },
  });
  if (!budget) return;

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const result = await prisma.transaction.aggregate({
    where: { userId, categoryId, type: 'expense', date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { amount: true },
  });

  const spent = Number(result._sum.amount ?? 0);
  const limit = Number(budget.amount);
  const alertAt = budget.alertAt ? Number(budget.alertAt) : 80;
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;

  const isOver = spent > limit;
  const isNear = !isOver && percentage >= alertAt;

  if (!isOver && !isNear) return;

  // Avoid duplicate notifications of the same type this month
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'category_limit',
      metadata: { path: ['categoryId'], equals: categoryId },
      createdAt: { gte: startOfMonth },
    },
  });
  if (existing) return;

  const categoryName = budget.category.name;

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
