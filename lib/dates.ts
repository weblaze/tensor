// Dates are plain "YYYY-MM-DD" strings in India time (Asia/Kolkata). Timestamps are ISO strings.
export const TZ = "Asia/Kolkata";
const DAY = 86_400_000;

function parse(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar date in India for a timestamp (default now). */
export function istDate(at: string | Date = new Date()): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function today(): string {
  return istDate();
}

/** Hour of day in India, 0-23. */
export function istHour(at: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(at)) % 24;
}

export function addDays(date: string, n: number): string {
  return iso(parse(date) + n * DAY);
}

/** a − b in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(a) - parse(b)) / DAY);
}

export function isValidDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Sep 2026" */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "9 Sep" */
export function fmtShort(date: string | null | undefined): string {
  if (!date) return "";
  const [, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "5:37 PM" in India time. */
export function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ts));
}

/** "Today", "Yesterday", or "9 Sep". */
export function fmtRelDay(date: string, ref: string = today()): string {
  const d = diffDays(ref, date);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d === -1) return "Tomorrow";
  return fmtShort(date);
}

/** "Today 5:37 PM", "Yesterday 4:10 PM", "9 Sep 11:00 AM" */
export function fmtWhen(ts: string | null | undefined): string {
  if (!ts) return "";
  return `${fmtRelDay(istDate(ts))} ${fmtTime(ts)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${Math.abs(n) === 1 ? one : many}`;
}

/** Days until a date from today: "today", "tomorrow", "in 3 days", "1 day ago". */
export function fmtDue(date: string, ref: string = today()): string {
  const d = diffDays(date, ref);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${plural(d, "day")}` : `${plural(-d, "day")} ago`;
}

/** Day number of a project (start date is Day 1). */
export function projectDay(start: string, ref: string = today()): number {
  return diffDays(ref, start) + 1;
}
