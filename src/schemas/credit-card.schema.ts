import { z } from 'zod';
import {
  OVERDUE_LOOKBACK_MONTHS_ALLOWED,
  OVERDUE_LOOKBACK_MONTHS_DEFAULT,
} from '../lib/constants/credit-card.constants.js';

const ALLOWED_MONTHS = OVERDUE_LOOKBACK_MONTHS_ALLOWED as readonly number[];

export const statementQuerySchema = z.object({
  months: z.coerce
    .number()
    .refine((value) => ALLOWED_MONTHS.includes(value), {
      message: `months debe ser uno de: ${OVERDUE_LOOKBACK_MONTHS_ALLOWED.join(', ')}`,
    })
    .optional()
    .default(OVERDUE_LOOKBACK_MONTHS_DEFAULT),
});

export const payStatementSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  paymentAccountId: z.string().uuid('ID de cuenta de pago inválido'),
  paymentDate: z.string().optional(),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStart debe tener formato YYYY-MM-DD')
    .optional(),
});

export type StatementQueryInput = z.infer<typeof statementQuerySchema>;
export type PayStatementInput = z.infer<typeof payStatementSchema>;
