import { describe, expect, it } from "vitest";
import {
  FIRST_HOUR,
  LAST_HOUR,
  MINUTE_STEPS,
  addDays,
  addMonths,
  daysInMonth,
  formatDate,
  isMinuteAllowed,
  joinTime,
  longDateLabel,
  monthGrid,
  parseDateInput,
  parseIso,
  parseTimeInput,
  splitTime,
  todayIso,
  toIso,
} from "@/components/appointment/dateTime";

// Pure helpers behind the hand-written date and time pickers on /contact. AC-1 of the picker task.

describe("AC-1 parseDateInput: accepted formats", () => {
  const ok: [string, string][] = [
    ["Dec 3, 2026", "2026-12-03"],
    ["December 3, 2026", "2026-12-03"],
    ["2026-12-03", "2026-12-03"],
    ["2026-2-3", "2026-02-03"],
    ["Dec 03, 2026", "2026-12-03"],
    ["dec 3 2026", "2026-12-03"],
    ["DEC 3, 2026", "2026-12-03"],
    ["dEcEmBeR 3, 2026", "2026-12-03"],
    ["Dec. 3, 2026", "2026-12-03"],
    ["Sept 9, 2026", "2026-09-09"],
    ["Sep 9, 2026", "2026-09-09"],
    ["  Dec 3, 2026  ", "2026-12-03"],
    ["Dec   3,   2026", "2026-12-03"],
    ["Jan 1, 2026", "2026-01-01"],
    ["Dec 31, 2026", "2026-12-31"],
    ["Feb 29, 2028", "2028-02-29"],
    ["2028-02-29", "2028-02-29"],
    ["2000-02-29", "2000-02-29"],
    ["Feb 28, 2027", "2027-02-28"],
  ];
  for (const [text, iso] of ok) {
    it(`${JSON.stringify(text)} -> ${iso}`, () => {
      expect(parseDateInput(text)).toBe(iso);
    });
  }
});

describe("AC-1 parseDateInput: rejected input returns null", () => {
  const bad: [string, string][] = [
    ["empty", ""],
    ["spaces only", "   "],
    ["junk", "abc"],
    ["junk with digits", "hello 3, 2026"],
    ["Feb 30", "Feb 30, 2026"],
    ["Feb 29 in a non-leap year", "Feb 29, 2027"],
    ["Feb 29 in 1900 (century, not leap)", "Feb 29, 1900"],
    ["Feb 29 ISO in a non-leap year", "2027-02-29"],
    ["Apr 31", "Apr 31, 2026"],
    ["ISO month 13", "2026-13-01"],
    ["ISO month 00", "2026-00-10"],
    ["ISO day 00", "2026-12-00"],
    ["ISO day 32", "2026-12-32"],
    ["named day 0", "Dec 0, 2026"],
    ["named day 32", "Dec 32, 2026"],
    ["month name that does not exist", "Foo 3, 2026"],
    ["month 13 spelled as a number", "13 3, 2026"],
    ["two letter month", "De 3, 2026"],
    ["month name with extra letters", "Decemberx 3, 2026"],
    ["missing year", "Dec 3"],
    ["two-digit year", "Dec 3, 26"],
    ["five-digit year", "Dec 3, 20260"],
    ["year below range", "Jan 1, 0999"],
    ["ISO year below range", "0999-01-01"],
    ["day-first order", "3 Dec 2026"],
    ["slashes", "12/03/2026"],
    ["trailing junk", "Dec 3, 2026 abc"],
    ["negative", "-2026-12-03"],
    ["dot separated ISO", "2026.12.03"],
    ["ISO with time", "2026-12-03T10:30"],
  ];
  for (const [label, text] of bad) {
    it(`${label}: ${JSON.stringify(text)}`, () => {
      expect(parseDateInput(text)).toBeNull();
    });
  }
});

describe("AC-1 formatDate", () => {
  it("formats as Mon D, YYYY with no leading zero", () => {
    expect(formatDate("2026-12-03")).toBe("Dec 3, 2026");
    expect(formatDate("2026-06-15")).toBe("Jun 15, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-09-30")).toBe("Sep 30, 2026");
  });
  it("covers every month name", () => {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    names.forEach((n, i) => {
      expect(formatDate(`2027-${String(i + 1).padStart(2, "0")}-10`)).toBe(`${n} 10, 2027`);
    });
  });
  it("returns an empty string for anything that is not a real ISO date", () => {
    for (const bad of ["", "abc", "2026-02-30", "2026-13-01", "2026-12-3", "Dec 3, 2026", "2026-12-03 "]) {
      expect(formatDate(bad), JSON.stringify(bad)).toBe("");
    }
  });
  it("round-trips with parseDateInput (every day of 2028, a leap year)", () => {
    let iso = "2028-01-01";
    for (let i = 0; i < 366; i += 1) {
      expect(parseDateInput(formatDate(iso)), iso).toBe(iso);
      iso = addDays(iso, 1);
    }
    expect(iso).toBe("2029-01-01");
  });
});

