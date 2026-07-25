import type { Notification, Prisma } from '@prisma/client';
import type { NotificationPreferences } from '../schemas/notification.schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { NotificationRepository } from '../repositories/notification.repository.port.js';
import type { UserRepository } from '../repositories/user.repository.port.js';
import type { CategoryRepository } from '../repositories/category.repository.port.js';
import { NOTIFICATION_MESSAGES } from '../lib/constants/notification.constants.js';
import { AUTH_MESSAGES } from '../lib/constants/auth.constants.js';
import { TRANSACTION_TYPE } from '../lib/constants/shared.constants.js';
import type { NotificationsService, MonthlySummaryData } from './notifications.service.port.js';
import type { TransactionsService } from './transactions.service.port.js';

const CATEGORY_LIMIT = 10;

export class NotificationsServiceImpl implements NotificationsService {
  constructor(
    private notificationRepo: NotificationRepository,
    private userRepo: UserRepository,
    private categoryRepo: CategoryRepository,
    private transactionsService: TransactionsService
  ) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepo.findAllByUser(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findByIdAndUser(id, userId);
    if (!notification) throw new NotFoundError(NOTIFICATION_MESSAGES.NOT_FOUND);

    return this.notificationRepo.update(id, { read: true });
  }

  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.notificationRepo.updateMany({ userId, read: false }, { read: true });
  }

  async deleteNotification(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findByIdAndUser(id, userId);
    if (!notification) throw new NotFoundError(NOTIFICATION_MESSAGES.NOT_FOUND);

    return this.notificationRepo.remove(id);
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<Notification> {
    return this.notificationRepo.create({
      user: { connect: { id: userId } },
      type,
      title,
      message,
      ...(metadata !== undefined
        ? { metadata: metadata as Prisma.NotificationCreateInput['metadata'] }
        : {}),
    });
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.userRepo.findById(userId, { notificationPreferences: true });
    if (!user) throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);

    return user.notificationPreferences as NotificationPreferences;
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...prefs };

    await this.userRepo.update(userId, { notificationPreferences: updated });

    return updated;
  }

  async buildMonthlySummary(
    userId: string,
    range: { start: Date; end: Date }
  ): Promise<MonthlySummaryData> {
    const dateRange = { gte: range.start, lt: range.end };

    const [expenseAgg, incomeAgg, categoryData] = await Promise.all([
      this.transactionsService.getMonthlyTotalByType(userId, TRANSACTION_TYPE.EXPENSE, dateRange),
      this.transactionsService.getMonthlyTotalByType(userId, TRANSACTION_TYPE.INCOME, dateRange),
      this.transactionsService.getTopExpenseCategories(userId, dateRange),
    ]);

    const categoryIds = categoryData.map((c) => c.categoryId);
    const categories = await this.categoryRepo.findMany(
      { id: { in: categoryIds }, userId },
      { id: true, name: true, icon: true }
    );
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return {
      totalExpenses: Number(expenseAgg._sum.amount ?? 0),
      totalIncome: Number(incomeAgg._sum.amount ?? 0),
      categoryBreakdown: categoryData.map((c) => ({
        name: catMap.get(c.categoryId)?.name ?? 'Sin categoría',
        icon: catMap.get(c.categoryId)?.icon ?? undefined,
        spent: Number(c._sum.amount ?? 0),
      })),
    };
  }

  async getUserContactInfo(userId: string): Promise<{ email: string; name: string } | null> {
    const user = await this.userRepo.findById(userId, { email: true, name: true });
    if (!user) return null;
    return { email: user.email, name: user.name };
  }

  async buildMonthlySummariesBatch(
    userIds: string[],
    range: { start: Date; end: Date }
  ): Promise<Map<string, MonthlySummaryData>> {
    const result = new Map<string, MonthlySummaryData>(
      userIds.map((id) => [id, { totalExpenses: 0, totalIncome: 0, categoryBreakdown: [] }])
    );
    if (userIds.length === 0) return result;

    const dateRange = { gte: range.start, lt: range.end };

    const [totals, categoryData] = await Promise.all([
      this.transactionsService.getUserTotalsByType(userIds, dateRange),
      this.transactionsService.getExpensesByUserAndCategory(userIds, dateRange),
    ]);

    for (const row of totals) {
      const entry = result.get(row.userId);
      if (!entry) continue;
      const amount = Number(row._sum.amount ?? 0);
      if (row.type === TRANSACTION_TYPE.EXPENSE) entry.totalExpenses = amount;
      else if (row.type === TRANSACTION_TYPE.INCOME) entry.totalIncome = amount;
    }

    const categoryIds = [...new Set(categoryData.map((c) => c.categoryId))];
    const categories = await this.categoryRepo.findMany(
      { id: { in: categoryIds }, userId: { in: userIds } },
      { id: true, name: true, icon: true }
    );
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const perUser = new Map<string, typeof categoryData>();
    for (const row of categoryData) {
      const list = perUser.get(row.userId) ?? [];
      list.push(row);
      perUser.set(row.userId, list);
    }
    for (const [userId, rows] of perUser) {
      const entry = result.get(userId);
      if (!entry) continue;
      entry.categoryBreakdown = rows.slice(0, CATEGORY_LIMIT).map((c) => ({
        name: catMap.get(c.categoryId)?.name ?? 'Sin categoría',
        icon: catMap.get(c.categoryId)?.icon ?? undefined,
        spent: Number(c._sum.amount ?? 0),
      }));
    }

    return result;
  }
}
