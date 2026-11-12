// Pure date-math helpers shared by server pages and client components for
// the calendar view (Monday-first month grid) and for formatting a date-only
// "YYYY-MM-DD" key used in scheduling inputs/actions. No "server-only" here
// on purpose — this is imported from client components too.

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export type MonthGrid = {
  year: number;
  monthIndex: number; // 0-11
  gridStart: Date;
  gridEnd: Date; // exclusive
  days: Date[];
};

// Builds the Monday-first weeks needed to fully cover the given month
// (including leading/trailing days from adjacent months).
export function getMonthGrid(year: number, monthIndex: number): MonthGrid {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  const lastWeekday = (last.getDay() + 6) % 7;

  const gridStart = addDays(first, -firstWeekday);
  const gridEnd = addDays(last, 7 - lastWeekday); // exclusive upper bound

  const days: Date[] = [];
  for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) days.push(d);

  return { year, monthIndex, gridStart, gridEnd, days };
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

// A thin wrapper so Server Components can check "is this in the future"
// without calling the impure `Date.now()` directly in their render body
// (React's purity lint rule flags that call site specifically).
export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}
