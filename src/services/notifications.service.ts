import type { NotificationPreferences } from '../schemas/notification.schema.js';
import { NotFoundError } from '../lib/errors.js';
import * as notificationRepo from '../repositories/notification.repository.js';
import * as userRepo from '../repositories/user.repository.js';

export async function getNotifications(userId: string) {
  return notificationRepo.findAllByUser(userId);
}

export async function getUnreadCount(userId: string) {
  return notificationRepo.countUnread(userId);
}

export async function markAsRead(id: string, userId: string) {
  const notification = await notificationRepo.findByIdAndUser(id, userId);
  if (!notification) throw new NotFoundError('Notificación no encontrada');

  return notificationRepo.update(id, { read: true });
}

export async function markAllAsRead(userId: string) {
  return notificationRepo.updateMany({ userId, read: false }, { read: true });
}

export async function deleteNotification(id: string, userId: string) {
  const notification = await notificationRepo.findByIdAndUser(id, userId);
  if (!notification) throw new NotFoundError('Notificación no encontrada');

  return notificationRepo.remove(id);
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return notificationRepo.create({
    user: { connect: { id: userId } },
    type,
    title,
    message,
    ...(metadata !== undefined
      ? { metadata: metadata as Parameters<typeof notificationRepo.create>[0]['metadata'] }
      : {}),
  });
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await userRepo.findById(userId, { notificationPreferences: true });
  if (!user) throw new NotFoundError('Usuario no encontrado');

  return user.notificationPreferences as NotificationPreferences;
}

export async function updatePreferences(userId: string, prefs: Partial<NotificationPreferences>) {
  const current = await getPreferences(userId);
  const updated = { ...current, ...prefs };

  await userRepo.update(userId, { notificationPreferences: updated });

  return updated;
}
