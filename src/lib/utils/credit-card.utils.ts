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

/**
 * Corte de un mes dado, clameando el día (29/30/31) al último día real de
 * ese mes cuando no existe (p. ej. cutoffDay=31 en febrero -> 28/29).
 * Compartido por `buildClosedPeriodBounds` y `getPeriodBoundsForDate` para
 * que ambos calculen "dónde cae un corte" de una única forma y no puedan
 * divergir.
 */
function clampCutoffDate(year: number, month: number, cutoffDay: number): Date {
  const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(cutoffDay, daysInTargetMonth);
  return new Date(year, month, day);
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
 * Formatea una fecha como YYYY-MM-DD usando sus componentes LOCALES (no UTC).
 *
 * Existe porque `Date` siempre se serializa a JSON como ISO en UTC
 * (`toISOString()`), lo que puede desplazar el día calendario un día hacia
 * atrás si el servidor corre en un huso horario adelantado a UTC (p. ej.
 * Europe/Madrid). Un campo `Date` normal no sirve como clave estable para
 * que el cliente la reenvíe sin ambigüedad — este helper sí, porque nunca
 * pasa por una conversión UTC.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const periods: { startDate: Date; endDate: Date }[] = [];
  for (let k = monthsBack; k >= 1; k--) {
    const startDate = clampCutoffDate(year, month - k, cutoffDay);
    const endDate = clampCutoffDate(year, month - (k - 1), cutoffDay);
    endDate.setDate(endDate.getDate() - 1);
    periods.push({ startDate, endDate });
  }

  return periods;
}

/**
 * Período (rango [startDate, endDate]) al que pertenece `date` según el día
 * de corte de la tarjeta. Mismo criterio que `getCutoffDates` (si el día del
 * mes es >= cutoffDay, el corte de este mes ya pasó) pero generalizado a
 * cualquier fecha en vez de "hoy", y compartiendo el clamp de días 29/30/31
 * con `buildClosedPeriodBounds`.
 */
export function getPeriodBoundsForDate(
  cutoffDay: number,
  date: Date
): { startDate: Date; endDate: Date } {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  let startDate: Date;
  let nextCutoff: Date;

  if (day >= cutoffDay) {
    startDate = clampCutoffDate(year, month, cutoffDay);
    nextCutoff = clampCutoffDate(year, month + 1, cutoffDay);
  } else {
    startDate = clampCutoffDate(year, month - 1, cutoffDay);
    nextCutoff = clampCutoffDate(year, month, cutoffDay);
  }

  const endDate = new Date(nextCutoff);
  endDate.setDate(endDate.getDate() - 1);

  return { startDate, endDate };
}

/**
 * Busca, entre `payments`, uno cuyo `periodStart`/`periodEnd` coincida
 * exactamente con los bounds locales `startDate`/`endDate` (normalizados a
 * UTC-medianoche antes de comparar, igual que se guardan en BD). Única
 * definición de "este período está pagado" en el proyecto — la comparten
 * `buildStatement` (pantalla de tarjeta) y la validación de período pagado
 * en `transactions.service.ts`, para que no puedan divergir.
 */
export function findPaymentForPeriod<T extends { periodStart: Date; periodEnd: Date }>(
  payments: T[],
  startDate: Date,
  endDate: Date
): T | null {
  const startUTC = normalizeToUTC(startDate);
  const endUTC = normalizeToUTC(endDate);
  return (
    payments.find(
      (p) =>
        p.periodStart.getTime() === startUTC.getTime() && p.periodEnd.getTime() === endUTC.getTime()
    ) ?? null
  );
}
