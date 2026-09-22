import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { TransactionRepositoryImpl } from '../transaction.repository.js';
import { fakePrismaModels } from './prisma-fakes.js';

function fakePrisma(
  overrides: Record<string, unknown> = {},
  queryRaw?: ReturnType<typeof vi.fn>
): PrismaClient {
  const base = fakePrismaModels(
    {
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      receiptItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    overrides
  );
  return {
    ...base,
    $queryRaw: queryRaw ?? vi.fn().mockResolvedValue([]),
  } as unknown as PrismaClient;
}

describe('TransactionRepositoryImpl', () => {
  it('findMany fusiona where con las opciones (include/orderBy/take/skip)', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    await repo.findMany(where, { take: 10, skip: 5 });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({ where, take: 10, skip: 5 });
  });

  it('count pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    await repo.count(where);

    expect(prisma.transaction.count).toHaveBeenCalledWith({ where });
  });

  it('findByIdAndUser filtra por id+userId', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);

    await repo.findByIdAndUser('tx-1', 'user-1');

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: 'tx-1', userId: 'user-1' },
      include: undefined,
    });
  });

  it('findFirst pasa where e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1', imageHash: 'abc' } as never;

    await repo.findFirst(where);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({ where, include: undefined });
  });

  it('updateMany pasa where y data recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { fixedExpenseId: 'fe-1', userId: 'user-1' } as never;
    const data = { categoryId: 'cat-2' } as never;

    await repo.updateMany(where, data);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where, data });
  });

  it('groupByCategory agrupa por categoryId+type con sum y count', () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    repo.groupByCategory(where);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId', 'type'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
  });

  it('groupExpensesByCategory ordena por suma descendente y respeta el take (default 10)', () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1' } as never;

    repo.groupExpensesByCategory(where);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });
  });

  it('groupExpensesByCategory respeta un take explícito', () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);

    repo.groupExpensesByCategory({} as never, 3);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it('groupTotalsByUser agrupa por userId+type', () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: { in: ['u1', 'u2'] } } as never;

    repo.groupTotalsByUser(where);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['userId', 'type'],
      where,
      _sum: { amount: true },
    });
  });

  it('groupExpensesByUserAndCategory agrupa por userId+categoryId ordenado desc', () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: { in: ['u1'] } } as never;

    repo.groupExpensesByUserAndCategory(where);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['userId', 'categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
  });

  it('aggregate suma amount sobre el where recibido', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const where = { userId: 'user-1', type: 'expense' } as never;

    await repo.aggregate(where);

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where,
      _sum: { amount: true },
    });
  });

  it('findReceiptItems filtra por transactionId y ordena por creación ascendente', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);

    await repo.findReceiptItems('tx-1');

    expect(prisma.receiptItem.findMany).toHaveBeenCalledWith({
      where: { transactionId: 'tx-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('countByUser filtra por userId', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);

    await repo.countByUser('user-1');

    expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('findFirstByUser filtra por userId, ordena según lo recibido y solo selecciona date', async () => {
    const prisma = fakePrisma();
    const repo = new TransactionRepositoryImpl(prisma);
    const orderBy = { date: 'asc' } as never;

    await repo.findFirstByUser('user-1', orderBy);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy,
      select: { date: true },
    });
  });

  it('groupByCategoryAndMonth envía userId, type y fechas como parámetros enlazados, no interpolados en el texto', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const prisma = fakePrisma({}, queryRaw);
    const repo = new TransactionRepositoryImpl(prisma);
    const gte = new Date('2026-01-01');
    const lte = new Date('2026-01-31');

    await repo.groupByCategoryAndMonth({ userId: 'user-1', type: 'expense', gte, lte });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql).not.toContain('user-1');
    expect(sqlArg.sql).not.toContain('expense');
    expect(sqlArg.values).toEqual(['user-1', 'expense', gte, lte]);
    expect(sqlArg.sql).toContain('date_trunc');
    expect(sqlArg.sql).toContain('GROUP BY 1, 2');
  });

  it('groupByCategoryAndMonth añade el fragmento de accountId como parámetro enlazado cuando se pasa', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const prisma = fakePrisma({}, queryRaw);
    const repo = new TransactionRepositoryImpl(prisma);
    const gte = new Date('2026-01-01');
    const lte = new Date('2026-01-31');

    await repo.groupByCategoryAndMonth({
      userId: 'user-1',
      type: 'expense',
      gte,
      lte,
      accountId: 'account-1',
    });

    const sqlArg = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql).not.toContain('account-1');
    expect(sqlArg.sql).toContain('"accountId"');
    expect(sqlArg.values).toEqual(['user-1', 'expense', gte, lte, 'account-1']);
  });

  it('groupByCategoryAndMonth no añade el fragmento de accountId cuando no se pasa', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const prisma = fakePrisma({}, queryRaw);
    const repo = new TransactionRepositoryImpl(prisma);
    const gte = new Date('2026-01-01');
    const lte = new Date('2026-01-31');

    await repo.groupByCategoryAndMonth({ userId: 'user-1', type: 'expense', gte, lte });

    const sqlArg = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql).not.toContain('"accountId"');
    expect(sqlArg.values).toHaveLength(4);
  });
});
