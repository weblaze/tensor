// Keyword heuristics: the non-AI path for every AI call. Handles English and common Hinglish.
import type { RouteTarget, SuggestedAction, Zone } from "../types";
import type { ClassifyInput, Classification, PlanSuggestion } from "./index";

const TRADE_WORDS: [string, RegExp][] = [
  ["Glazing", /\b(glass|glazing|shisha|sheesha|kaanch|kanch)\b/],
  ["Flooring", /\b(epoxy|vinyl|floor|flooring|tile|tiles|farsh)\b/],
  ["HVAC", /\b(ahu|duct|ducting|hepa|hvac|ac|air ?handling|chiller|filter|filters)\b/],
  ["MGPS", /\b(mgps|oxygen|o2|copper|gas ?pipe|manifold|nitrous|vacuum)\b/],
  ["Electrical", /\b(electric\w*|wire|wiring|conduit|light|lights|led|switch|panel board|db|bijli|power ?point)\b/],
  ["Panelling", /\b(panel|panels|panelling|hpl|cladding|modular)\b/],
  ["Doors", /\b(door|doors|hermetic|darwaza|darwaja)\b/],
  ["Sanitary", /\b(sanitary|wc|basin|tap|taps|commode|toilet fitting|jaquar|cistern)\b/],
  ["Civil", /\b(gypsum|plaster|wall|ceiling|civil|demolition|debris|brick|cement|labour|labor|mazdoor|marking|survey|paint)\b/],
];

const CRITICAL = /\b(ot|operation theat\w*|lab|embryo\w*|cryo\w*|collection|clean ?room|critical|mgps|ahu|hepa|hermetic|epoxy)\b/;
const GENERAL = /\b(reception|waiting|consult\w*|cabin|toilet|washroom|pantry|lobby|office|vinyl)\b/;
const CRITICAL_TRADES = new Set(["MGPS", "HVAC", "Glazing"]);

const ISSUE = /\b(broken|broke|damage\w*|crack\w*|short|shortage|missing|absent|leak\w*|problem|issue|delay\w*|late|reorder|re-order|wrong|faulty|kharab|toota|tooti|toot|nahi aaye|nahi aaya|nahi mila|kam hai|stuck|stopped|band)\b/;
const RECEIVED = /\b(received|arrived|delivered|delivery|aa gaya|aa gaye|aaya|aaye|pahunch\w*|mil gaya|unloaded)\b/;
const DONE = /\b(complete|completed|done|finished|finish|installed|fixed|ho gaya|ho gaye|pura|poora|khatam|laga diya|lag gaya)\b/;
const STARTED = /\b(started|start|begun|shuru|chalu|in progress|working|chal raha)\b/;
const LABOUR = /\b(labour|labor|mazdoor|workers?|men absent|aadmi)\b/;
const PHASE = /\bphase\s*(\d+|one|two|three|four|five)\b/;

const STOP = new Set(["the", "and", "for", "with", "of", "in", "on", "to", "a", "an", "set", "unit", "kit", "room", "lab", "ot", "installation", "fit-out"]);

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

function stem(w: string): string {
  return w.replace(/(ings|ing|es|s)$/, "");
}

function overlap(text: string, label: string): number {
  const t = new Set(words(text).map(stem));
  const l = words(label).map(stem);
  if (l.length === 0) return 0;
  return l.filter((w) => t.has(w)).length / l.length;
}

export function cleanNote(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 140 ? `${s.slice(0, 137)}…` : s;
}

export function guessTrade(text: string): string | null {
  const t = text.toLowerCase();
  for (const [trade, re] of TRADE_WORDS) if (re.test(t)) return trade;
  return null;
}

export function guessZone(text: string, trade: string | null): Zone | null {
  const t = text.toLowerCase();
  if (CRITICAL.test(t)) return "critical";
  if (GENERAL.test(t)) return "general";
  if (trade && CRITICAL_TRADES.has(trade)) return "critical";
  return trade ? "general" : null;
}

