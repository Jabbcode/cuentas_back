import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { UserRepositoryImpl } from '../user.repository.js';
import { fakePrismaModels } from './prisma-fakes.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return fakePrismaModels(
    {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'user-1' }),
        update: vi.fn().mockResolvedValue({ id: 'user-1' }),
        delete: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
    },
    overrides
  );
}

describe('UserRepositoryImpl', () => {
  it('findByEmail busca por email único', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);

    await repo.findByEmail('user@example.com');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
  });

  it('findById busca por id único, aplicando el select recibido (para nunca exponer password de más)', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);
    const select = { id: true, email: true, name: true } as never;

    await repo.findById('user-1', select);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select });
  });

  it('findFirst pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);
    const where = { email: 'dup@example.com', id: { not: 'user-1' } } as never;

    await repo.findFirst(where);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where });
  });

  it('findMany pasa where y select recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);
    const where = { id: { in: ['a', 'b'] } } as never;

    await repo.findMany(where);

    expect(prisma.user.findMany).toHaveBeenCalledWith({ where, select: undefined });
  });

  it('create pasa el data recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);
    const data = { email: 'nuevo@example.com', password: 'hash', name: 'Nuevo' } as never;

    await repo.create(data);

    expect(prisma.user.create).toHaveBeenCalledWith({ data });
  });

  it('update pasa id, data y select recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);
    const data = { name: 'Actualizado' } as never;
    const select = { id: true, name: true } as never;

    await repo.update('user-1', data, select);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data, select });
  });

  it('remove elimina por id', async () => {
    const prisma = fakePrisma();
    const repo = new UserRepositoryImpl(prisma);

    await repo.remove('user-1');

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });
});
