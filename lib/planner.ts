import "server-only";
import { db, must } from "./db";
import { addDays, today } from "./dates";
import { suggestPlan } from "./ai";
import type { Source, Template, TemplateMaterial, TemplateTask, Zone } from "./types";

export interface PlanTask {
  key: string;
  phase: string;
  title: string;
  trade: string;
  zone: Zone;
  start_day: number;
  duration_days: number;
  source: Source;
  why?: string;
}

export interface PlanMaterial {
  key: string;
  item: string;
  trade: string;
  qty: number | null;
  unit: string | null;
  lead_time_days: number;
  template_lead_days?: number;
  need_day: number;
  source: Source;
  why?: string;
}

export interface PlanPreview {
  tasks: PlanTask[];
  materials: PlanMaterial[];
  aiEngine: "gemini" | "keywords" | null;
}

const PHASE_ORDER = ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover"];

export function phaseRank(phase: string): number {
  const i = PHASE_ORDER.indexOf(phase);
  return i === -1 ? PHASE_ORDER.length : i;
}

export async function listTemplates(): Promise<Template[]> {
  return must(await db().from("templates").select("*").order("name"), "templates") as Template[];
}

/** Template → tasks and materials, with learned tasks, learned lead times and optional AI suggestions. */
export async function buildPlan(templateId: string, opts: { notes?: string; useAi?: boolean; plannedDays?: number } = {}): Promise<PlanPreview> {
  const sb = db();
  const [tpl, tt, tm, lt, ll] = await Promise.all([
    sb.from("templates").select("*").eq("id", templateId).single(),
    sb.from("template_tasks").select("*").eq("template_id", templateId).order("sort"),
    sb.from("template_materials").select("*").eq("template_id", templateId).order("need_day"),
    sb.from("learned_tasks").select("*").eq("template_id", templateId),
    sb.from("learned_lead_times").select("*").eq("template_id", templateId),
  ]);
  const template = must(tpl, "template") as Template;
  const tasks: PlanTask[] = (must(tt, "template tasks") as TemplateTask[]).map((t) => ({
    key: `t-${t.id}`,
    phase: t.phase,
    title: t.title,
    trade: t.trade,
    zone: t.zone,
    start_day: t.start_day,
    duration_days: t.duration_days,
    source: "template",
  }));

  const have = new Set(tasks.map((t) => t.title.toLowerCase()));
  for (const l of (lt.data ?? []) as { title: string; phase: string; trade: string; zone: Zone; start_day: number; duration_days: number; projects: number }[]) {
    if (have.has(l.title.toLowerCase())) continue;
    tasks.push({
      key: `l-${l.title}`,
      phase: l.phase,
      title: l.title,
      trade: l.trade,
      zone: l.zone,
      start_day: l.start_day,
      duration_days: l.duration_days,
      source: "learned",
      why: `Added by hand in ${l.projects} past projects`,
    });
  }

  const learnedLead = new Map<string, { days: number; samples: number }>();
  for (const l of (ll.data ?? []) as { item: string; lead_time_days: number; samples: number }[]) {
    learnedLead.set(l.item.toLowerCase(), { days: l.lead_time_days, samples: l.samples });
  }
  const materials: PlanMaterial[] = (must(tm, "template materials") as TemplateMaterial[]).map((m) => {
    const learned = learnedLead.get(m.item.toLowerCase());
    const changed = learned && learned.days !== m.lead_time_days;
    return {
      key: `m-${m.id}`,
      item: m.item,
      trade: m.trade,
      qty: m.qty,
      unit: m.unit,
      lead_time_days: changed ? learned.days : m.lead_time_days,
      template_lead_days: m.lead_time_days,
      need_day: m.need_day,
      source: changed ? "learned" : "template",
      why: changed ? `Actual ${learned.days} days across ${learned.samples} past deliveries (template says ${m.lead_time_days})` : undefined,
    };
  });

  let aiEngine: PlanPreview["aiEngine"] = null;
  if (opts.useAi && opts.notes?.trim()) {
    const s = await suggestPlan({
      notes: opts.notes,
      templateName: template.name,
      plannedDays: opts.plannedDays ?? template.default_days,
      existingTasks: tasks.map((t) => t.title),
      existingMaterials: materials.map((m) => m.item),
    });
    aiEngine = s.engine;
    s.tasks.forEach((t, i) => tasks.push({ ...t, key: `a-t-${i}`, source: "ai" }));
    s.materials.forEach((m, i) => materials.push({ ...m, key: `a-m-${i}`, source: "ai" }));
  }

  tasks.sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.start_day - b.start_day);
  materials.sort((a, b) => a.need_day - a.lead_time_days - (b.need_day - b.lead_time_days));
  return { tasks, materials, aiEngine };
}

export async function nextProjectCode(): Promise<string> {
  const { data } = await db().from("projects").select("code");
  const max = Math.max(0, ...((data ?? []) as { code: string }[]).map((p) => Number(p.code.replace(/\D/g, "")) || 0));
  return `DM-${String(max + 1).padStart(4, "0")}`;
}

export interface CreateProjectInput {
  name: string;
  city: string;
  templateId: string;
  doctorId: string | null;
  supervisorId: string | null;
  coordinatorId: string | null;
  startDate: string;
  plannedDays: number;
  orderNotes: string;
  tasks: PlanTask[];
  materials: PlanMaterial[];
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string; code: string }> {
  const sb = db();
  const code = await nextProjectCode();
  const project = must(
    await sb.from("projects").insert({
      code,
      name: input.name,
      city: input.city,
      template_id: input.templateId,
      doctor_id: input.doctorId,
      supervisor_id: input.supervisorId,
      coordinator_id: input.coordinatorId,
      start_date: input.startDate,
      planned_days: input.plannedDays,
      order_notes: input.orderNotes || null,
    }).select("id, code").single(),
    "create project",
  ) as { id: string; code: string };

  const t0 = today();
  const taskRows = input.tasks.map((t, i) => {
    const start = addDays(input.startDate, t.start_day);
    return {
      project_id: project.id,
      phase: t.phase,
      title: t.title,
      trade: t.trade,
      zone: t.zone,
      planned_start: start,
      planned_end: addDays(start, Math.max(1, t.duration_days) - 1),
      status: "todo",
      source: t.source,
      sort: i + 1,
    };
  });
  const materialRows = input.materials.map((m) => ({
    project_id: project.id,
    item: m.item,
    trade: m.trade,
    qty: m.qty,
    unit: m.unit,
    lead_time_days: m.lead_time_days,
    need_by: addDays(input.startDate, m.need_day),
    status: "to_order",
    source: m.source,
  }));
  if (taskRows.length) must(await sb.from("tasks").insert(taskRows), "create tasks");
  if (materialRows.length) must(await sb.from("materials").insert(materialRows), "create materials");

  // A supervisor with no site yet reports for this one; one already on a site keeps it and can switch with /site.
  if (input.supervisorId && input.startDate <= addDays(t0, 7)) {
    await sb.from("people").update({ current_project_id: project.id }).eq("id", input.supervisorId).is("current_project_id", null);
  }
  return project;
}
