export function getCutoffDates(cutoffDay: number): { lastCutoff: Date; nextCutoff: Date } {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let lastCutoff: Date;
  let nextCutoff: Date;

  if (currentDay >= cutoffDay) {
    lastCutoff = new Date(currentYear, currentMonth, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth + 1, cutoffDay);
  } else {
    lastCutoff = new Date(currentYear, currentMonth - 1, cutoffDay);
    nextCutoff = new Date(currentYear, currentMonth, cutoffDay);
  }

  return { lastCutoff, nextCutoff };
}

export function getPaymentDueDate(cutoffDate: Date, paymentDueDay: number): Date {
  const cutoffMonth = cutoffDate.getMonth();
  const cutoffYear = cutoffDate.getFullYear();

  if (paymentDueDay > cutoffDate.getDate()) {
    return new Date(cutoffYear, cutoffMonth, paymentDueDay);
  } else {
    return new Date(cutoffYear, cutoffMonth + 1, paymentDueDay);
  }
}

export function getDaysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function normalizeToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}
