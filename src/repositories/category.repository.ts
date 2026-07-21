import { prisma } from '../lib/prisma.js';
import type { Prisma, Category } from '@prisma/client';
import {
  SYSTEM_CATEGORY_DEFAULTS,
  type CategorySystemKey,
} from '../lib/constants/category-system-keys.js';

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

export async function findAllByUser(
  userId: string,
  type?: 'expense' | 'income'
): Promise<Omit<Category, 'systemKey'>[]> {
  return prisma.category.findMany({
    where: { userId, ...(type && { type }) },
    orderBy: { name: 'asc' },
    select: PUBLIC_CATEGORY_SELECT,
  });
}

export async function findByIdAndUser(
  id: string,
  userId: string
): Promise<Omit<Category, 'systemKey'> | null> {
  return prisma.category.findFirst({ where: { id, userId }, select: PUBLIC_CATEGORY_SELECT });
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

export async function create(
  data: Prisma.CategoryCreateInput
): Promise<Omit<Category, 'systemKey'>> {
  return prisma.category.create({ data, select: PUBLIC_CATEGORY_SELECT });
}

export async function update(
  id: string,
  data: Prisma.CategoryUpdateInput
): Promise<Omit<Category, 'systemKey'>> {
  return prisma.category.update({ where: { id }, data, select: PUBLIC_CATEGORY_SELECT });
}

export async function remove(id: string): Promise<Omit<Category, 'systemKey'>> {
  return prisma.category.delete({ where: { id }, select: PUBLIC_CATEGORY_SELECT });
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
