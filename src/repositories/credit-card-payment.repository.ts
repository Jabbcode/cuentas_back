import type { Prisma, CreditCardPayment, PrismaClient } from '@prisma/client';
import type { CreditCardPaymentRepository } from './credit-card-payment.repository.port.js';

export class CreditCardPaymentRepositoryImpl implements CreditCardPaymentRepository {
  constructor(private prisma: PrismaClient) {}

  async findFirst(where: Prisma.CreditCardPaymentWhereInput): Promise<CreditCardPayment | null> {
    return this.prisma.creditCardPayment.findFirst({ where });
  }

  async findMany(where: Prisma.CreditCardPaymentWhereInput): Promise<CreditCardPayment[]> {
    return this.prisma.creditCardPayment.findMany({ where });
  }

  async create(data: Prisma.CreditCardPaymentCreateInput): Promise<CreditCardPayment> {
    return this.prisma.creditCardPayment.create({ data });
  }
}