describe("AC-1 parseIso, toIso, longDateLabel", () => {
  it("parseIso accepts only zero-padded real dates", () => {
    expect(parseIso("2026-12-03")).toEqual({ y: 2026, m: 12, d: 3 });
    expect(parseIso("2026-2-3")).toBeNull();
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("")).toBeNull();
  });
  it("toIso pads", () => {
    expect(toIso({ y: 2026, m: 1, d: 5 })).toBe("2026-01-05");
  });
  it("longDateLabel names the weekday and month in English", () => {
    expect(longDateLabel("2026-12-03")).toBe("Thursday, December 3, 2026");
    expect(longDateLabel("2028-02-29")).toBe("Tuesday, February 29, 2028");
    expect(longDateLabel("2026-01-01")).toBe("Thursday, January 1, 2026");
    expect(longDateLabel("nope")).toBe("");
  });
});

describe("AC-1 daysInMonth", () => {
  it("handles 28/29/30/31 and the century rules", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("AC-1 monthGrid", () => {
  it("is always 42 days (6 weeks), consecutive, for every month of 2026-2028", () => {
    for (const y of [2026, 2027, 2028]) {
      for (let m = 1; m <= 12; m += 1) {
        const grid = monthGrid(y, m);
        expect(grid, `${y}-${m}`).toHaveLength(42);
        for (let i = 1; i < 42; i += 1) expect(grid[i].iso, `${y}-${m} #${i}`).toBe(addDays(grid[i - 1].iso, 1));
        // Sunday first: the first cell is a Sunday.
        expect(longDateLabel(grid[0].iso).startsWith("Sunday"), `${y}-${m} starts on Sunday`).toBe(true);
        expect(grid.filter((d) => d.inMonth)).toHaveLength(daysInMonth(y, m));
      }
    }
  });

  it("December 2026 starts on Tuesday: two leading November days (Sun 29, Mon 30) and 9 trailing January days", () => {
    const grid = monthGrid(2026, 12);
    expect(grid[0].iso).toBe("2026-11-29");
    expect(grid[1].iso).toBe("2026-11-30");
    expect(grid[0].inMonth).toBe(false);
    expect(grid[1].inMonth).toBe(false);
    expect(grid[2].iso).toBe("2026-12-01");
    expect(grid[2].inMonth).toBe(true);
    expect(grid[32].iso).toBe("2026-12-31");
    expect(grid[32].inMonth).toBe(true);
    expect(grid[33].iso).toBe("2027-01-01");
    expect(grid[33].inMonth).toBe(false);
    expect(grid[41].iso).toBe("2027-01-09");
  });

  it("a month that starts on Sunday has no leading days (Feb 2026 starts on Sunday)", () => {
    const grid = monthGrid(2026, 2);
    expect(grid[0].iso).toBe("2026-02-01");
    expect(grid[0].inMonth).toBe(true);
    expect(grid[27].iso).toBe("2026-02-28");
    expect(grid[27].inMonth).toBe(true);
    expect(grid[28].iso).toBe("2026-03-01");
    expect(grid[28].inMonth).toBe(false);
  });

  it("February in a leap year has 29 in-month days and includes Feb 29", () => {
    const grid = monthGrid(2028, 2);
    const inMonth = grid.filter((d) => d.inMonth).map((d) => d.d);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28]).toBe(29);
    expect(grid.find((d) => d.iso === "2028-02-29")?.inMonth).toBe(true);
    // Feb 2027 has no 29th.
    expect(monthGrid(2027, 2).some((d) => d.inMonth && d.d === 29)).toBe(false);
  });

  it("crosses a year boundary at the start (January 2027 begins in December 2026)", () => {
    const grid = monthGrid(2027, 1);
    expect(grid[0].iso).toBe("2026-12-27");
    expect(grid[0].inMonth).toBe(false);
    expect(grid[5].iso).toBe("2027-01-01");
    expect(grid[5].inMonth).toBe(true);
  });

  it("each cell carries parts that match its iso", () => {
    for (const cell of monthGrid(2026, 12)) expect(toIso(cell)).toBe(cell.iso);
  });
});

describe("AC-1 addDays", () => {
  it("moves across month and year boundaries both ways", () => {
    expect(addDays("2026-12-03", 1)).toBe("2026-12-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-12-03", 7)).toBe("2026-12-10");
    expect(addDays("2026-12-03", -7)).toBe("2026-11-26");
    expect(addDays("2026-12-03", 0)).toBe("2026-12-03");
  });
  it("returns the input unchanged when it is not a valid ISO date", () => {
    expect(addDays("junk", 1)).toBe("junk");
    expect(addDays("", 1)).toBe("");
  });
});

