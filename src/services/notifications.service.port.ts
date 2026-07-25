import type { Notification } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { NotificationPreferences } from '../schemas/notification.schema.js';
import type { CategoryEmailData } from '../lib/email/types.js';

export interface MonthlySummaryData {
  totalExpenses: number;
  totalIncome: number;
  categoryBreakdown: CategoryEmailData[];
}

export interface NotificationsService {
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<Prisma.BatchPayload>;
  deleteNotification(id: string, userId: string): Promise<Notification>;
  createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<Notification>;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences>;
  buildMonthlySummary(
    userId: string,
    range: { start: Date; end: Date }
  ): Promise<MonthlySummaryData>;
  getUserContactInfo(userId: string): Promise<{ email: string; name: string } | null>;
  buildMonthlySummariesBatch(
    userIds: string[],
    range: { start: Date; end: Date }
  ): Promise<Map<string, MonthlySummaryData>>;
}
