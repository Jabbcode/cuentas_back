import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { DebtRepositoryImpl } from '../debt.repository.js';
import { fakePrismaModels } from './prisma-fakes.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return fakePrismaModels(
    {
      debt: {
        create: vi.fn().mockResolvedValue({ id: 'debt-1' }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({ id: 'debt-1' }),
        delete: vi.fn().mockResolvedValue({ id: 'debt-1' }),
      },
    },
    overrides
  );
}

describe('DebtRepositoryImpl', () => {
  it('create pasa el data recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);
    const data = { creditor: 'Banco' } as never;

    await repo.create(data);

    expect(prisma.debt.create).toHaveBeenCalledWith({ data });
  });

  it('findAllByUser usa el where recibido (ya debe incluir userId) y ordena por status/dueDate', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    await repo.findAllByUser(where);

    expect(prisma.debt.findMany).toHaveBeenCalledWith({
      where,
      include: undefined,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  });

  it('findByIdAndUser filtra por id+userId', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);

    await repo.findByIdAndUser('debt-1', 'user-1');

    expect(prisma.debt.findFirst).toHaveBeenCalledWith({
      where: { id: 'debt-1', userId: 'user-1' },
      include: undefined,
    });
  });

  it('countByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);

    await repo.countByUser('user-1');

    expect(prisma.debt.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('update pasa id y data recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);
    const data = { status: 'paid' } as never;

    await repo.update('debt-1', data);

    expect(prisma.debt.update).toHaveBeenCalledWith({ where: { id: 'debt-1' }, data });
  });

  it('remove elimina por id', async () => {
    const prisma = fakePrisma();
    const repo = new DebtRepositoryImpl(prisma);

    await repo.remove('debt-1');

    expect(prisma.debt.delete).toHaveBeenCalledWith({ where: { id: 'debt-1' } });
  });
});
