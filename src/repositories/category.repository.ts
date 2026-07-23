import type { Prisma, Category, PrismaClient } from '@prisma/client';
import {
  SYSTEM_CATEGORY_DEFAULTS,
  type CategorySystemKey,
} from '../lib/constants/category-system-keys.js';
import type { CategoryRepository } from './category.repository.port.js';

// systemKey es un campo interno: nunca se expone en la API pública de categorías.
const PUBLIC_CATEGORY_SELECT = {
  id: true,
  name: true,
  type: true,
  icon: true,
  color: true,
  monthlyLimit: true,
  userId: true,
} satisfies Prisma.CategorySelect;

export class CategoryRepositoryImpl implements CategoryRepository {
  constructor(private prisma: PrismaClient) {}

  async findAllByUser(
    userId: string,
    type?: 'expense' | 'income'
  ): Promise<Omit<Category, 'systemKey'>[]> {
    return this.prisma.category.findMany({
      where: { userId, ...(type && { type }) },
      orderBy: { name: 'asc' },
      select: PUBLIC_CATEGORY_SELECT,
    });
  }

  async findByIdAndUser(id: string, userId: string): Promise<Omit<Category, 'systemKey'> | null> {
    return this.prisma.category.findFirst({
      where: { id, userId },
      select: PUBLIC_CATEGORY_SELECT,
    });
  }

  async findFirst(where: Prisma.CategoryWhereInput): Promise<Category | null> {
    return this.prisma.category.findFirst({ where });
  }

  async findMany(
    where: Prisma.CategoryWhereInput,
    select?: Prisma.CategorySelect
  ): Promise<Category[]> {
    return this.prisma.category.findMany({ where, select }) as Promise<Category[]>;
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.category.count({ where: { userId } });
  }

  async create(data: Prisma.CategoryCreateInput): Promise<Omit<Category, 'systemKey'>> {
    return this.prisma.category.create({ data, select: PUBLIC_CATEGORY_SELECT });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput): Promise<Omit<Category, 'systemKey'>> {
    return this.prisma.category.update({ where: { id }, data, select: PUBLIC_CATEGORY_SELECT });
  }

  async remove(id: string): Promise<Omit<Category, 'systemKey'>> {
    return this.prisma.category.delete({ where: { id }, select: PUBLIC_CATEGORY_SELECT });
  }

  /**
   * Encuentra o crea la categoría de sistema de un usuario para un systemKey dado.
   * Si ya existe (identificada por systemKey, no por name), no toca su name/icon/color
   * — respeta cualquier personalización que el usuario haya hecho.
   */
  async upsertSystemCategory(userId: string, systemKey: CategorySystemKey): Promise<Category> {
    const defaults = SYSTEM_CATEGORY_DEFAULTS[systemKey];
    return this.prisma.category.upsert({
      where: { userId_systemKey: { userId, systemKey } },
      update: {},
      create: {
        userId,
        systemKey,
        name: defaults.name,
        type: defaults.type,
        icon: defaults.icon,
        color: defaults.color,
      },
    });
  }
}
