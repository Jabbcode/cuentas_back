import type { Category } from '@prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import type { CategoryRepository } from '../repositories/category.repository.port.js';
import { getMonthRange } from '../lib/utils/date.utils.js';
import { CATEGORY_MESSAGES } from '../lib/constants/category.constants.js';
import type { CategoriesService, CategorySpending } from './categories.service.port.js';
import type { TransactionsService } from './transactions.service.port.js';
import type { CategorySystemKey } from '../lib/constants/category-system-keys.js';

export class CategoriesServiceImpl implements CategoriesService {
  constructor(
    private categoryRepo: CategoryRepository,
    private transactionsService: TransactionsService
  ) {}

  async getCategories(userId: string, type?: 'expense' | 'income') {
    return this.categoryRepo.findAllByUser(userId, type);
  }

  async getCategoryById(id: string, userId: string) {
    const category = await this.categoryRepo.findByIdAndUser(id, userId);

    if (!category) {
      throw new NotFoundError(CATEGORY_MESSAGES.NOT_FOUND);
    }

    return category;
  }

  async createCategory(data: CreateCategoryInput, userId: string) {
    return this.categoryRepo.create({ ...data, user: { connect: { id: userId } } });
  }

  async updateCategory(id: string, data: UpdateCategoryInput, userId: string) {
    await this.getCategoryById(id, userId);

    return this.categoryRepo.update(id, data);
  }

  async deleteCategory(id: string, userId: string) {
    await this.getCategoryById(id, userId);

    // Check if category has transactions
    const transactionCount = await this.transactionsService.countByCategory(id);

    if (transactionCount > 0) {
      throw new ConflictError(CATEGORY_MESSAGES.HAS_TRANSACTIONS);
    }

    return this.categoryRepo.remove(id);
  }

  async getCategorySpending(categoryId: string, userId: string): Promise<CategorySpending> {
    const category = await this.getCategoryById(categoryId, userId);

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
  }

  async hydrateCategoriesByIds(categoryIds: string[]): Promise<Category[]> {
    return this.categoryRepo.findMany({ id: { in: categoryIds } });
  }

  async hydrateUserCategoriesByIds(categoryIds: string[], userIds: string[]): Promise<Category[]> {
    return this.categoryRepo.findMany({ id: { in: categoryIds }, userId: { in: userIds } });
  }

  async getOrCreateSystemCategory(userId: string, systemKey: CategorySystemKey): Promise<Category> {
    return this.categoryRepo.upsertSystemCategory(userId, systemKey);
  }

  async countByUser(userId: string): Promise<number> {
    return this.categoryRepo.countByUser(userId);
  }
}
