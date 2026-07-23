import type { Prisma, Notification } from '@prisma/client';

export interface NotificationRepository {
  findAllByUser(userId: string): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  findByIdAndUser(id: string, userId: string): Promise<Notification | null>;
  findFirst(where: Prisma.NotificationWhereInput): Promise<Notification | null>;
  create(data: Prisma.NotificationCreateInput): Promise<Notification>;
  update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification>;
  updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateManyMutationInput
  ): Promise<Prisma.BatchPayload>;
  remove(id: string): Promise<Notification>;
}
