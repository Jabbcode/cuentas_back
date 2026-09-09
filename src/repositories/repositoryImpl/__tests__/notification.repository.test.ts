import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { NotificationRepositoryImpl } from '../notification.repository.js';
import { fakePrismaModels } from './prisma-fakes.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return fakePrismaModels(
    {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
        update: vi.fn().mockResolvedValue({ id: 'notif-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    },
    overrides
  );
}

describe('NotificationRepositoryImpl', () => {
  it('findAllByUser filtra por userId, ordena por más reciente y limita a 50', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);

    await repo.findAllByUser('user-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('countUnread filtra por userId y read:false', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);

    await repo.countUnread('user-1');

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
    });
  });

  it('findByIdAndUser filtra por id+userId', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);

    await repo.findByIdAndUser('notif-1', 'user-1');

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'user-1' },
    });
  });

  it('findFirst pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);
    const where = { userId: 'user-1', type: 'debt_due' } as never;

    await repo.findFirst(where);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where });
  });

  it('create pasa el data recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);
    const data = { title: 'Aviso' } as never;

    await repo.create(data);

    expect(prisma.notification.create).toHaveBeenCalledWith({ data });
  });

  it('update pasa id y data recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);
    const data = { read: true } as never;

    await repo.update('notif-1', data);

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data,
    });
  });

  it('updateMany pasa where y data recibidos (marcar todas como leídas)', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);
    const where = { userId: 'user-1', read: false } as never;
    const data = { read: true } as never;

    await repo.updateMany(where, data);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where, data });
  });

  it('remove elimina por id', async () => {
    const prisma = fakePrisma();
    const repo = new NotificationRepositoryImpl(prisma);

    await repo.remove('notif-1');

    expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
  });
});
