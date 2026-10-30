// Quick check of the keyword classifier: node --experimental-strip-types scripts/check-fallback.ts
import { classifyFallback } from "../lib/ai/fallback.ts";

const tasks = [
  { id: "t1", title: "MGPS pressure test", phase: "Services", trade: "MGPS", status: "todo" },
  { id: "t2", title: "Glass partitions, embryology lab", phase: "Build", trade: "Glazing", status: "doing" },
  { id: "t3", title: "Epoxy flooring, OT and lab", phase: "Finishes", trade: "Flooring", status: "todo" },
];
const materials = [
  { id: "m1", item: "Glass partition panels", trade: "Glazing", status: "ordered" },
  { id: "m2", item: "Hermetic doors", trade: "Doors", status: "to_order" },
  { id: "m3", item: "AHU unit", trade: "HVAC", status: "ordered" },
];
const cases = [
  "glass panels received but 2 broken, please reorder",
  "phase 1 complete",
  "aaj labour kam hai, 3 aadmi nahi aaye",
  "AHU unit aa gaya site pe",
  "epoxy base coat ho gaya OT mein, kal second coat",
  "hermetic door delivery nahi aaya, vendor delay",
  "MGPS pressure test done",
  "painting lagaani hai first floor pe",
  "ground floor tiles laga diya",
  "",
];
for (const text of cases) {
  const c = classifyFallback({ text, kind: text ? "text" : "photo", tasks, materials, examples: [] });
  console.log(JSON.stringify(text), "→", c.note, "|", c.trade, c.zone, c.is_issue ? "ISSUE" : "", "| routes:", c.routes.join(","), "| action:", JSON.stringify(c.action));
}
