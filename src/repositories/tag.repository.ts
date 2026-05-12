import { prisma } from '../lib/prisma.js';
import type { Prisma, Tag } from '@prisma/client';

export async function findAllByUser(
  userId: string,
  nameFilter?: string,
  include?: Prisma.TagInclude
): Promise<Tag[]> {
  return prisma.tag.findMany({
    where: {
      userId,
      ...(nameFilter ? { name: { contains: nameFilter, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    include,
  });
}

export async function findByIdAndUser(id: string, userId: string): Promise<Tag | null> {
  return prisma.tag.findFirst({ where: { id, userId } });
}

export async function upsert(userId: string, name: string): Promise<Tag> {
  return prisma.tag.upsert({
    where: { userId_name: { userId, name } },
    update: {},
    create: { name, userId },
  });
}

export async function remove(id: string): Promise<Tag> {
  return prisma.tag.delete({ where: { id } });
}
