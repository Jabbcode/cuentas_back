import { prisma } from '../lib/prisma.js';
import type { Prisma, Category } from '@prisma/client';
import {
  SYSTEM_CATEGORY_DEFAULTS,
  type CategorySystemKey,
} from '../lib/constants/category-system-keys.js';

export async function findAllByUser(
  userId: string,
  type?: 'expense' | 'income'
): Promise<Category[]> {
  return prisma.category.findMany({
    where: { userId, ...(type && { type }) },
    orderBy: { name: 'asc' },
  });
}

export async function findByIdAndUser(id: string, userId: string): Promise<Category | null> {
  return prisma.category.findFirst({ where: { id, userId } });
}

export async function findFirst(where: Prisma.CategoryWhereInput): Promise<Category | null> {
  return prisma.category.findFirst({ where });
}

export async function findMany(
  where: Prisma.CategoryWhereInput,
  select?: Prisma.CategorySelect
): Promise<Category[]> {
  return prisma.category.findMany({ where, select }) as Promise<Category[]>;
}

export async function countByUser(userId: string): Promise<number> {
  return prisma.category.count({ where: { userId } });
}

export async function create(data: Prisma.CategoryCreateInput): Promise<Category> {
  return prisma.category.create({ data });
}

export async function update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
  return prisma.category.update({ where: { id }, data });
}

export async function remove(id: string): Promise<Category> {
  return prisma.category.delete({ where: { id } });
}

/**
 * Encuentra o crea la categoría de sistema de un usuario para un systemKey dado.
 * Si ya existe (identificada por systemKey, no por name), no toca su name/icon/color
 * — respeta cualquier personalización que el usuario haya hecho.
 */
export async function upsertSystemCategory(
  userId: string,
  systemKey: CategorySystemKey
): Promise<Category> {
  const defaults = SYSTEM_CATEGORY_DEFAULTS[systemKey];
  return prisma.category.upsert({
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