describe("AC-1 addMonths: day clamps to the end of a shorter month", () => {
  it("Jan 31 + 1 = Feb 28 (non-leap) / Feb 29 (leap)", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });
  it("Mar 31 - 1 = Feb 28; Oct 31 + 1 = Nov 30; Aug 31 - 2 = Jun 30", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-10-31", 1)).toBe("2026-11-30");
    expect(addMonths("2026-08-31", -2)).toBe("2026-06-30");
  });
  it("keeps the day when it fits, and crosses years", () => {
    expect(addMonths("2026-12-03", 1)).toBe("2027-01-03");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-12-03", 0)).toBe("2026-12-03");
    expect(addMonths("2026-12-03", 12)).toBe("2027-12-03");
    expect(addMonths("2026-12-03", -13)).toBe("2025-11-03");
  });
  it("Feb 29 + 12 months = Feb 28 of a non-leap year", () => {
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2028-02-29", 48)).toBe("2032-02-29");
  });
  it("returns the input unchanged when it is not a valid ISO date", () => {
    expect(addMonths("junk", 1)).toBe("junk");
  });
});

describe("AC-1 todayIso", () => {
  it("builds the ISO date from the local clock parts (no UTC shift)", () => {
    expect(todayIso(new Date(2026, 11, 3, 23, 59, 59))).toBe("2026-12-03");
    expect(todayIso(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
  });
});

describe("AC-1 parseTimeInput", () => {
  const ok: [string, string][] = [
    ["9:30", "09:30"],
    ["09:30", "09:30"],
    ["10:30", "10:30"],
    ["0:00", "00:00"],
    ["00:00", "00:00"],
    ["23:59", "23:59"],
    ["17:00", "17:00"],
    ["  9:05  ", "09:05"],
  ];
  for (const [text, out] of ok) {
    it(`${JSON.stringify(text)} -> ${out}`, () => {
      expect(parseTimeInput(text)).toBe(out);
    });
  }
  const bad: [string, string][] = [
    ["empty", ""],
    ["spaces", "  "],
    ["letters", "abc"],
    ["hour 24", "24:00"],
    ["minute 60", "10:60"],
    ["minute 99", "10:99"],
    ["hour 25", "25:00"],
    ["one-digit minute", "10:5"],
    ["no colon", "1030"],
    ["dot separator", "10.30"],
    ["am/pm suffix", "10:30 am"],
    ["seconds", "10:30:00"],
    ["negative", "-1:30"],
    ["three-digit hour", "100:30"],
    ["hour only", "10"],
    ["trailing colon", "10:"],
  ];
  for (const [label, text] of bad) {
    it(`${label}: ${JSON.stringify(text)} -> null`, () => {
      expect(parseTimeInput(text)).toBeNull();
    });
  }
});

describe("AC-1 splitTime and joinTime", () => {
  it("splits HH:MM only", () => {
    expect(splitTime("10:30")).toEqual({ hour: 10, minute: 30 });
    expect(splitTime("09:00")).toEqual({ hour: 9, minute: 0 });
    expect(splitTime("9:30")).toBeNull();
    expect(splitTime("")).toBeNull();
    expect(splitTime("10:30 ")).toBeNull();
  });
  it("joins with zero padding and round-trips", () => {
    expect(joinTime(9, 0)).toBe("09:00");
    expect(joinTime(17, 45)).toBe("17:45");
    expect(splitTime(joinTime(13, 15))).toEqual({ hour: 13, minute: 15 });
  });
});

describe("AC-1 isMinuteAllowed: at the closing hour only :00", () => {
  it("hour 17 allows only minute 0", () => {
    expect(isMinuteAllowed(17, 0)).toBe(true);
    expect(isMinuteAllowed(17, 15)).toBe(false);
    expect(isMinuteAllowed(17, 30)).toBe(false);
    expect(isMinuteAllowed(17, 45)).toBe(false);
  });
  it("every step is allowed for the hours before 17 (boundary 16)", () => {
    for (let h = FIRST_HOUR; h < LAST_HOUR; h += 1) for (const m of MINUTE_STEPS) expect(isMinuteAllowed(h, m), `${h}:${m}`).toBe(true);
  });
  it("hours outside the grid (0-8 and 18-23) allow every minute: only the closing hour restricts", () => {
    const hours = [...Array(9).keys(), ...Array.from({ length: 6 }, (_, i) => 18 + i)];
    expect(hours).toHaveLength(15);
    for (const h of hours) for (const m of MINUTE_STEPS) expect(isMinuteAllowed(h, m), `${h}:${m}`).toBe(true);
    expect(isMinuteAllowed(8, 45)).toBe(true);
    expect(isMinuteAllowed(18, 15)).toBe(true);
  });
  it("constants match the clinic hours 9:00 to 17:00 and 15-minute steps", () => {
    expect(FIRST_HOUR).toBe(9);
    expect(LAST_HOUR).toBe(17);
    expect([...MINUTE_STEPS]).toEqual([0, 15, 30, 45]);
  });
});
