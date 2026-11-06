import { describe, expect, it } from "vitest";
import { classifyFallback, cleanNote, guessTrade } from "@/lib/ai/fallback";

const tasks = [
  { id: "t1", title: "MGPS pressure test", phase: "Services", trade: "MGPS", status: "todo" },
  { id: "t3", title: "Epoxy flooring, OT and lab", phase: "Finishes", trade: "Flooring", status: "todo" },
];
const materials = [
  { id: "m1", item: "Glass partition panels", trade: "Glazing", status: "ordered" },
  { id: "m3", item: "AHU unit", trade: "HVAC", status: "ordered" },
];
const run = (text: string) => classifyFallback({ text, kind: "text", tasks, materials, examples: [] });

describe("keyword classifier", () => {
  it("routes broken deliveries to procurement and the head, never the doctor", () => {
    const c = run("glass panels received but 2 broken, please reorder");
    expect(c.is_issue).toBe(true);
    expect(c.trade).toBe("Glazing");
    expect(c.routes.sort()).toEqual(["head", "procurement"]);
    expect(c.action).toMatchObject({ type: "material_status", material_id: "m1", status: "issue" });
  });

  it("sends labour problems to the head only", () => {
    const c = run("aaj labour kam hai, 3 aadmi nahi aaye");
    expect(c.routes).toEqual(["head"]);
    expect(c.note).toBe("Today labour short, 3 men absent");
  });

  it("marks a delivered material received and tells the doctor", () => {
    const c = run("AHU unit aa gaya site pe");
    expect(c.note).toBe("AHU unit received on site");
    expect(c.action).toMatchObject({ type: "material_status", material_id: "m3", status: "received" });
    expect(c.routes).toEqual(["doctor"]);
  });

  it("does not close a whole task on a partial step", () => {
    expect(run("epoxy base coat ho gaya OT mein").action).toBeNull();
  });

  it("treats floor levels as places, not flooring work", () => {
    expect(guessTrade("painting lagaani hai first floor pe")).toBe("Civil");
    expect(guessTrade("ground floor tiles laga diya")).toBe("Flooring");
  });

  it("gives an empty photo a neutral note and no routes", () => {
    const c = classifyFallback({ text: "", kind: "photo", tasks, materials, examples: [] });
    expect(c.note).toBe("Photo from site");
    expect(c.routes).toEqual([]);
  });

  it("cleans notes", () => {
    expect(cleanNote("  phase 1 complete.  ")).toBe("Phase 1 complete");
  });
});
