export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's date when the user had a credited day two days ago but
 * did not plunge or use a freeze yesterday. A longer gap is not prompted
 * because a single freeze cannot repair more than one missed day.
 */
export function getMissedStreakDate(
  plunges: Array<{ createdAt: Date | string }>,
  freezeDates: string[],
  now = new Date(),
): string | null {
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const dayBeforeDate = new Date(now);
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);

  const yesterday = localDateKey(yesterdayDate);
  const dayBeforeYesterday = localDateKey(dayBeforeDate);
  const creditedDates = new Set([
    ...plunges.map((plunge) => localDateKey(new Date(plunge.createdAt))),
    ...freezeDates.filter(Boolean),
  ]);

  if (creditedDates.has(yesterday) || !creditedDates.has(dayBeforeYesterday)) {
    return null;
  }
  return yesterday;
}