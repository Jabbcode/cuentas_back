import { prisma } from '../lib/prisma.js';
import type { NotificationPreferences } from '../schemas/notification.schema.js';
import { NotFoundError } from '../lib/errors.js';

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
  if (!notification) throw new NotFoundError('Notificación no encontrada');

  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

export async function deleteNotification(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new NotFoundError('Notificación no encontrada');

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
  if (!user) throw new NotFoundError('Usuario no encontrado');

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
