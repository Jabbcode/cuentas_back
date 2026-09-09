import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { RecurringDebtPaymentRepositoryImpl } from '../recurring-debt-payment.repository.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    recurringDebtPayment: {
      create: vi.fn().mockResolvedValue({ id: 'rdp-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'rdp-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'rdp-1' }),
      ...(overrides.recurringDebtPayment as object),
    },
  } as unknown as PrismaClient;
}

describe('RecurringDebtPaymentRepositoryImpl', () => {
  it('create pasa data e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);
    const data = { amount: 50 } as never;

    await repo.create(data);

    expect(prisma.recurringDebtPayment.create).toHaveBeenCalledWith({
      data,
      include: undefined,
    });
  });

  it('findAllByUser filtra por userId y ordena por isActive/nextDueDate', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);

    await repo.findAllByUser('user-1');

    expect(prisma.recurringDebtPayment.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: undefined,
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
    });
  });

  it('findAllByUser agrega el filtro debtId cuando se pasa', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);

    await repo.findAllByUser('user-1', 'debt-1');

    expect(prisma.recurringDebtPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', debtId: 'debt-1' } })
    );
  });

  it('findByIdAndUser filtra por id+userId', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);

    await repo.findByIdAndUser('rdp-1', 'user-1');

    expect(prisma.recurringDebtPayment.findFirst).toHaveBeenCalledWith({
      where: { id: 'rdp-1', userId: 'user-1' },
      include: undefined,
    });
  });

  it('findFirst pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);
    const where = { debtId: 'debt-1', isActive: true } as never;

    await repo.findFirst(where);

    expect(prisma.recurringDebtPayment.findFirst).toHaveBeenCalledWith({ where });
  });

  it('findUnique busca sin exigir userId (uso interno entre services — Fase 6)', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);

    await repo.findUnique('rdp-1');

    expect(prisma.recurringDebtPayment.findUnique).toHaveBeenCalledWith({
      where: { id: 'rdp-1' },
    });
  });

  it('findDuePayments filtra isActive, nextDueDate<=today, y excluye deudas ya pagadas', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);
    const today = new Date('2026-06-10');

    await repo.findDuePayments(today);

    expect(prisma.recurringDebtPayment.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
        debt: { status: { not: 'paid' } },
      },
      include: undefined,
    });
  });

  it('update pasa id, data e include recibidos', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);
    const data = { isActive: false } as never;

    await repo.update('rdp-1', data);

    expect(prisma.recurringDebtPayment.update).toHaveBeenCalledWith({
      where: { id: 'rdp-1' },
      data,
      include: undefined,
    });
  });

  it('remove elimina por id', async () => {
    const prisma = fakePrisma();
    const repo = new RecurringDebtPaymentRepositoryImpl(prisma);

    await repo.remove('rdp-1');

    expect(prisma.recurringDebtPayment.delete).toHaveBeenCalledWith({ where: { id: 'rdp-1' } });
  });
});
