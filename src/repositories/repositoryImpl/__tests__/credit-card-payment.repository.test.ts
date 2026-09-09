import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { CreditCardPaymentRepositoryImpl } from '../credit-card-payment.repository.js';

function fakePrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    creditCardPayment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
      ...(overrides.creditCardPayment as object),
    },
  } as unknown as PrismaClient;
}

describe('CreditCardPaymentRepositoryImpl', () => {
  it('findFirst pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new CreditCardPaymentRepositoryImpl(prisma);
    const where = { accountId: 'card-1' } as never;

    await repo.findFirst(where);

    expect(prisma.creditCardPayment.findFirst).toHaveBeenCalledWith({ where });
  });

  it('findMany pasa el where recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new CreditCardPaymentRepositoryImpl(prisma);
    const where = { accountId: { in: ['card-1', 'card-2'] } } as never;

    await repo.findMany(where);

    expect(prisma.creditCardPayment.findMany).toHaveBeenCalledWith({ where });
  });

  it('create pasa el data recibido tal cual', async () => {
    const prisma = fakePrisma();
    const repo = new CreditCardPaymentRepositoryImpl(prisma);
    const data = { amount: 100 } as never;

    await repo.create(data);

    expect(prisma.creditCardPayment.create).toHaveBeenCalledWith({ data });
  });
});
