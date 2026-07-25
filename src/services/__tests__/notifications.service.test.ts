import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification, User } from '@prisma/client';
import type { NotificationRepository } from '../../repositories/notification.repository.port.js';
import type { UserRepository } from '../../repositories/user.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import { NotificationsServiceImpl } from '../notifications.service.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  aggregate: vi.fn(),
  groupExpensesByCategory: vi.fn(),
  groupTotalsByUser: vi.fn(),
  groupExpensesByUserAndCategory: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';

const mockedAggregate = transactionRepo.aggregate as unknown as ReturnType<typeof vi.fn>;
const mockedGroupExpensesByCategory =
  transactionRepo.groupExpensesByCategory as unknown as ReturnType<typeof vi.fn>;
const mockedGroupTotalsByUser = transactionRepo.groupTotalsByUser as unknown as ReturnType<
  typeof vi.fn
>;
const mockedGroupExpensesByUserAndCategory =
  transactionRepo.groupExpensesByUserAndCategory as unknown as ReturnType<typeof vi.fn>;

function fakeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'debt_due',
    title: 'Título',
    message: 'Mensaje',
    read: false,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Notification;
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Usuario Test',
    notificationPreferences: { categoryLimit: true, debtDue: true, monthlyEmail: true },
    ...overrides,
  } as unknown as User;
}

function fakeNotificationRepo(
  overrides: Partial<NotificationRepository> = {}
): NotificationRepository {
  return {
    findAllByUser: async () => [],
    countUnread: async () => 0,
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    create: async () => fakeNotification(),
    update: async () => fakeNotification(),
    updateMany: async () => ({ count: 0 }),
    remove: async () => fakeNotification(),
    ...overrides,
  };
}

function fakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: async () => null,
    findById: async () => fakeUser(),
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => fakeUser(),
    update: async () => fakeUser(),
    remove: async () => fakeUser(),
    ...overrides,
  };
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not used in these tests');
    },
    update: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => {
      throw new Error('not used in these tests');
    },
    upsertSystemCategory: async () => {
      throw new Error('not used in these tests');
    },
    ...overrides,
  };
}

function buildService(
  overrides: {
    notificationRepo?: Partial<NotificationRepository>;
    userRepo?: Partial<UserRepository>;
    categoryRepo?: Partial<CategoryRepository>;
  } = {}
) {
  return new NotificationsServiceImpl(
    fakeNotificationRepo(overrides.notificationRepo),
    fakeUserRepo(overrides.userRepo),
    fakeCategoryRepo(overrides.categoryRepo)
  );
}

