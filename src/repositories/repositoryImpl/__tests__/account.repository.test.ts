import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../lib/errors.js';
import { AccountRepositoryImpl } from '../account.repository.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    account: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'account-1' }),
      update: vi.fn().mockResolvedValue({ id: 'account-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'account-1' }),
    },
    transfer: {
      create: vi.fn().mockResolvedValue({ id: 'transfer-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

describe('AccountRepositoryImpl', () => {
  it('findAllByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);

    await repo.findAllByUser('user-1');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findByIdAndUser filtra por id y userId', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);

    await repo.findByIdAndUser('account-1', 'user-1');

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { id: 'account-1', userId: 'user-1' },
    });
  });

  it('findCreditCardsByUser filtra por userId, type y los filtros extra', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);

    await repo.findCreditCardsByUser('user-1', { cutoffDay: { not: null } });

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', type: 'credit_card', cutoffDay: { not: null } },
    });
  });

  it('countByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);

    await repo.countByUser('user-1');

    expect(prisma.account.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('create pasa el data tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);
    const data = { name: 'Nueva' } as never;

    await repo.create(data);

    expect(prisma.account.create).toHaveBeenCalledWith({ data });
  });

  describe('update', () => {
    it('lanza NotFoundError si la cuenta no pertenece al usuario, sin llamar a update', async () => {
      const prisma = fakePrisma({
        account: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      });
      const repo = new AccountRepositoryImpl(prisma);

      await expect(repo.update('account-1', 'user-1', { name: 'x' } as never)).rejects.toThrow(
        NotFoundError
      );
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it('verifica ownership (id+userId) antes de actualizar por id', async () => {
      const findFirst = vi.fn().mockResolvedValue({ id: 'account-1' });
      const prisma = fakePrisma({ account: { findFirst, update: vi.fn().mockResolvedValue({}) } });
      const repo = new AccountRepositoryImpl(prisma);

      await repo.update('account-1', 'user-1', { name: 'x' } as never);

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'account-1', userId: 'user-1' },
        select: { id: true },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: { name: 'x' },
      });
    });
  });

  describe('remove', () => {
    it('lanza NotFoundError si la cuenta no pertenece al usuario, sin llamar a delete', async () => {
      const prisma = fakePrisma({
        account: { findFirst: vi.fn().mockResolvedValue(null), delete: vi.fn() },
      });
      const repo = new AccountRepositoryImpl(prisma);

      await expect(repo.remove('account-1', 'user-1')).rejects.toThrow(NotFoundError);
      expect(prisma.account.delete).not.toHaveBeenCalled();
    });

    it('verifica ownership (id+userId) antes de eliminar', async () => {
      const findFirst = vi.fn().mockResolvedValue({ id: 'account-1' });
      const prisma = fakePrisma({ account: { findFirst, delete: vi.fn().mockResolvedValue({}) } });
      const repo = new AccountRepositoryImpl(prisma);

      await repo.remove('account-1', 'user-1');

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'account-1', userId: 'user-1' },
        select: { id: true },
      });
      expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'account-1' } });
    });
  });

  it('createTransfer incluye fromAccount y toAccount', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);
    const data = { amount: 10 } as never;

    await repo.createTransfer(data);

    expect(prisma.transfer.create).toHaveBeenCalledWith({
      data,
      include: { fromAccount: true, toAccount: true },
    });
  });

  it('findTransfersByAccount filtra por userId y OR de fromAccountId/toAccountId', async () => {
    const prisma = fakePrisma();
    const repo = new AccountRepositoryImpl(prisma);

    await repo.findTransfersByAccount('account-1', 'user-1');

    expect(prisma.transfer.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        OR: [{ fromAccountId: 'account-1' }, { toAccountId: 'account-1' }],
      },
      include: { fromAccount: true, toAccount: true },
      orderBy: { date: 'desc' },
    });
  });
});
