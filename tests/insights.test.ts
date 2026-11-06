import { describe, expect, it } from "vitest";
import { progressOf } from "@/lib/insights";

describe("progressOf", () => {
  const project = { start_date: "2026-10-11", planned_days: 45 };

  it("is on plan when no unfinished task is past its end", () => {
    const p = progressOf(project, [{ status: "done", planned_end: "2026-10-20" }, { status: "doing", planned_end: "2026-11-01" }], "2026-10-30");
    expect(p.day).toBe(20);
    expect(p.slip).toBe(0);
    expect(p.handoverPlanned).toBe("2026-11-24");
  });

  it("slips by the longest overrun of an unfinished task", () => {
    const p = progressOf(project, [{ status: "doing", planned_end: "2026-10-27" }, { status: "todo", planned_end: "2026-10-29" }], "2026-10-30");
    expect(p.slip).toBe(3);
    expect(p.handoverProjected).toBe("2026-11-27");
  });
});
