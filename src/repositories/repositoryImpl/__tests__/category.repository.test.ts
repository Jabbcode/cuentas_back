import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { CategoryRepositoryImpl } from '../category.repository.js';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  type: true,
  icon: true,
  color: true,
  monthlyLimit: true,
  userId: true,
};

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'category-1' }),
      update: vi.fn().mockResolvedValue({ id: 'category-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'category-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'category-1' }),
      ...(overrides.category as object),
    },
  } as unknown as PrismaClient;
}

describe('CategoryRepositoryImpl', () => {
  it('findAllByUser filtra por userId, nunca expone systemKey (select público)', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.findAllByUser('user-1');

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { name: 'asc' },
      select: PUBLIC_SELECT,
    });
  });

  it('findAllByUser agrega el filtro type cuando se pasa', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.findAllByUser('user-1', 'expense');

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', type: 'expense' } })
    );
  });

  it('findByIdAndUser filtra por id+userId con select público', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.findByIdAndUser('category-1', 'user-1');

    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: 'category-1', userId: 'user-1' },
      select: PUBLIC_SELECT,
    });
  });

  it('findFirst pasa el where tal cual (sin select público — uso interno)', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);
    const where = { userId: 'user-1', systemKey: 'DEBT_PAYMENT' } as never;

    await repo.findFirst(where);

    expect(prisma.category.findFirst).toHaveBeenCalledWith({ where });
  });

  it('findMany pasa where y select recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);
    const where = { id: { in: ['a', 'b'] } } as never;

    await repo.findMany(where);

    expect(prisma.category.findMany).toHaveBeenCalledWith({ where, select: undefined });
  });

  it('countByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.countByUser('user-1');

    expect(prisma.category.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('create usa select público', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);
    const data = { name: 'Nueva' } as never;

    await repo.create(data);

    expect(prisma.category.create).toHaveBeenCalledWith({ data, select: PUBLIC_SELECT });
  });

  it('update usa select público', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);
    const data = { name: 'x' } as never;

    await repo.update('category-1', data);

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'category-1' },
      data,
      select: PUBLIC_SELECT,
    });
  });

  it('remove usa select público', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.remove('category-1');

    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: 'category-1' },
      select: PUBLIC_SELECT,
    });
  });

  it('upsertSystemCategory usa la clave compuesta userId_systemKey y no pisa una categoría existente (update: {})', async () => {
    const prisma = fakePrisma();
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.upsertSystemCategory('user-1', 'DEBT_PAYMENT' as never);

    expect(prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_systemKey: { userId: 'user-1', systemKey: 'DEBT_PAYMENT' } },
        update: {},
      })
    );
  });

  it('upsertSystemCategory crea con los defaults del systemKey si no existe', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'category-1' });
    const prisma = fakePrisma({ category: { upsert } });
    const repo = new CategoryRepositoryImpl(prisma);

    await repo.upsertSystemCategory('user-1', 'DEBT_PAYMENT' as never);

    const call = upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ userId: 'user-1', systemKey: 'DEBT_PAYMENT' });
    expect(call.create.name).toEqual(expect.any(String));
  });
});
