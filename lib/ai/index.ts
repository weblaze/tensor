// AI contract. Gemini is the prototype provider; Sarvam (STT) can replace transcribe later.
// Every call has a keyword fallback so the demo works with no key or when the free quota runs out.
import type { RouteTarget, SuggestedAction, Zone } from "../types";
import { classifyFallback, suggestPlanFallback } from "./fallback";
import { geminiClassify, geminiConfigured, geminiSuggestPlan, geminiTranscribe } from "./gemini";

export interface ContextTask { id: string; title: string; phase: string; trade: string; status: string }
export interface ContextMaterial { id: string; item: string; trade: string; status: string }
export interface Example { text: string; note: string; trade: string | null; zone: Zone | null; routes: RouteTarget[] }

export interface ClassifyInput {
  text: string;
  kind: "photo" | "voice" | "text" | "location" | "video";
  projectName?: string;
  tasks: ContextTask[];
  materials: ContextMaterial[];
  examples: Example[];
  /** Photo bytes for vision (optional). */
  image?: { bytes: ArrayBuffer; mime: string };
}

export interface Classification {
  note: string;
  trade: string | null;
  zone: Zone | null;
  is_issue: boolean;
  routes: RouteTarget[];
  action: SuggestedAction | null;
  confidence: number;
  engine: "gemini" | "keywords";
}

export interface Transcript {
  /** What was said, in the original language. */
  original: string;
  /** One clean English line. */
  english: string;
}

export interface PlanSuggestion {
  tasks: { phase: string; title: string; trade: string; zone: Zone; start_day: number; duration_days: number; why: string }[];
  materials: { item: string; trade: string; qty: number | null; unit: string | null; lead_time_days: number; need_day: number; why: string }[];
  engine: "gemini" | "keywords";
}

export function aiConfigured(): boolean {
  return geminiConfigured();
}

export async function transcribe(audio: { bytes: ArrayBuffer; mime: string }): Promise<Transcript | null> {
  if (!geminiConfigured()) return null;
  try {
    return await geminiTranscribe(audio);
  } catch (e) {
    console.warn("[ai] transcribe failed, no fallback text:", (e as Error).message);
    return null;
  }
}

export async function classify(input: ClassifyInput): Promise<Classification> {
  if (geminiConfigured() && input.text.trim()) {
    try {
      return await geminiClassify(input);
    } catch (e) {
      console.warn("[ai] classify failed, using keywords:", (e as Error).message);
    }
  }
  return classifyFallback(input);
}

export async function suggestPlan(input: {
  notes: string;
  templateName: string;
  plannedDays: number;
  existingTasks: string[];
  existingMaterials: string[];
}): Promise<PlanSuggestion> {
  if (geminiConfigured() && input.notes.trim()) {
    try {
      return await geminiSuggestPlan(input);
    } catch (e) {
      console.warn("[ai] suggestPlan failed, using keywords:", (e as Error).message);
    }
  }
  return suggestPlanFallback(input);
}
