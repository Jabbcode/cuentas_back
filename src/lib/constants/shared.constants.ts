export const TRANSACTION_TYPE = {
  EXPENSE: 'expense',
  INCOME: 'income',
} as const;

export const TRANSACTION_TYPE_VALUES = [TRANSACTION_TYPE.EXPENSE, TRANSACTION_TYPE.INCOME] as const;

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export const SHARED_MESSAGES = {
  ACCOUNT_NOT_FOUND: 'Cuenta no encontrada',
} as const;
