import type { Prisma, CreditCardPayment } from '@prisma/client';

export interface CreditCardPaymentRepository {
  findFirst(where: Prisma.CreditCardPaymentWhereInput): Promise<CreditCardPayment | null>;
  findMany(where: Prisma.CreditCardPaymentWhereInput): Promise<CreditCardPayment[]>;
  create(data: Prisma.CreditCardPaymentCreateInput): Promise<CreditCardPayment>;
}
