export const CREDIT_CARD_MESSAGES = {
  NOT_FOUND_OR_NOT_CARD: 'Cuenta no encontrada o no es una tarjeta de crédito',
  MISSING_CUTOFF_DATES: 'La tarjeta no tiene configuradas las fechas de corte y pago',
  ALREADY_PAID: 'El estado de cuenta ya está pagado',
  PERIOD_NOT_FOUND: 'El período solicitado no existe o ya fue pagado',
} as const;

export const OVERDUE_LOOKBACK_MONTHS_DEFAULT = 6;
export const OVERDUE_LOOKBACK_MONTHS_ALLOWED = [3, 6, 12] as const;
