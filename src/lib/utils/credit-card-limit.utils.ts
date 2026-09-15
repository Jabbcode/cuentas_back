import { ConflictError, ValidationError } from '../errors.js';

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

export interface CreditCardBalanceInfo {
  type: string;
  creditLimit: number | null;
  balance: number;
  initialBalance: number;
}

/**
 * Bloquea un gasto sobre tarjeta de crédito que dejaría el uso resultante por
 * encima del límite. `amount` es el monto del gasto que se aplicaría (decrementa
 * `balance`); `resultingType` es el tipo de movimiento tras la operación.
 * No valida cuentas que no sean tarjeta ni movimientos que no sean gasto.
 */
export function assertCreditCardLimit(
  account: CreditCardBalanceInfo,
  amount: number,
  resultingType: string
): void {
  if (account.type !== 'credit_card' || resultingType !== 'expense') {
    return;
  }

  if (account.creditLimit == null) {
    throw new ValidationError('La tarjeta no tiene configurado un límite de crédito');
  }

  const resultingBalance = account.balance - amount;
  const resultingUsage = account.initialBalance - resultingBalance;

  if (resultingUsage > account.creditLimit) {
    throw new ConflictError('Se superó el límite disponible de la tarjeta');
  }
}
