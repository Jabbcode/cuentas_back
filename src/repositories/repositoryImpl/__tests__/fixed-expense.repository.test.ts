import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { FixedExpenseRepositoryImpl } from '../fixed-expense.repository.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    fixedExpense: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'fe-1' }),
      update: vi.fn().mockResolvedValue({ id: 'fe-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'fe-1' }),
      ...(overrides.fixedExpense as object),
    },
  } as unknown as PrismaClient;
}

describe('FixedExpenseRepositoryImpl', () => {
  it('findAllByUser siempre filtra por userId, fusionado con filtros extra', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);

    await repo.findAllByUser('user-1', { isActive: true });

    expect(prisma.fixedExpense.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('findAllByUser sin filtros solo aplica userId', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);

    await repo.findAllByUser('user-1');

    expect(prisma.fixedExpense.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('findByIdAndUser filtra por id+userId', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);

    await repo.findByIdAndUser('fe-1', 'user-1');

    expect(prisma.fixedExpense.findFirst).toHaveBeenCalledWith({
      where: { id: 'fe-1', userId: 'user-1' },
      include: undefined,
    });
  });

  it('findFirst pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);
    const where = { userId: 'user-1', creditCardAccountId: 'card-1' } as never;

    await repo.findFirst(where);

    expect(prisma.fixedExpense.findFirst).toHaveBeenCalledWith({ where });
  });

  it('findMany pasa where e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    await repo.findMany(where);

    expect(prisma.fixedExpense.findMany).toHaveBeenCalledWith({ where, include: undefined });
  });

  it('countByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);

    await repo.countByUser('user-1');

    expect(prisma.fixedExpense.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('create pasa data e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);
    const data = { name: 'Renta' } as never;

    await repo.create(data);

    expect(prisma.fixedExpense.create).toHaveBeenCalledWith({ data, include: undefined });
  });

  it('update pasa id, data e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);
    const data = { amount: 200 } as never;

    await repo.update('fe-1', data);

    expect(prisma.fixedExpense.update).toHaveBeenCalledWith({
      where: { id: 'fe-1' },
      data,
      include: undefined,
    });
  });

  it('remove elimina por id', async () => {
    const prisma = fakePrisma();
    const repo = new FixedExpenseRepositoryImpl(prisma);

    await repo.remove('fe-1');

    expect(prisma.fixedExpense.delete).toHaveBeenCalledWith({ where: { id: 'fe-1' } });
  });
});
