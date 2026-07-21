import type { NotificationPreferences } from '../schemas/notification.schema.js';
import { NotFoundError } from '../lib/errors.js';
import * as notificationRepo from '../repositories/notification.repository.js';
import * as userRepo from '../repositories/user.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';
import type { CategoryEmailData } from '../lib/email/types.js';

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

export interface MonthlySummaryData {
  totalExpenses: number;
  totalIncome: number;
  categoryBreakdown: CategoryEmailData[];
}

export async function buildMonthlySummary(
  userId: string,
  range: { start: Date; end: Date }
): Promise<MonthlySummaryData> {
  const base = { userId, date: { gte: range.start, lt: range.end } };

  const [expenseAgg, incomeAgg, categoryData] = await Promise.all([
    transactionRepo.aggregate({ ...base, type: 'expense' }),
    transactionRepo.aggregate({ ...base, type: 'income' }),
    transactionRepo.groupExpensesByCategory({ ...base, type: 'expense' }),
  ]);

  const categoryIds = categoryData.map((c) => c.categoryId);
  const categories = await categoryRepo.findMany(
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

export async function getUserContactInfo(
  userId: string
): Promise<{ email: string; name: string } | null> {
  const user = await userRepo.findById(userId, { email: true, name: true });
  if (!user) return null;
  return { email: user.email, name: user.name };
}

const CATEGORY_LIMIT = 10;

export async function buildMonthlySummariesBatch(
  userIds: string[],
  range: { start: Date; end: Date }
): Promise<Map<string, MonthlySummaryData>> {
  const result = new Map<string, MonthlySummaryData>(
    userIds.map((id) => [id, { totalExpenses: 0, totalIncome: 0, categoryBreakdown: [] }])
  );
  if (userIds.length === 0) return result;

  const base = { userId: { in: userIds }, date: { gte: range.start, lt: range.end } };

  const [totals, categoryData] = await Promise.all([
    transactionRepo.groupTotalsByUser(base),
    transactionRepo.groupExpensesByUserAndCategory({ ...base, type: 'expense' }),
  ]);

  for (const row of totals) {
    const entry = result.get(row.userId);
    if (!entry) continue;
    const amount = Number(row._sum.amount ?? 0);
    if (row.type === 'expense') entry.totalExpenses = amount;
    else if (row.type === 'income') entry.totalIncome = amount;
  }

  const categoryIds = [...new Set(categoryData.map((c) => c.categoryId))];
  const categories = await categoryRepo.findMany(
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
