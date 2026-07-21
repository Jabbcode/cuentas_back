export const CATEGORY_SYSTEM_KEYS = {
  DEBT_PAYMENT: 'DEBT_PAYMENT',
  CREDIT_CARD_PAYMENT: 'CREDIT_CARD_PAYMENT',
} as const;

export type CategorySystemKey = (typeof CATEGORY_SYSTEM_KEYS)[keyof typeof CATEGORY_SYSTEM_KEYS];

export interface SystemCategoryDefaults {
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
}

export const SYSTEM_CATEGORY_DEFAULTS: Record<CategorySystemKey, SystemCategoryDefaults> = {
  DEBT_PAYMENT: { name: 'Pago de Deuda', type: 'expense', icon: '💳', color: '#EF4444' },
  CREDIT_CARD_PAYMENT: { name: 'Pago de Tarjeta', type: 'expense', icon: '💳', color: '#8B5CF6' },
};
