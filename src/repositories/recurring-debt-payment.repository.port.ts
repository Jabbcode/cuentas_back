import type { Prisma, RecurringDebtPayment } from '@prisma/client';

export interface RecurringDebtPaymentRepository {
  create(
    data: Prisma.RecurringDebtPaymentCreateInput,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment>;
  findAllByUser(
    userId: string,
    debtId?: string,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment[]>;
  findByIdAndUser(
    id: string,
    userId: string,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment | null>;
  findFirst(where: Prisma.RecurringDebtPaymentWhereInput): Promise<RecurringDebtPayment | null>;
  findUnique(id: string): Promise<RecurringDebtPayment | null>;
  findDuePayments(
    today: Date,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment[]>;
  update(
    id: string,
    data: Prisma.RecurringDebtPaymentUpdateInput,
    include?: Prisma.RecurringDebtPaymentInclude
  ): Promise<RecurringDebtPayment>;
  remove(id: string): Promise<void>;
}
