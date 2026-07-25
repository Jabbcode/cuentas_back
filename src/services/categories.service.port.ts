import type { Category } from '@prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js';
import type { CategorySystemKey } from '../lib/constants/category-system-keys.js';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  spent: number;
  limit: number | null;
  remaining: number | null;
  percentage: number | null;
  isOverLimit: boolean;
}

export interface CategoriesService {
  getCategories(
    userId: string,
    type?: 'expense' | 'income'
  ): Promise<Omit<Category, 'systemKey'>[]>;
  getCategoryById(id: string, userId: string): Promise<Omit<Category, 'systemKey'>>;
  createCategory(data: CreateCategoryInput, userId: string): Promise<Omit<Category, 'systemKey'>>;
  updateCategory(
    id: string,
    data: UpdateCategoryInput,
    userId: string
  ): Promise<Omit<Category, 'systemKey'>>;
  deleteCategory(id: string, userId: string): Promise<Omit<Category, 'systemKey'>>;
  getCategorySpending(categoryId: string, userId: string): Promise<CategorySpending>;
  hydrateCategoriesByIds(categoryIds: string[]): Promise<Category[]>;
  hydrateUserCategoriesByIds(categoryIds: string[], userIds: string[]): Promise<Category[]>;
  getOrCreateSystemCategory(userId: string, systemKey: CategorySystemKey): Promise<Category>;
  countByUser(userId: string): Promise<number>;
}
