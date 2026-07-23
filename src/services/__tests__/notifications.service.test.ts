import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notification, User } from '@prisma/client';
import type { NotificationRepository } from '../../repositories/notification.repository.port.js';
import type { UserRepository } from '../../repositories/user.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import type { TransactionsService } from '../transactions.service.port.js';
import { NotificationsServiceImpl } from '../notifications.service.js';

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

function fakeTransactionsService(
  overrides: Partial<TransactionsService> = {}
): TransactionsService {
  return {
    getTransactions: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionById: async () => {
      throw new Error('not used in these tests');
    },
    createTransaction: async () => {
      throw new Error('not used in these tests');
    },
    updateTransaction: async () => {
      throw new Error('not used in these tests');
    },
    deleteTransaction: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionSummary: async () => [],
    getReceiptItems: async () => [],
    countByCategory: async () => 0,
    findMonthlyCategoryExpenses: async () => [],
    findCardStatementTransactions: async () => [],
    findFixedExpensePaymentInMonth: async () => null,
    resyncTransactionsForFixedExpense: async () => ({ count: 0 }),
    getMonthlyTotalByType: async () => ({ _sum: { amount: null } }),
    getVariableExpenseTotal: async () => ({ _sum: { amount: null } }),
    getCategoryBreakdown: async () => [],
    findTransactionsSince: async () => [],
    getTopExpenseCategories: async () => [],
    getUserTotalsByType: async () => [],
    getExpensesByUserAndCategory: async () => [],
    countByUser: async () => 0,
    getFirstTransactionDate: async () => null,
    findByImageHash: async () => null,
    findSimilarByAmountAndDate: async () => [],
    ...overrides,
  };
}

