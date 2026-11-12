import { describe, it, expect } from "vitest";
import { getMonthGrid, toDateKey, monthLabel, isFutureDate, addDays } from "./calendar-dates";

describe("toDateKey", () => {
  it("pads month and day to two digits", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("adds days and rolls over month boundaries", () => {
    const result = addDays(new Date(2026, 0, 30), 3);
    expect(toDateKey(result)).toBe("2026-02-02");
  });
});

describe("getMonthGrid", () => {
  it("starts on a Monday and ends on a Sunday", () => {
    const grid = getMonthGrid(2026, 2); // March 2026
    expect(grid.gridStart.getDay()).toBe(1); // Monday
    const lastDay = grid.days[grid.days.length - 1];
    expect(lastDay.getDay()).toBe(0); // Sunday
  });

  it("includes every day of the month", () => {
    const grid = getMonthGrid(2026, 1); // February 2026 (28 days, not a leap year)
    const daysInMonth = grid.days.filter((d) => d.getMonth() === 1);
    expect(daysInMonth).toHaveLength(28);
  });

  it("produces full weeks (a multiple of 7 days)", () => {
    const grid = getMonthGrid(2026, 5);
    expect(grid.days.length % 7).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formats a German month name with the year", () => {
    expect(monthLabel(2026, 0)).toBe("Januar 2026");
    expect(monthLabel(2026, 11)).toBe("Dezember 2026");
  });
});

describe("isFutureDate", () => {
  it("is true for a date far in the future", () => {
    expect(isFutureDate(new Date(Date.now() + 1000 * 60 * 60 * 24))).toBe(true);
  });

  it("is false for a date in the past", () => {
    expect(isFutureDate(new Date(Date.now() - 1000 * 60 * 60 * 24))).toBe(false);
  });
});
