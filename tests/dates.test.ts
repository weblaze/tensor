import { describe, expect, it } from "vitest";
import { addDays, diffDays, fmtDate, fmtDue, fmtShort, istDate, projectDay } from "@/lib/dates";

describe("dates", () => {
  it("adds and diffs calendar days across months and years", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-11-02", "2026-10-30")).toBe(3);
  });

  it("counts project days from 1", () => {
    expect(projectDay("2026-10-11", "2026-10-11")).toBe(1);
    expect(projectDay("2026-10-11", "2026-10-30")).toBe(20);
  });

  it("formats dates the way the design system asks", () => {
    expect(fmtDate("2026-09-09")).toBe("9 Sep 2026");
    expect(fmtShort("2026-10-30")).toBe("30 Oct");
  });

  it("describes due dates in words", () => {
    expect(fmtDue("2026-10-31", "2026-10-30")).toBe("tomorrow");
    expect(fmtDue("2026-11-02", "2026-10-30")).toBe("in 3 days");
    expect(fmtDue("2026-10-21", "2026-10-30")).toBe("9 days ago");
  });

  it("uses India time for the calendar date", () => {
    // 20:00 UTC on 29 Oct is 01:30 on 30 Oct in India.
    expect(istDate("2026-10-29T20:00:00Z")).toBe("2026-10-30");
  });
});
