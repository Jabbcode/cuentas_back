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

/**
 * Devuelve `monthsBack` períodos de un mes cada uno, terminando en `lastCutoff`,
 * ordenados ascendente (más atrasado primero). El último elemento es el período
 * cerrado más reciente (equivalente al `closedPeriod` de hoy).
 *
 * Cada corte se calcula de forma independiente respecto a `lastCutoff` (no
 * encadenando `setMonth`), clameando el día al último día de ese mes cuando
 * el día de corte (29/30/31) no existe — evita el desborde de mes a mes que
 * arrastraba `previousCutoff.setMonth(previousCutoff.getMonth() - 1)`.
 */
export function buildClosedPeriodBounds(
  lastCutoff: Date,
  monthsBack: number
): { startDate: Date; endDate: Date }[] {
  const cutoffDay = lastCutoff.getDate();
  const year = lastCutoff.getFullYear();
  const month = lastCutoff.getMonth();

  const cutoffAt = (offset: number): Date => {
    const daysInTargetMonth = new Date(year, month - offset + 1, 0).getDate();
    const day = Math.min(cutoffDay, daysInTargetMonth);
    return new Date(year, month - offset, day);
  };

  const periods: { startDate: Date; endDate: Date }[] = [];
  for (let k = monthsBack; k >= 1; k--) {
    const startDate = cutoffAt(k);
    const endDate = cutoffAt(k - 1);
    endDate.setDate(endDate.getDate() - 1);
    periods.push({ startDate, endDate });
  }

  return periods;
}
