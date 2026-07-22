import { z } from 'zod';
import { INTEREST_TYPE_VALUES, DEBT_STATUS_VALUES } from '../lib/constants/debt.constants.js';

export const createDebtSchema = z.object({
  creditor: z.string().min(1, 'El acreedor es requerido'),
  description: z.string().min(1, 'La descripción es requerida'),
  totalAmount: z.number().positive('El monto debe ser mayor a 0'),
  interestRate: z.number().nonnegative().optional(),
  interestType: z.enum(INTEREST_TYPE_VALUES).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateDebtSchema = z.object({
  creditor: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  interestRate: z.number().nonnegative().optional(),
  interestType: z.enum(INTEREST_TYPE_VALUES).optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(DEBT_STATUS_VALUES).optional(),
});

export const payDebtSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  accountId: z.string().uuid('ID de cuenta inválido'),
  notes: z.string().optional(),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type PayDebtInput = z.infer<typeof payDebtSchema>;
