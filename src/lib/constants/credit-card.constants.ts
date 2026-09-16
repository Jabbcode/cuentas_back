import { formatDateKey } from '../utils/credit-card.utils.js';

export const CREDIT_CARD_MESSAGES = {
  NOT_FOUND_OR_NOT_CARD: 'Cuenta no encontrada o no es una tarjeta de crédito',
  MISSING_CUTOFF_DATES: 'La tarjeta no tiene configuradas las fechas de corte y pago',
  ALREADY_PAID: 'El estado de cuenta ya está pagado',
  PERIOD_NOT_FOUND: 'El período solicitado no existe o ya fue pagado',
  MISSING_LIMIT: 'La tarjeta no tiene configurado un límite de crédito',
  PERIOD_LIMIT_EXCEEDED: (periodStart: Date, periodEnd: Date, limit: number) =>
    `Se superó el límite del período ${formatDateKey(periodStart)} al ${formatDateKey(periodEnd)} (límite: ${limit})`,
  PAID_PERIOD_LOCKED: (periodStart: Date, periodEnd: Date, paymentDate: Date) =>
    `El período ${formatDateKey(periodStart)} al ${formatDateKey(periodEnd)} ya fue pagado el ${formatDateKey(paymentDate)} y no admite nuevas transacciones`,
} as const;

export const OVERDUE_LOOKBACK_MONTHS_DEFAULT = 6;
export const OVERDUE_LOOKBACK_MONTHS_ALLOWED = [3, 6, 12] as const;
/**
 * Ventana usada para resolver un pago por `periodStart`: siempre la máxima
 * permitida, no el default. El período a pagar puede haberse listado con
 * cualquier valor de OVERDUE_LOOKBACK_MONTHS_ALLOWED (el usuario eligió 12 en
 * el selector); resolver el pago sólo contra el default (6) haría que un
 * período visible en pantalla devuelva 404 al intentar pagarlo.
 */
export const OVERDUE_LOOKBACK_MONTHS_MAX = Math.max(...OVERDUE_LOOKBACK_MONTHS_ALLOWED);
