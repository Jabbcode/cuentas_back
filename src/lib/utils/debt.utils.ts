export function calculateInterest(
  remainingAmount: number,
  interestRate: number,
  interestType: string
): number {
  if (interestType === 'percentage') {
    return (remainingAmount * interestRate) / 100;
  } else if (interestType === 'fixed') {
    return interestRate;
  }
  return 0;
}

export function getDebtStatus(remainingAmount: number, dueDate: Date | null): string {
  if (remainingAmount <= 0) {
    return 'paid';
  }
  if (dueDate && new Date() > dueDate) {
    return 'overdue';
  }
  return 'active';
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
