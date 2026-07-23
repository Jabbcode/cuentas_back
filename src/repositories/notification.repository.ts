import type { Prisma, Notification, PrismaClient } from '@prisma/client';
import type { NotificationRepository } from './notification.repository.port.js';

export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async findAllByUser(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async findByIdAndUser(id: string, userId: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  async findFirst(where: Prisma.NotificationWhereInput): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where });
  }

  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data });
  }

  async updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({ where, data });
  }

  async remove(id: string): Promise<Notification> {
    return this.prisma.notification.delete({ where: { id } });
  }
}
