import { ConflictError, ValidationError } from '../errors.js';
import { ACCOUNT_TYPES } from '../constants/account.constants.js';
import { TRANSACTION_TYPE } from '../constants/shared.constants.js';
import { CREDIT_CARD_MESSAGES } from '../constants/credit-card.constants.js';

export interface CreditLimitEntry {
  creditLimit: number;
  effectiveFrom: Date;
}

/**
 * Límite vigente en el instante `at`: la última entrada de `entries` (se
 * asume ordenada ascendente por `effectiveFrom`) con `effectiveFrom <= at`.
 * Si ninguna entrada es anterior o igual a `at` (tarjeta sin historial
 * previo a esa fecha), devuelve `fallback` — el `creditLimit` actual de la
 * cuenta.
 */
export function resolveCreditLimitAt(
  entries: CreditLimitEntry[],
  at: Date,
  fallback: number | null
): number | null {
  let resolved: number | null = fallback;
  for (const entry of entries) {
    if (entry.effectiveFrom.getTime() <= at.getTime()) {
      resolved = entry.creditLimit;
    } else {
      break;
    }
  }
  return resolved;
}

export interface CreditCardPeriodLimitInfo {
  type: string;
  /** Límite vigente del período al que corresponde la fecha del gasto. `null` = sin límite configurado. */
  periodLimit: number | null;
  /** Gasto ya acumulado en ese período, sin contar `amount`. */
  periodUsed: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Bloquea un gasto sobre tarjeta de crédito que dejaría el uso del período al
 * que corresponde su fecha por encima del límite vigente de ESE período —
 * no del saldo acumulado de la cuenta ni de la deuda de otros períodos.
 * `amount` es el monto del gasto que se aplicaría; `resultingType` es el tipo
 * de movimiento tras la operación. No valida cuentas que no sean tarjeta ni
 * movimientos que no sean gasto.
 */
export function assertCreditCardPeriodLimit(
  card: CreditCardPeriodLimitInfo,
  amount: number,
  resultingType: string
): void {
  if (card.type !== ACCOUNT_TYPES.CREDIT_CARD || resultingType !== TRANSACTION_TYPE.EXPENSE) {
    return;
  }

  if (card.periodLimit == null) {
    throw new ValidationError(CREDIT_CARD_MESSAGES.MISSING_LIMIT);
  }

  const resultingUsage = card.periodUsed + amount;

  if (resultingUsage > card.periodLimit) {
    throw new ConflictError(
      CREDIT_CARD_MESSAGES.PERIOD_LIMIT_EXCEEDED(card.periodStart, card.periodEnd, card.periodLimit)
    );
  }
}
