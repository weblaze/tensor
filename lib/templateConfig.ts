// How an office describes its own work, set up once per template (the setup wizard) and copied onto
// each project. Tensor's logic (late, slip, reports) only needs the four status kinds; the office's
// own words for them, and as many statuses per kind as they like, live here.
import type { TaskStatus } from "./types";

export type StatusKind = TaskStatus;

export interface TaskStatusDef {
  label: string;
  kind: StatusKind;
}

export type ProjectFieldKind = "text" | "phone" | "person" | "date";

export interface ProjectFieldDef {
  /** Stable key inside projects.details. */
  key: string;
  label: string;
  kind: ProjectFieldKind;
  required: boolean;
  help?: string;
}

export interface ZoneLabels {
  critical: string;
  general: string;
}

export interface TemplateConfig {
  phases: string[];
  task_statuses: TaskStatusDef[];
  trades: string[];
  zone_labels: ZoneLabels;
  project_fields: ProjectFieldDef[];
}

export const KIND_HELP: Record<StatusKind, string> = {
  todo: "Not started yet",
  doing: "Work is going on",
  done: "Finished: counts as complete",
  blocked: "Stuck: shows as a problem",
};

export const DEFAULT_CONFIG: TemplateConfig = {
  phases: ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover"],
  task_statuses: [
    { label: "Not started", kind: "todo" },
    { label: "In progress", kind: "doing" },
    { label: "Done", kind: "done" },
    { label: "Blocked", kind: "blocked" },
  ],
  trades: ["Civil", "Electrical", "MGPS", "HVAC", "Panelling", "Glazing", "Flooring", "Sanitary", "Doors", "Coordination"],
  zone_labels: { critical: "Critical", general: "General" },
  project_fields: [],
};

function strings(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? (v as string[]) : null;
}

/** Read a template or project row's config, falling back to the defaults for anything unset. */
export function configOf(row: Partial<Record<keyof TemplateConfig, unknown>> | null | undefined): TemplateConfig {
  const statuses = Array.isArray(row?.task_statuses)
    ? (row!.task_statuses as TaskStatusDef[]).filter((s) => s && typeof s.label === "string" && ["todo", "doing", "done", "blocked"].includes(s.kind))
    : [];
  const zones = (row?.zone_labels ?? null) as Partial<ZoneLabels> | null;
  return {
    phases: strings(row?.phases) ?? DEFAULT_CONFIG.phases,
    task_statuses: statuses.length ? statuses : DEFAULT_CONFIG.task_statuses,
    trades: strings(row?.trades) ?? DEFAULT_CONFIG.trades,
    zone_labels: { critical: zones?.critical || DEFAULT_CONFIG.zone_labels.critical, general: zones?.general || DEFAULT_CONFIG.zone_labels.general },
    project_fields: Array.isArray(row?.project_fields) ? (row!.project_fields as ProjectFieldDef[]) : [],
  };
}

/** The label to show for a task: its own status label, else the first label of its kind. */
export function statusLabel(cfg: TemplateConfig, kind: StatusKind, own?: string | null): string {
  if (own && cfg.task_statuses.some((s) => s.label === own)) return own;
  return cfg.task_statuses.find((s) => s.kind === kind)?.label ?? KIND_HELP[kind];
}

/** Status options in the office's order, excluding the current one. */
export function otherStatuses(cfg: TemplateConfig, kind: StatusKind, own?: string | null): TaskStatusDef[] {
  const current = statusLabel(cfg, kind, own);
  return cfg.task_statuses.filter((s) => s.label !== current);
}

/** The next status in the office's own order, used for the one-tap button on a task. */
export function nextStatus(cfg: TemplateConfig, kind: StatusKind, own?: string | null): TaskStatusDef | null {
  const list = cfg.task_statuses.filter((s) => s.kind !== "blocked");
  const current = statusLabel(cfg, kind, own);
  const i = list.findIndex((s) => s.label === current);
  if (kind === "blocked") return list.find((s) => s.kind === "doing") ?? list[0] ?? null;
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

export function slugKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";
}
