export function calculateNextDueDate(
  frequency: string,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  fromDate: Date = new Date()
): Date {
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);

  if (frequency === 'monthly') {
    const targetDay = dayOfMonth || 1;
    nextDate.setDate(targetDay);

    if (nextDate <= today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(targetDay);
    }
  } else if (frequency === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + 14);
  } else if (frequency === 'weekly') {
    const currentDay = nextDate.getDay();
    const targetDay = dayOfWeek || 0;
    const daysUntilNext = (targetDay - currentDay + 7) % 7 || 7;
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
  }

  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}
