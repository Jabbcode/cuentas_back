import type { Prisma, Category } from '@prisma/client';
import type { CategorySystemKey } from '../lib/constants/category-system-keys.js';

export interface CategoryRepository {
  findAllByUser(
    userId: string,
    type?: 'expense' | 'income'
  ): Promise<Omit<Category, 'systemKey'>[]>;
  findByIdAndUser(id: string, userId: string): Promise<Omit<Category, 'systemKey'> | null>;
  findFirst(where: Prisma.CategoryWhereInput): Promise<Category | null>;
  findMany(where: Prisma.CategoryWhereInput, select?: Prisma.CategorySelect): Promise<Category[]>;
  countByUser(userId: string): Promise<number>;
  create(data: Prisma.CategoryCreateInput): Promise<Omit<Category, 'systemKey'>>;
  update(id: string, data: Prisma.CategoryUpdateInput): Promise<Omit<Category, 'systemKey'>>;
  remove(id: string): Promise<Omit<Category, 'systemKey'>>;
  upsertSystemCategory(userId: string, systemKey: CategorySystemKey): Promise<Category>;
}
