const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD in the device time zone. */
export function toLocalDate(input: Date | string = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(): string {
  return toLocalDate(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse a local date (YYYY-MM-DD) at local midnight. */
export function parseLocalDate(localDate: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(localDate: string, days: number): string {
  const d = parseLocalDate(localDate);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday-based start of week. */
export function startOfWeek(localDate: string): string {
  const d = parseLocalDate(localDate);
  const shift = (d.getDay() + 6) % 7;
  return addDays(localDate, -shift);
}

/** Value for <input type="datetime-local"> from an ISO string. */
export function toDateTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeInput(value: string): string {
  return new Date(value).toISOString();
}

/** Combine a local date with the current clock time (used when logging into a past day). */
export function isoForLocalDate(localDate: string): string {
  if (localDate === todayLocal()) return nowIso();
  const d = parseLocalDate(localDate);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDayLong(localDate: string): string {
  return dayFmt.format(parseLocalDate(localDate));
}

export function formatDayShort(localDate: string): string {
  return shortFmt.format(parseLocalDate(localDate));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return fullFmt.format(new Date(iso));
}

export function relativeDayLabel(localDate: string): string {
  const today = todayLocal();
  if (localDate === today) return "Hari ini";
  if (localDate === addDays(today, -1)) return "Kemarin";
  if (localDate === addDays(today, 1)) return "Besok";
  return formatDayLong(localDate);
}

export const WEEKDAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
