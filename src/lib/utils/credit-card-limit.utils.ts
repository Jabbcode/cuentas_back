import { ConflictError, ValidationError } from '../errors.js';

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
