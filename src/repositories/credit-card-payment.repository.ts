import { prisma } from '../lib/prisma.js';
import type { Prisma, CreditCardPayment } from '@prisma/client';

export async function findFirst(
  where: Prisma.CreditCardPaymentWhereInput
): Promise<CreditCardPayment | null> {
  return prisma.creditCardPayment.findFirst({ where });
}

export async function create(
  data: Prisma.CreditCardPaymentCreateInput
): Promise<CreditCardPayment> {
  return prisma.creditCardPayment.create({ data });
}
