// Trip dates are stored as plain "YYYY-MM-DD" strings with no time/timezone
// component. `new Date("YYYY-MM-DD")` parses that as UTC midnight, so
// formatting it in any timezone behind UTC rolls it back a day. Parsing the
// parts into a local Date sidesteps that entirely.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function todayDateString(): string {
  return toDateString(new Date());
}

// Whole days from today to the date — negative once it has passed.
export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function dayCountBetween(start: string, end: string): number {
  if (!start || !end) return 1;
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export function formatDateRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) {
    return e.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

// "Today" / "Tomorrow" / "In 12 days" / "12 days ago" — the last case covers
// a planned trip whose date quietly passed without being marked completed,
// since nothing auto-converts a plan to logged.
export function daysUntilLabel(dateStr: string): string {
  const diffDays = daysUntil(dateStr);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
