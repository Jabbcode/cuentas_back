export const DEBT_STATUS = {
  ACTIVE: 'active',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

export const DEBT_STATUS_VALUES = [
  DEBT_STATUS.ACTIVE,
  DEBT_STATUS.PAID,
  DEBT_STATUS.OVERDUE,
] as const;

export type DebtStatus = (typeof DEBT_STATUS)[keyof typeof DEBT_STATUS];

export const INTEREST_TYPE = {
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
} as const;

export const INTEREST_TYPE_VALUES = [INTEREST_TYPE.FIXED, INTEREST_TYPE.PERCENTAGE] as const;

export type InterestType = (typeof INTEREST_TYPE)[keyof typeof INTEREST_TYPE];

export const DEBT_MESSAGES = {
  NOT_FOUND: 'Deuda no encontrada',
  ALREADY_PAID: 'Esta deuda ya está pagada',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente en la cuenta',
  DELETED: 'Deuda eliminada correctamente',
} as const;