function buildService(
  overrides: {
    notificationRepo?: Partial<NotificationRepository>;
    userRepo?: Partial<UserRepository>;
    categoryRepo?: Partial<CategoryRepository>;
    transactionsService?: Partial<TransactionsService>;
  } = {}
) {
  return new NotificationsServiceImpl(
    fakeNotificationRepo(overrides.notificationRepo),
    fakeUserRepo(overrides.userRepo),
    fakeCategoryRepo(overrides.categoryRepo),
    fakeTransactionsService(overrides.transactionsService)
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

  describe('buildMonthlySummary (usa TransactionsService.getMonthlyTotalByType / getTopExpenseCategories)', () => {
    const range = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

    it('con transacciones: totales y desglose por categoría se calculan correctamente', async () => {
      const getMonthlyTotalByType = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: 150 } }) // expense
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }); // income
      const service = buildService({
        transactionsService: {
          getMonthlyTotalByType,
          getTopExpenseCategories: async () =>
            [
              { categoryId: 'cat-1', _sum: { amount: 100 } },
              { categoryId: 'cat-2', _sum: { amount: 50 } },
            ] as never,
        },
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
      const getMonthlyTotalByType = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      const service = buildService({
        transactionsService: {
          getMonthlyTotalByType,
          getTopExpenseCategories: async () =>
            [{ categoryId: 'cat-borrada', _sum: { amount: 100 } }] as never,
        },
        categoryRepo: { findMany: async () => [] },
      });

      const result = await service.buildMonthlySummary('user-1', range);

      expect(result.categoryBreakdown).toEqual([
        { name: 'Sin categoría', icon: undefined, spent: 100 },
      ]);
    });

    it('sin transacciones: totales en 0 y breakdown vacío', async () => {
      const getMonthlyTotalByType = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });
      const service = buildService({
        transactionsService: { getMonthlyTotalByType, getTopExpenseCategories: async () => [] },
        categoryRepo: { findMany: async () => [] },
      });

      const result = await service.buildMonthlySummary('user-1', range);

      expect(result.totalExpenses).toBe(0);
      expect(result.totalIncome).toBe(0);
      expect(result.categoryBreakdown).toEqual([]);
    });

    it('envía el where esperado ({ userId, type, date }) a getMonthlyTotalByType y getTopExpenseCategories', async () => {
      const getMonthlyTotalByType = vi.fn().mockResolvedValue({ _sum: { amount: 0 } });
      const getTopExpenseCategories = vi.fn().mockResolvedValue([]);
      const service = buildService({
        transactionsService: { getMonthlyTotalByType, getTopExpenseCategories },
        categoryRepo: { findMany: async () => [] },
      });

      await service.buildMonthlySummary('user-1', range);

      const expectedDate = { gte: range.start, lt: range.end };
      expect(getMonthlyTotalByType).toHaveBeenNthCalledWith(1, 'user-1', 'expense', expectedDate);
      expect(getMonthlyTotalByType).toHaveBeenNthCalledWith(2, 'user-1', 'income', expectedDate);
      expect(getTopExpenseCategories).toHaveBeenCalledWith('user-1', expectedDate);
    });
  });

  describe('buildMonthlySummariesBatch (usa TransactionsService.getUserTotalsByType / getExpensesByUserAndCategory)', () => {
    const range = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

    it('batch básico: totales y desglose por categoría correctos para 2 usuarios', async () => {
      const service = buildService({
        transactionsService: {
          getUserTotalsByType: async () =>
            [
              { userId: 'user-1', type: 'expense', _sum: { amount: 150 } },
              { userId: 'user-1', type: 'income', _sum: { amount: 1000 } },
              { userId: 'user-2', type: 'expense', _sum: { amount: 80 } },
              { userId: 'user-2', type: 'income', _sum: { amount: 500 } },
            ] as never,
          getExpensesByUserAndCategory: async () =>
            [
              { userId: 'user-1', categoryId: 'cat-1', _sum: { amount: 100 } },
              { userId: 'user-1', categoryId: 'cat-2', _sum: { amount: 50 } },
              { userId: 'user-2', categoryId: 'cat-1', _sum: { amount: 80 } },
            ] as never,
        },
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
      const service = buildService({
        transactionsService: {
          getUserTotalsByType: async () =>
            [{ userId: 'user-1', type: 'expense', _sum: { amount: 50 } }] as never,
          getExpensesByUserAndCategory: async () => [],
        },
        categoryRepo: { findMany: async () => [] },
      });

      const result = await service.buildMonthlySummariesBatch(['user-1', 'user-sin-tx'], range);

      expect(result.get('user-sin-tx')).toEqual({
        totalExpenses: 0,
        totalIncome: 0,
        categoryBreakdown: [],
      });
    });

    it('categoría sin match en el mapa: usa "Sin categoría" e icon undefined', async () => {
      const service = buildService({
        transactionsService: {
          getUserTotalsByType: async () => [],
          getExpensesByUserAndCategory: async () =>
            [{ userId: 'user-1', categoryId: 'cat-borrada', _sum: { amount: 30 } }] as never,
        },
        categoryRepo: { findMany: async () => [] },
      });

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

      const service = buildService({
        transactionsService: {
          getUserTotalsByType: async () => [],
          getExpensesByUserAndCategory: async () => [...manyCategories, ...fewCategories] as never,
        },
        categoryRepo: { findMany: async () => [] },
      });

      const result = await service.buildMonthlySummariesBatch(['user-1', 'user-2'], range);

      expect(result.get('user-1')?.categoryBreakdown).toHaveLength(10);
      expect(result.get('user-1')?.categoryBreakdown.map((c) => c.spent)).toEqual(
        manyCategories.slice(0, 10).map((c) => c._sum.amount)
      );
      expect(result.get('user-2')?.categoryBreakdown).toHaveLength(3);
    });

    it('userIds vacío: devuelve Map vacío y no llama a TransactionsService', async () => {
      const getUserTotalsByType = vi.fn();
      const getExpensesByUserAndCategory = vi.fn();
      const service = buildService({
        transactionsService: { getUserTotalsByType, getExpensesByUserAndCategory },
      });

      const result = await service.buildMonthlySummariesBatch([], range);

      expect(result.size).toBe(0);
      expect(getUserTotalsByType).not.toHaveBeenCalled();
      expect(getExpensesByUserAndCategory).not.toHaveBeenCalled();
    });

    it('envía el where esperado a getUserTotalsByType y getExpensesByUserAndCategory', async () => {
      const getUserTotalsByType = vi.fn().mockResolvedValue([]);
      const getExpensesByUserAndCategory = vi.fn().mockResolvedValue([]);
      const service = buildService({
        transactionsService: { getUserTotalsByType, getExpensesByUserAndCategory },
        categoryRepo: { findMany: async () => [] },
      });

      await service.buildMonthlySummariesBatch(['user-1', 'user-2'], range);

      const expectedDate = { gte: range.start, lt: range.end };
      expect(getUserTotalsByType).toHaveBeenCalledWith(['user-1', 'user-2'], expectedDate);
      expect(getExpensesByUserAndCategory).toHaveBeenCalledWith(['user-1', 'user-2'], expectedDate);
    });
  });
});
