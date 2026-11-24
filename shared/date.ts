// Calendar-date helpers for a Thailand-based app.
//
// Dates in this app are plain "YYYY-MM-DD" strings in Bangkok time (UTC+7).
// Never build them with `new Date(...).toISOString()`: that converts to UTC, so
// between 00:00 and 07:00 Bangkok "today" comes out as yesterday, and
// `new Date("2026-11-24T00:00:00")` (local midnight) minus a day lands on the
// wrong calendar day when the browser is on Bangkok time. These helpers use
// only Intl for "now" and pure UTC arithmetic on the calendar fields.

const BKK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Bangkok as "YYYY-MM-DD". `now` is injectable for tests. */
export function todayBkk(now: Date = new Date()): string {
  return BKK.format(now);
}

/** Add (or subtract) whole days to a "YYYY-MM-DD" date. No time zone involved. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** First day of the month of a "YYYY-MM-DD" date (default: this month in Bangkok). */
export function firstOfMonthISO(iso: string = todayBkk()): string {
  return `${iso.slice(0, 8)}01`;
}

/** Whole days from `a` to `b` (b - a), both "YYYY-MM-DD". */
export function diffDaysISO(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}
