import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Category } from '@prisma/client';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import { CategoriesServiceImpl } from '../categories.service.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

import * as transactionRepo from '../../repositories/transaction.repository.js';

const mockedCount = transactionRepo.count as unknown as ReturnType<typeof vi.fn>;
const mockedFindMany = transactionRepo.findMany as unknown as ReturnType<typeof vi.fn>;

function fakeCategory(
  overrides: Partial<Omit<Category, 'systemKey'>> = {}
): Omit<Category, 'systemKey'> {
  return {
    id: 'cat-1',
    name: 'Comida',
    type: 'expense',
    icon: '🍔',
    color: '#EF4444',
    monthlyLimit: null,
    userId: 'user-1',
    ...overrides,
  } as unknown as Omit<Category, 'systemKey'>;
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => fakeCategory(),
    update: async () => fakeCategory(),
    remove: async () => fakeCategory(),
    upsertSystemCategory: async () => fakeCategory() as unknown as Category,
    ...overrides,
  };
}

describe('CategoriesServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategoryById', () => {
    it('lanza NotFoundError si el repo devuelve null', async () => {
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => null })
      );

      await expect(service.getCategoryById('cat-1', 'user-1')).rejects.toThrow(
        'Categoría no encontrada'
      );
    });

    it('devuelve la categoría si existe', async () => {
      const category = fakeCategory();
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => category })
      );

      await expect(service.getCategoryById('cat-1', 'user-1')).resolves.toEqual(category);
    });
  });

  describe('createCategory / updateCategory', () => {
    it('createCategory devuelve la categoría creada', async () => {
      const created = fakeCategory({ name: 'Transporte' });
      const service = new CategoriesServiceImpl(fakeCategoryRepo({ create: async () => created }));

      await expect(
        service.createCategory({ name: 'Transporte', type: 'expense' }, 'user-1')
      ).resolves.toEqual(created);
    });

    it('updateCategory devuelve la categoría actualizada', async () => {
      const existing = fakeCategory();
      const updated = fakeCategory({ name: 'Actualizada' });
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => existing, update: async () => updated })
      );

      await expect(
        service.updateCategory('cat-1', { name: 'Actualizada' }, 'user-1')
      ).resolves.toEqual(updated);
    });
  });

  describe('deleteCategory', () => {
    it('lanza ConflictError si tiene transacciones asociadas', async () => {
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => fakeCategory() })
      );
      mockedCount.mockResolvedValueOnce(3);

      await expect(service.deleteCategory('cat-1', 'user-1')).rejects.toThrow(
        'No se puede eliminar una categoría con transacciones asociadas'
      );
    });

    it('elimina la categoría si no tiene transacciones asociadas', async () => {
      const removed = fakeCategory();
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({
          findByIdAndUser: async () => fakeCategory(),
          remove: async () => removed,
        })
      );
      mockedCount.mockResolvedValueOnce(0);

      await expect(service.deleteCategory('cat-1', 'user-1')).resolves.toEqual(removed);
    });
  });

  describe('getCategorySpending', () => {
    it('con monthlyLimit: calcula remaining, percentage e isOverLimit', async () => {
      const category = fakeCategory({ monthlyLimit: 100 as unknown as Category['monthlyLimit'] });
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => category })
      );
      mockedFindMany.mockResolvedValueOnce([{ amount: 70 }, { amount: 50 }]);

      const result = await service.getCategorySpending('cat-1', 'user-1');

      expect(result.spent).toBe(120);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.percentage).toBe(120);
      expect(result.isOverLimit).toBe(true);
    });

    it('sin monthlyLimit: remaining, percentage e isOverLimit quedan null/false', async () => {
      const category = fakeCategory({ monthlyLimit: null });
      const service = new CategoriesServiceImpl(
        fakeCategoryRepo({ findByIdAndUser: async () => category })
      );
      mockedFindMany.mockResolvedValueOnce([{ amount: 20 }]);

      const result = await service.getCategorySpending('cat-1', 'user-1');

      expect(result.spent).toBe(20);
      expect(result.limit).toBeNull();
      expect(result.remaining).toBeNull();
      expect(result.percentage).toBeNull();
      expect(result.isOverLimit).toBe(false);
    });
  });
});
