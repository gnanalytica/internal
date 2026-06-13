export type CalendarDay = {
  /** yyyy-mm-dd key (local-free, UTC-based) */
  key: string;
  day: number;
  inMonth: boolean;
};

/** Zero-padded yyyy-mm-dd for a Date (UTC). */
export function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * A 6-row × 7-col month matrix (Sunday-first) covering `year`/`month`
 * (month is 0-based), padded with leading/trailing days from adjacent months.
 */
export function monthMatrix(year: number, month: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const startDow = first.getUTCDay(); // 0 = Sunday
  const gridStart = new Date(Date.UTC(year, month, 1 - startDow));

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        key: ymd(cursor),
        day: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === month,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
