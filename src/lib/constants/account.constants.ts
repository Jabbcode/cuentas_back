export const ACCOUNT_TYPES = {
  CASH: 'cash',
  BANK: 'bank',
  CREDIT_CARD: 'credit_card',
} as const;

export const ACCOUNT_TYPE_VALUES = [
  ACCOUNT_TYPES.CASH,
  ACCOUNT_TYPES.BANK,
  ACCOUNT_TYPES.CREDIT_CARD,
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export const ACCOUNT_MESSAGES = {
  SAME_ORIGIN_DESTINATION: 'Las cuentas de origen y destino deben ser diferentes',
  ORIGIN_NOT_FOUND: 'Cuenta origen no encontrada',
  DESTINATION_NOT_FOUND: 'Cuenta destino no encontrada',
  INSUFFICIENT_BALANCE_ORIGIN: 'Saldo insuficiente en la cuenta origen',
} as const;
