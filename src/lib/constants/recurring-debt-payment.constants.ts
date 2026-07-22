export const RECURRING_FREQUENCY = {
  MONTHLY: 'monthly',
  BIWEEKLY: 'biweekly',
  WEEKLY: 'weekly',
} as const;

export const RECURRING_FREQUENCY_VALUES = [
  RECURRING_FREQUENCY.MONTHLY,
  RECURRING_FREQUENCY.BIWEEKLY,
  RECURRING_FREQUENCY.WEEKLY,
] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCY)[keyof typeof RECURRING_FREQUENCY];

export const RECURRING_DEBT_PAYMENT_MESSAGES = {
  NOT_FOUND: 'Pago recurrente no encontrado',
  CANNOT_CONFIGURE_ON_PAID_DEBT: 'No se pueden configurar pagos recurrentes para una deuda pagada',
  DELETED: 'Pago recurrente eliminado correctamente',
} as const;

export const PROCESS_PENDING_STATUS = {
  PROCESSED: 'processed',
  SKIPPED: 'skipped',
  ERROR: 'error',
  DEACTIVATED: 'deactivated',
} as const;

export const PROCESS_PENDING_REASONS = {
  END_DATE_REACHED: 'End date reached',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
} as const;
