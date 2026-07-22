import { INTEREST_TYPE, DEBT_STATUS, type DebtStatus } from '../constants/debt.constants.js';

export function calculateInterest(
  remainingAmount: number,
  interestRate: number,
  interestType: string
): number {
  if (interestType === INTEREST_TYPE.PERCENTAGE) {
    return (remainingAmount * interestRate) / 100;
  } else if (interestType === INTEREST_TYPE.FIXED) {
    return interestRate;
  }
  return 0;
}

export function getDebtStatus(remainingAmount: number, dueDate: Date | null): DebtStatus {
  if (remainingAmount <= 0) {
    return DEBT_STATUS.PAID;
  }
  if (dueDate && new Date() > dueDate) {
    return DEBT_STATUS.OVERDUE;
  }
  return DEBT_STATUS.ACTIVE;
}

export function calculateDebtPaymentBreakdown(
  remainingAmount: number,
  paymentAmount: number,
  interestRate: number | null,
  interestType: string | null
): { principal: number; interest: number; newRemainingAmount: number } {
  let interest = 0;
  if (interestRate && interestType) {
    interest = calculateInterest(remainingAmount, interestRate, interestType);
  }

  if (paymentAmount < interest) {
    interest = paymentAmount;
  }

  const principal = Math.min(paymentAmount - interest, remainingAmount);
  const newRemainingAmount = remainingAmount - principal;

  return { principal, interest, newRemainingAmount };
}