export function classifyFallback(input: ClassifyInput): Classification {
  const text = input.text ?? "";
  const t = text.toLowerCase();

  if (!text.trim()) {
    const note = input.kind === "voice" ? "Voice note (not transcribed)"
      : input.kind === "location" ? "Location shared"
      : input.kind === "video" ? "Video from site" : "Photo from site";
    return { note, trade: null, zone: null, is_issue: false, routes: [], action: null, confidence: 0.3, engine: "keywords" };
  }

  const isIssue = ISSUE.test(t);
  const received = RECEIVED.test(t);
  const done = DONE.test(t);
  const started = STARTED.test(t);

  // Best material and task by word overlap with the message
  let mat: { id: string; item: string; trade: string; score: number } | null = null;
  for (const m of input.materials) {
    const score = overlap(t, m.item);
    if (score > 0 && (!mat || score > mat.score)) mat = { ...m, score };
  }
  let task: { id: string; title: string; phase: string; trade: string; score: number } | null = null;
  for (const k of input.tasks) {
    const score = overlap(t, k.title);
    if (score > 0 && (!task || score > task.score)) task = { ...k, score };
  }

  const trade = guessTrade(t) ?? (mat && mat.score >= 0.5 ? mat.trade : null) ?? task?.trade ?? null;
  const zone = guessZone(t, trade);

  let action: SuggestedAction | null = null;
  const phaseMatch = PHASE.exec(t);
  if (phaseMatch && done) {
    const phases = [...new Set(input.tasks.map((x) => x.phase))];
    const open = phases.find((p) => input.tasks.some((x) => x.phase === p && x.status !== "done")) ?? phases[0];
    if (open) action = { type: "phase_done", phase: open };
  } else if (mat && mat.score >= 0.5 && (received || isIssue)) {
    action = {
      type: "material_status",
      material_id: mat.id,
      status: isIssue ? "issue" : "received",
      ...(isIssue ? { note: cleanNote(text).slice(0, 80) } : {}),
    };
  } else if (task && task.score >= 0.5 && (done || started || isIssue)) {
    action = { type: "task_status", task_id: task.id, status: isIssue ? "blocked" : done ? "done" : "doing" };
  }

  const routes = new Set<RouteTarget>();
  if (isIssue) {
    routes.add("head");
    if (action?.type === "material_status" || /\b(order|reorder|re-order|short|missing|broken|deliver\w*)\b/.test(t)) routes.add("procurement");
    if (LABOUR.test(t)) routes.delete("procurement");
  } else if (done || action?.type === "phase_done" || received) {
    routes.add("doctor");
    if (action?.type === "phase_done") routes.add("head");
  } else if (input.kind === "photo" || input.kind === "video") {
    routes.add("doctor");
  }

  // Learn from the coordinator's recent decisions: if a near-identical message was routed before, follow it.
  let confidence = action ? 0.7 : 0.6;
  const best = input.examples
    .map((ex) => ({ ex, score: overlap(t, ex.text) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.75) {
    routes.clear();
    best.ex.routes.forEach((r) => routes.add(r));
    confidence = Math.max(confidence, 0.75);
  }

  return {
    note: cleanNote(text),
    trade,
    zone,
    is_issue: isIssue,
    routes: [...routes],
    action,
    confidence,
    engine: "keywords",
  };
}

const PLAN_RULES: { re: RegExp; task?: PlanSuggestion["tasks"][number]; material?: PlanSuggestion["materials"][number] }[] = [
  {
    re: /power ?point|extra (socket|point)|ups/i,
    task: { phase: "Services", title: "Extra power points, cryostorage", trade: "Electrical", zone: "critical", start_day: 6, duration_days: 2, why: "Order notes ask for extra power" },
  },
  {
    re: /(existing|old) (ac|a\.c\.|air ?condition\w*)|remove .*ac/i,
    task: { phase: "Site setup", title: "Remove existing AC units", trade: "Civil", zone: "general", start_day: 1, duration_days: 2, why: "Order notes mention existing AC" },
  },
  {
    re: /two collection rooms|2 collection rooms|second collection room/i,
    task: { phase: "Build", title: "Second collection room fit-out", trade: "Panelling", zone: "critical", start_day: 20, duration_days: 4, why: "Order notes ask for two collection rooms" },
  },
  {
    re: /antimicrobial|hpl/i,
    material: { item: "Antimicrobial HPL sheets", trade: "Panelling", qty: 40, unit: "sheets", lead_time_days: 14, need_day: 16, why: "Order notes specify an antimicrobial finish" },
  },
  {
    re: /ups|power backup|generator|dg set/i,
    material: { item: "Online UPS, 10 kVA", trade: "Electrical", qty: 1, unit: "unit", lead_time_days: 10, need_day: 30, why: "Order notes mention power backup" },
  },
  {
    re: /fire ?noc|fire safety|sprinkler/i,
    task: { phase: "Handover", title: "Fire NOC inspection", trade: "Coordination", zone: "general", start_day: 42, duration_days: 1, why: "Order notes mention fire safety" },
  },
  {
    re: /pass ?box|pass-through/i,
    material: { item: "Pass box, SS", trade: "Panelling", qty: 1, unit: "unit", lead_time_days: 15, need_day: 24, why: "Order notes mention a pass box" },
  },
];

export function suggestPlanFallback(input: { notes: string; existingTasks: string[]; existingMaterials: string[] }): PlanSuggestion {
  const haveT = new Set(input.existingTasks.map((s) => s.toLowerCase()));
  const haveM = new Set(input.existingMaterials.map((s) => s.toLowerCase()));
  const out: PlanSuggestion = { tasks: [], materials: [], engine: "keywords" };
  for (const rule of PLAN_RULES) {
    if (!rule.re.test(input.notes)) continue;
    if (rule.task && !haveT.has(rule.task.title.toLowerCase())) out.tasks.push(rule.task);
    if (rule.material && !haveM.has(rule.material.item.toLowerCase())) out.materials.push(rule.material);
  }
  return out;
}
