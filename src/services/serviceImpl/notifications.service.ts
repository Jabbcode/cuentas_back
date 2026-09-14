import type { Notification, Prisma } from '@prisma/client';
import type { NotificationPreferences } from '../../schemas/notification.schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import type { NotificationRepository } from '../../repositories/interfaces/notification.repository.port.js';
import { NOTIFICATION_MESSAGES } from '../../lib/constants/notification.constants.js';
import { AUTH_MESSAGES } from '../../lib/constants/auth.constants.js';
import { TRANSACTION_TYPE } from '../../lib/constants/shared.constants.js';
import type {
  NotificationsService,
  MonthlySummaryData,
} from '../interfaces/notifications.service.port.js';
import type { TransactionsService } from '../interfaces/transactions.service.port.js';
import type { UsersService } from '../interfaces/users.service.port.js';
import type { CategoriesService } from '../interfaces/categories.service.port.js';

const CATEGORY_LIMIT = 10;

const logger = createLogger('NOTIFICATIONS');

export class NotificationsServiceImpl implements NotificationsService {
  constructor(
    private notificationRepo: NotificationRepository,
    private usersService: UsersService,
    private categoriesService: CategoriesService,
    private transactionsService: TransactionsService
  ) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      return await this.notificationRepo.findAllByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudieron obtener las notificaciones del usuario {}', userId);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepo.countUnread(userId);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo contar las notificaciones no leidas del usuario {}',
        userId
      );
    }
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepo.findByIdAndUser(id, userId);
      if (!notification) throw new NotFoundError(NOTIFICATION_MESSAGES.NOT_FOUND);

      return await this.notificationRepo.update(id, { read: true });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo marcar como leida la notificacion {} del usuario {}',
        id,
        userId
      );
    }
  }

  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    try {
      return await this.notificationRepo.updateMany({ userId, read: false }, { read: true });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron marcar todas las notificaciones como leidas del usuario {}',
        userId
      );
    }
  }

  async deleteNotification(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepo.findByIdAndUser(id, userId);
      if (!notification) throw new NotFoundError(NOTIFICATION_MESSAGES.NOT_FOUND);

      return await this.notificationRepo.remove(id);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo eliminar la notificacion {} del usuario {}',
        id,
        userId
      );
    }
  }

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<Notification> {
    try {
      return await this.notificationRepo.create({
        user: { connect: { id: userId } },
        type,
        title,
        message,
        ...(metadata !== undefined
          ? { metadata: metadata as Prisma.NotificationCreateInput['metadata'] }
          : {}),
      });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo crear la notificacion de tipo {} para el usuario {}',
        type,
        userId
      );
    }
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);

      return user.notificationPreferences as NotificationPreferences;
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las preferencias de notificaciones del usuario {}',
        userId
      );
    }
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...prefs };

    try {
      await this.usersService.updateNotificationPreferences(userId, updated);

      return updated;
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron actualizar las preferencias de notificaciones del usuario {}',
        userId
      );
    }
  }

  async buildMonthlySummary(
    userId: string,
    range: { start: Date; end: Date }
  ): Promise<MonthlySummaryData> {
    try {
      const dateRange = { gte: range.start, lt: range.end };

      const [expenseAgg, incomeAgg, categoryData] = await Promise.all([
        this.transactionsService.getMonthlyTotalByType(userId, TRANSACTION_TYPE.EXPENSE, dateRange),
        this.transactionsService.getMonthlyTotalByType(userId, TRANSACTION_TYPE.INCOME, dateRange),
        this.transactionsService.getTopExpenseCategories(userId, dateRange),
      ]);

      const categoryIds = categoryData.map((c) => c.categoryId);
      const categories = await this.categoriesService.hydrateUserCategoriesByIds(categoryIds, [
        userId,
      ]);
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
    } catch (error) {
      return logger.fail(error, 'No se pudo construir el resumen mensual del usuario {}', userId);
    }
  }

  async getUserContactInfo(userId: string): Promise<{ email: string; name: string } | null> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) return null;
      return { email: user.email, name: user.name };
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener la informacion de contacto del usuario {}',
        userId
      );
    }
  }

  async buildMonthlySummariesBatch(
    userIds: string[],
    range: { start: Date; end: Date }
  ): Promise<Map<string, MonthlySummaryData>> {
    try {
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
      const categories = await this.categoriesService.hydrateUserCategoriesByIds(
        categoryIds,
        userIds
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
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo construir el resumen mensual para {} usuarios',
        userIds.length
      );
    }
  }
}
