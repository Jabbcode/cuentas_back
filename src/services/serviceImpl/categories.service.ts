import type { Category } from '@prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from '../../schemas/category.schema.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import type { CategoryRepository } from '../../repositories/interfaces/category.repository.port.js';
import { getMonthRange } from '../../lib/utils/date.utils.js';
import { CATEGORY_MESSAGES } from '../../lib/constants/category.constants.js';
import type { CategoriesService, CategorySpending } from '../interfaces/categories.service.port.js';
import type { TransactionsService } from '../interfaces/transactions.service.port.js';
import type { CategorySystemKey } from '../../lib/constants/category-system-keys.js';

const logger = createLogger('CATEGORIES');

export class CategoriesServiceImpl implements CategoriesService {
  constructor(
    private categoryRepo: CategoryRepository,
    private transactionsService: TransactionsService
  ) {}

  async getCategories(userId: string, type?: 'expense' | 'income') {
    try {
      return await this.categoryRepo.findAllByUser(userId, type);
    } catch (error) {
      return logger.fail(error, 'No se pudieron obtener las categorias del usuario {}', userId);
    }
  }

  async getCategoryById(id: string, userId: string) {
    try {
      const category = await this.categoryRepo.findByIdAndUser(id, userId);

      if (!category) {
        throw new NotFoundError(CATEGORY_MESSAGES.NOT_FOUND);
      }

      return category;
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener la categoria {} del usuario {}', id, userId);
    }
  }

  async createCategory(data: CreateCategoryInput, userId: string) {
    try {
      return await this.categoryRepo.create({ ...data, user: { connect: { id: userId } } });
    } catch (error) {
      return logger.fail(error, 'No se pudo crear la categoria del usuario {}', userId);
    }
  }

  async updateCategory(id: string, data: UpdateCategoryInput, userId: string) {
    await this.getCategoryById(id, userId);

    try {
      return await this.categoryRepo.update(id, data);
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar la categoria {} del usuario {}', id, userId);
    }
  }

  async deleteCategory(id: string, userId: string) {
    await this.getCategoryById(id, userId);

    try {
      // Check if category has transactions
      const transactionCount = await this.transactionsService.countByCategory(id);

      if (transactionCount > 0) {
        throw new ConflictError(CATEGORY_MESSAGES.HAS_TRANSACTIONS);
      }

      return await this.categoryRepo.remove(id);
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar la categoria {} del usuario {}', id, userId);
    }
  }

  async getCategorySpending(categoryId: string, userId: string): Promise<CategorySpending> {
    const category = await this.getCategoryById(categoryId, userId);

    try {
      const now = new Date();
      const { start: startOfMonth, end: endOfMonth } = getMonthRange(
        now.getFullYear(),
        now.getMonth()
      );

      const transactions = await this.transactionsService.findMonthlyCategoryExpenses(
        userId,
        categoryId,
        { gte: startOfMonth, lt: endOfMonth }
      );

      const spent = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const limit = category.monthlyLimit ? Number(category.monthlyLimit) : null;
      const percentage = limit && limit > 0 ? (spent / limit) * 100 : null;

      return {
        categoryId: category.id,
        categoryName: category.name,
        spent,
        limit,
        remaining: limit ? Math.max(0, limit - spent) : null,
        percentage,
        isOverLimit: limit ? spent > limit : false,
      };
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo calcular el gasto de la categoria {} del usuario {}',
        categoryId,
        userId
      );
    }
  }

  async hydrateCategoriesByIds(categoryIds: string[]): Promise<Category[]> {
    try {
      return await this.categoryRepo.findMany({ id: { in: categoryIds } });
    } catch (error) {
      return logger.fail(error, 'No se pudieron hidratar {} categorias', categoryIds.length);
    }
  }

  async hydrateUserCategoriesByIds(categoryIds: string[], userIds: string[]): Promise<Category[]> {
    try {
      return await this.categoryRepo.findMany({ id: { in: categoryIds }, userId: { in: userIds } });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron hidratar categorias para {} usuarios',
        userIds.length
      );
    }
  }

  async getOrCreateSystemCategory(userId: string, systemKey: CategorySystemKey): Promise<Category> {
    try {
      return await this.categoryRepo.upsertSystemCategory(userId, systemKey);
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo obtener o crear la categoria de sistema {} del usuario {}',
        systemKey,
        userId
      );
    }
  }

  async countByUser(userId: string): Promise<number> {
    try {
      return await this.categoryRepo.countByUser(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo contar las categorias del usuario {}', userId);
    }
  }
}
