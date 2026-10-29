// Gemini (free tier) over REST. JSON-schema output, validated before use.
import { TRADES, type RouteTarget, type SuggestedAction, type Zone } from "../types";
import type { ClassifyInput, Classification, PlanSuggestion, Transcript } from "./index";
import { cleanNote } from "./fallback";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function model(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function toBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function generate<T>(parts: Part[], schema: object, system: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(json.error?.message || `Gemini ${res.status}`);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiTranscribe(audio: { bytes: ArrayBuffer; mime: string }): Promise<Transcript> {
  const out = await generate<{ original: string; english: string }>(
    [
      { inline_data: { mime_type: audio.mime === "audio/oga" ? "audio/ogg" : audio.mime, data: toBase64(audio.bytes) } },
      { text: "Transcribe this site voice note." },
    ],
    {
      type: "OBJECT",
      properties: {
        original: { type: "STRING", description: "Verbatim transcript in the spoken language (Hindi in Devanagari or romanised, as spoken)." },
        english: { type: "STRING", description: "One short plain English line saying what happened on site, no full stop." },
      },
      required: ["original", "english"],
    },
    "You transcribe short voice notes from construction site supervisors in India building IVF clinics. They speak Hindi, Hinglish or English. Keep trade words (AHU, MGPS, epoxy, HEPA, OT) as they are.",
  );
  return { original: out.original.trim(), english: cleanNote(out.english) };
}

interface RawClassification {
  note: string;
  trade: string;
  zone: "critical" | "general" | "unknown";
  is_issue: boolean;
  routes: RouteTarget[];
  action_type: "none" | "material_status" | "task_status" | "phase_done";
  target_id: string;
  target_status: string;
  phase: string;
  action_note: string;
  confidence: number;
}

const ROUTING_RULES = `Routes (any subset, or none):
- doctor: visible progress the client would want in tonight's report (work done, installed, delivered in good condition). Never send problems, labour or money matters to the doctor.
- procurement: anything about materials to order, reorder, short, broken, wrong or late delivery.
- head: problems that need the owner (issues, delays, labour shortage, safety, client complaints) and major milestones (phase complete).
Zone: critical = OT, embryology lab, cryostorage, collection room, MGPS, AHU/HEPA; general = reception, waiting, consult, toilets, interiors.
Action: if the message clearly says a listed material was received or has a problem, use material_status with its id and status received|issue (note says what to do, e.g. "2 broken, reorder"). If it says a listed task is done/started/blocked, use task_status with its id. If it says a phase is complete, use phase_done with the phase name from the list. Otherwise none.
Confidence: 0..1, how sure you are the coordinator will accept your routes and action unchanged.`;

export async function geminiClassify(input: ClassifyInput): Promise<Classification> {
  const ctx = [
    `Site: ${input.projectName ?? "unknown"}`,
    `Phases and open tasks:\n${input.tasks.map((t) => `- [${t.id}] ${t.phase} · ${t.title} · ${t.trade} · ${t.status}`).join("\n") || "- none"}`,
    `Materials:\n${input.materials.map((m) => `- [${m.id}] ${m.item} · ${m.trade} · ${m.status}`).join("\n") || "- none"}`,
    `Recent decisions by the coordinator (follow their pattern):\n${
      input.examples.map((e) => `- "${e.text}" → note "${e.note}", trade ${e.trade ?? "-"}, zone ${e.zone ?? "-"}, routes [${e.routes.join(", ")}]`).join("\n") || "- none yet"
    }`,
    `New ${input.kind} message from the supervisor: "${input.text}"`,
  ].join("\n\n");

  const parts: Part[] = [];
  if (input.image) parts.push({ inline_data: { mime_type: input.image.mime, data: toBase64(input.image.bytes) } });
  parts.push({ text: ctx });

  const raw = await generate<RawClassification>(
    parts,
    {
      type: "OBJECT",
      properties: {
        note: { type: "STRING", description: "One clean English line for the record, max 12 words, no full stop." },
        trade: { type: "STRING", enum: [...TRADES] },
        zone: { type: "STRING", enum: ["critical", "general", "unknown"] },
        is_issue: { type: "BOOLEAN" },
        routes: { type: "ARRAY", items: { type: "STRING", enum: ["doctor", "procurement", "head"] } },
        action_type: { type: "STRING", enum: ["none", "material_status", "task_status", "phase_done"] },
        target_id: { type: "STRING", description: "Material or task id from the list, or empty." },
        target_status: { type: "STRING", description: "received|issue for materials; done|doing|blocked for tasks; empty otherwise." },
        phase: { type: "STRING", description: "Phase name for phase_done, else empty." },
        action_note: { type: "STRING", description: "Short note for material issues, else empty." },
        confidence: { type: "NUMBER" },
      },
      required: ["note", "trade", "zone", "is_issue", "routes", "action_type", "target_id", "target_status", "phase", "action_note", "confidence"],
    },
    `You sort site updates for Design Matrix, a contractor that builds IVF clinics. Supervisors send short messages in Hindi, Hinglish or English, often with a photo. ${ROUTING_RULES}`,
  );

  const taskIds = new Set(input.tasks.map((t) => t.id));
  const matIds = new Set(input.materials.map((m) => m.id));
  const phases = new Set(input.tasks.map((t) => t.phase));
  let action: SuggestedAction | null = null;
  if (raw.action_type === "material_status" && matIds.has(raw.target_id) && ["received", "issue"].includes(raw.target_status)) {
    action = { type: "material_status", material_id: raw.target_id, status: raw.target_status as "received" | "issue", ...(raw.action_note ? { note: raw.action_note } : {}) };
  } else if (raw.action_type === "task_status" && taskIds.has(raw.target_id) && ["done", "doing", "blocked"].includes(raw.target_status)) {
    action = { type: "task_status", task_id: raw.target_id, status: raw.target_status as "done" | "doing" | "blocked" };
  } else if (raw.action_type === "phase_done" && phases.has(raw.phase)) {
    action = { type: "phase_done", phase: raw.phase };
  }

  const routes = [...new Set((raw.routes ?? []).filter((r) => r === "doctor" || r === "procurement" || r === "head"))];
  return {
    note: cleanNote(raw.note || input.text),
    trade: (TRADES as readonly string[]).includes(raw.trade) ? raw.trade : null,
    zone: raw.zone === "unknown" ? null : (raw.zone as Zone),
    is_issue: !!raw.is_issue,
    routes: raw.is_issue ? routes.filter((r) => r !== "doctor") : routes,
    action,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
    engine: "gemini",
  };
}

export async function geminiSuggestPlan(input: {
  notes: string;
  templateName: string;
  plannedDays: number;
  existingTasks: string[];
  existingMaterials: string[];
}): Promise<PlanSuggestion> {
  const out = await generate<Omit<PlanSuggestion, "engine">>(
    [{
      text: [
        `Template: ${input.templateName}, ${input.plannedDays} days.`,
        `Tasks already planned: ${input.existingTasks.join("; ")}`,
        `Materials already planned: ${input.existingMaterials.join("; ")}`,
        `Order notes from the client: "${input.notes}"`,
        "Propose only extra tasks and materials these notes clearly need that are not already planned. At most 4 of each. Empty lists are fine.",
      ].join("\n"),
    }],
    {
      type: "OBJECT",
      properties: {
        tasks: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              phase: { type: "STRING", enum: ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover"] },
              title: { type: "STRING" },
              trade: { type: "STRING", enum: [...TRADES] },
              zone: { type: "STRING", enum: ["critical", "general"] },
              start_day: { type: "INTEGER" },
              duration_days: { type: "INTEGER" },
              why: { type: "STRING", description: "Under 8 words." },
            },
            required: ["phase", "title", "trade", "zone", "start_day", "duration_days", "why"],
          },
        },
        materials: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              item: { type: "STRING" },
              trade: { type: "STRING", enum: [...TRADES] },
              qty: { type: "NUMBER" },
              unit: { type: "STRING" },
              lead_time_days: { type: "INTEGER" },
              need_day: { type: "INTEGER" },
              why: { type: "STRING", description: "Under 8 words." },
            },
            required: ["item", "trade", "qty", "unit", "lead_time_days", "need_day", "why"],
          },
        },
      },
      required: ["tasks", "materials"],
    },
    "You help the office coordinator of an IVF clinic fit-out contractor in India plan a new project. Be conservative and practical. Titles in sentence case, short.",
  );
  const clampDay = (n: number) => Math.max(0, Math.min(input.plannedDays - 1, Math.round(Number(n) || 0)));
  return {
    engine: "gemini",
    tasks: (out.tasks ?? []).slice(0, 4).map((t) => ({ ...t, start_day: clampDay(t.start_day), duration_days: Math.max(1, Math.round(t.duration_days || 1)) })),
    materials: (out.materials ?? []).slice(0, 4).map((m) => ({ ...m, need_day: clampDay(m.need_day), lead_time_days: Math.max(1, Math.round(m.lead_time_days || 7)) })),
  };
}