describe('NotificationsServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('markAsRead', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = buildService({ notificationRepo: { findByIdAndUser: async () => null } });

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(
        'Notificación no encontrada'
      );
    });

    it('marca como leída si existe', async () => {
      const updated = fakeNotification({ read: true });
      const service = buildService({
        notificationRepo: {
          findByIdAndUser: async () => fakeNotification(),
          update: async () => updated,
        },
      });

      await expect(service.markAsRead('notif-1', 'user-1')).resolves.toEqual(updated);
    });
  });

  describe('deleteNotification', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = buildService({ notificationRepo: { findByIdAndUser: async () => null } });

      await expect(service.deleteNotification('notif-1', 'user-1')).rejects.toThrow(
        'Notificación no encontrada'
      );
    });

    it('elimina si existe', async () => {
      const removed = fakeNotification();
      const service = buildService({
        notificationRepo: {
          findByIdAndUser: async () => fakeNotification(),
          remove: async () => removed,
        },
      });

      await expect(service.deleteNotification('notif-1', 'user-1')).resolves.toEqual(removed);
    });
  });

  describe('getPreferences', () => {
    it('lanza NotFoundError si el usuario no existe', async () => {
      const service = buildService({ userRepo: { findById: async () => null } });

      await expect(service.getPreferences('user-1')).rejects.toThrow('Usuario no encontrado');
    });

    it('devuelve las preferencias del usuario', async () => {
      const prefs = { categoryLimit: false, debtDue: true, monthlyEmail: false };
      const service = buildService({
        userRepo: { findById: async () => fakeUser({ notificationPreferences: prefs }) },
      });

      await expect(service.getPreferences('user-1')).resolves.toEqual(prefs);
    });
  });

  describe('updatePreferences', () => {
    it('mezcla las preferencias actuales con las nuevas y persiste', async () => {
      const current = { categoryLimit: true, debtDue: true, monthlyEmail: true };
      const updateCalls: unknown[] = [];
      const service = buildService({
        userRepo: {
          findById: async () => fakeUser({ notificationPreferences: current }),
          update: async (id, data) => {
            updateCalls.push({ id, data });
            return fakeUser();
          },
        },
      });

      const result = await service.updatePreferences('user-1', { monthlyEmail: false });

      expect(result).toEqual({ categoryLimit: true, debtDue: true, monthlyEmail: false });
      expect(updateCalls).toEqual([
        {
          id: 'user-1',
          data: {
            notificationPreferences: { categoryLimit: true, debtDue: true, monthlyEmail: false },
          },
        },
      ]);
    });
  });

  describe('buildMonthlySummary', () => {
    const range = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

    it('con transacciones: totales y desglose por categoría se calculan correctamente', async () => {
      mockedAggregate
        .mockResolvedValueOnce({ _sum: { amount: 150 } }) // expense
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }); // income
      mockedGroupExpensesByCategory.mockResolvedValueOnce([
        { categoryId: 'cat-1', _sum: { amount: 100 } },
        { categoryId: 'cat-2', _sum: { amount: 50 } },
      ]);
      const service = buildService({
        categoryRepo: {
          findMany: async () =>
            [
              { id: 'cat-1', name: 'Comida', icon: '🍔' },
              { id: 'cat-2', name: 'Transporte', icon: '🚗' },
            ] as never,
        },
      });

      const result = await service.buildMonthlySummary('user-1', range);

      expect(result.totalExpenses).toBe(150);
      expect(result.totalIncome).toBe(1000);
      expect(result.categoryBreakdown).toEqual([
        { name: 'Comida', icon: '🍔', spent: 100 },
        { name: 'Transporte', icon: '🚗', spent: 50 },
      ]);
    });

    it('categoría sin match en el mapa: usa "Sin categoría" e icon undefined', async () => {
      mockedAggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      mockedGroupExpensesByCategory.mockResolvedValueOnce([
        { categoryId: 'cat-borrada', _sum: { amount: 100 } },
      ]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      const result = await service.buildMonthlySummary('user-1', range);

      expect(result.categoryBreakdown).toEqual([
        { name: 'Sin categoría', icon: undefined, spent: 100 },
      ]);
    });

    it('sin transacciones: totales en 0 y breakdown vacío', async () => {
      mockedAggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      mockedGroupExpensesByCategory.mockResolvedValueOnce([]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      const result = await service.buildMonthlySummary('user-1', range);

      expect(result.totalExpenses).toBe(0);
      expect(result.totalIncome).toBe(0);
      expect(result.categoryBreakdown).toEqual([]);
    });

    it('envía el where esperado ({ userId, type, date }) a aggregate y groupExpensesByCategory', async () => {
      mockedAggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mockedGroupExpensesByCategory.mockResolvedValueOnce([]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      await service.buildMonthlySummary('user-1', range);

      const expectedDate = { gte: range.start, lt: range.end };
      expect(mockedAggregate).toHaveBeenNthCalledWith(1, {
        userId: 'user-1',
        type: 'expense',
        date: expectedDate,
      });
      expect(mockedAggregate).toHaveBeenNthCalledWith(2, {
        userId: 'user-1',
        type: 'income',
        date: expectedDate,
      });
      expect(mockedGroupExpensesByCategory).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'expense',
        date: expectedDate,
      });
    });
  });

  describe('buildMonthlySummariesBatch', () => {
    const range = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

    it('batch básico: totales y desglose por categoría correctos para 2 usuarios', async () => {
      mockedGroupTotalsByUser.mockResolvedValueOnce([
        { userId: 'user-1', type: 'expense', _sum: { amount: 150 } },
        { userId: 'user-1', type: 'income', _sum: { amount: 1000 } },
        { userId: 'user-2', type: 'expense', _sum: { amount: 80 } },
        { userId: 'user-2', type: 'income', _sum: { amount: 500 } },
      ]);
      mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
        { userId: 'user-1', categoryId: 'cat-1', _sum: { amount: 100 } },
        { userId: 'user-1', categoryId: 'cat-2', _sum: { amount: 50 } },
        { userId: 'user-2', categoryId: 'cat-1', _sum: { amount: 80 } },
      ]);
      const service = buildService({
        categoryRepo: {
          findMany: async () =>
            [
              { id: 'cat-1', name: 'Comida', icon: '🍔' },
              { id: 'cat-2', name: 'Transporte', icon: '🚗' },
            ] as never,
        },
      });

      const result = await service.buildMonthlySummariesBatch(['user-1', 'user-2'], range);

      expect(result.get('user-1')).toEqual({
        totalExpenses: 150,
        totalIncome: 1000,
        categoryBreakdown: [
          { name: 'Comida', icon: '🍔', spent: 100 },
          { name: 'Transporte', icon: '🚗', spent: 50 },
        ],
      });
      expect(result.get('user-2')).toEqual({
        totalExpenses: 80,
        totalIncome: 500,
        categoryBreakdown: [{ name: 'Comida', icon: '🍔', spent: 80 }],
      });
    });

    it('usuario sin transacciones: entrada pre-seeded con totales 0 y breakdown vacío', async () => {
      mockedGroupTotalsByUser.mockResolvedValueOnce([
        { userId: 'user-1', type: 'expense', _sum: { amount: 50 } },
      ]);
      mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      const result = await service.buildMonthlySummariesBatch(['user-1', 'user-sin-tx'], range);

      expect(result.get('user-sin-tx')).toEqual({
        totalExpenses: 0,
        totalIncome: 0,
        categoryBreakdown: [],
      });
    });

    it('categoría sin match en el mapa: usa "Sin categoría" e icon undefined', async () => {
      mockedGroupTotalsByUser.mockResolvedValueOnce([]);
      mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
        { userId: 'user-1', categoryId: 'cat-borrada', _sum: { amount: 30 } },
      ]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      const result = await service.buildMonthlySummariesBatch(['user-1'], range);

      expect(result.get('user-1')?.categoryBreakdown).toEqual([
        { name: 'Sin categoría', icon: undefined, spent: 30 },
      ]);
    });

    it('top-10 por usuario: 12 categorías se recortan a 10, otro usuario con 3 conserva las 3', async () => {
      const manyCategories = Array.from({ length: 12 }, (_, i) => ({
        userId: 'user-1',
        categoryId: `cat-${i}`,
        _sum: { amount: 100 - i },
      }));
      const fewCategories = [0, 1, 2].map((i) => ({
        userId: 'user-2',
        categoryId: `cat-${i}`,
        _sum: { amount: 10 - i },
      }));

      mockedGroupTotalsByUser.mockResolvedValueOnce([]);
      mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([
        ...manyCategories,
        ...fewCategories,
      ]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      const result = await service.buildMonthlySummariesBatch(['user-1', 'user-2'], range);

      expect(result.get('user-1')?.categoryBreakdown).toHaveLength(10);
      expect(result.get('user-1')?.categoryBreakdown.map((c) => c.spent)).toEqual(
        manyCategories.slice(0, 10).map((c) => c._sum.amount)
      );
      expect(result.get('user-2')?.categoryBreakdown).toHaveLength(3);
    });

    it('userIds vacío: devuelve Map vacío y no llama a los repos', async () => {
      const service = buildService();

      const result = await service.buildMonthlySummariesBatch([], range);

      expect(result.size).toBe(0);
      expect(mockedGroupTotalsByUser).not.toHaveBeenCalled();
      expect(mockedGroupExpensesByUserAndCategory).not.toHaveBeenCalled();
    });

    it('envía el where esperado a groupTotalsByUser y groupExpensesByUserAndCategory', async () => {
      mockedGroupTotalsByUser.mockResolvedValueOnce([]);
      mockedGroupExpensesByUserAndCategory.mockResolvedValueOnce([]);
      const service = buildService({ categoryRepo: { findMany: async () => [] } });

      await service.buildMonthlySummariesBatch(['user-1', 'user-2'], range);

      const expectedDate = { gte: range.start, lt: range.end };
      expect(mockedGroupTotalsByUser).toHaveBeenCalledWith({
        userId: { in: ['user-1', 'user-2'] },
        date: expectedDate,
      });
      expect(mockedGroupExpensesByUserAndCategory).toHaveBeenCalledWith({
        userId: { in: ['user-1', 'user-2'] },
        date: expectedDate,
        type: 'expense',
      });
    });
  });
});
