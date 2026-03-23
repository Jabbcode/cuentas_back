import { z } from 'zod';

export const createRecurringDebtPaymentSchema = z.object({
  debtId: z.string().uuid('ID de deuda inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  accountId: z.string().uuid('ID de cuenta inválido'),
  frequency: z.enum(['monthly', 'biweekly', 'weekly'], {
    errorMap: () => ({ message: 'Frecuencia inválida' }),
  }),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    // If frequency is monthly, dayOfMonth is required
    if (data.frequency === 'monthly' && !data.dayOfMonth) {
      return false;
    }
    // If frequency is weekly, dayOfWeek is required
    if (data.frequency === 'weekly' && data.dayOfWeek === undefined) {
      return false;
    }
    return true;
  },
  {
    message: 'Para pagos mensuales se requiere el día del mes, para pagos semanales se requiere el día de la semana',
  }
);

export const updateRecurringDebtPaymentSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0').optional(),
  accountId: z.string().uuid('ID de cuenta inválido').optional(),
  frequency: z.enum(['monthly', 'biweekly', 'weekly']).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export type CreateRecurringDebtPaymentInput = z.infer<typeof createRecurringDebtPaymentSchema>;
export type UpdateRecurringDebtPaymentInput = z.infer<typeof updateRecurringDebtPaymentSchema>;
