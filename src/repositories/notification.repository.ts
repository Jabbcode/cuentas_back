import { prisma } from '../lib/prisma.js';
import type { Prisma, Notification } from '@prisma/client';

export async function findAllByUser(userId: string): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function findByIdAndUser(id: string, userId: string): Promise<Notification | null> {
  return prisma.notification.findFirst({ where: { id, userId } });
}

export async function findFirst(
  where: Prisma.NotificationWhereInput
): Promise<Notification | null> {
  return prisma.notification.findFirst({ where });
}

export async function create(data: Prisma.NotificationCreateInput): Promise<Notification> {
  return prisma.notification.create({ data });
}

export async function update(
  id: string,
  data: Prisma.NotificationUpdateInput
): Promise<Notification> {
  return prisma.notification.update({ where: { id }, data });
}

export async function updateMany(
  where: Prisma.NotificationWhereInput,
  data: Prisma.NotificationUpdateManyMutationInput
): Promise<Prisma.BatchPayload> {
  return prisma.notification.updateMany({ where, data });
}

export async function remove(id: string): Promise<Notification> {
  return prisma.notification.delete({ where: { id } });
}
