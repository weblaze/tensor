// Shared contracts. Change only with the lead's agreement (see docs/06-build-plan.md).

export type Role = "coordinator" | "supervisor" | "procurement" | "head" | "doctor";
export type Zone = "critical" | "general";
export type Source = "template" | "learned" | "ai" | "manual";
export type TaskStatus = "todo" | "doing" | "done" | "blocked";
export type MaterialStatus = "to_order" | "ordered" | "received" | "issue";
export type UpdateKind = "photo" | "voice" | "text" | "location" | "video";
export type UpdateStatus = "pending" | "approved" | "held";
export type RouteTarget = "doctor" | "procurement" | "head";

export const ROUTES: RouteTarget[] = ["doctor", "procurement", "head"];
export const ROLES: Role[] = ["coordinator", "supervisor", "procurement", "head", "doctor"];
export const TRADES = [
  "Civil", "Electrical", "MGPS", "HVAC", "Panelling", "Glazing", "Flooring",
  "Sanitary", "Doors", "Coordination",
] as const;

export interface Person {
  id: string;
  name: string;
  role: Role;
  phone: string | null;
  telegram_chat_id: number | null;
  link_code: string;
  current_project_id: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  default_days: number;
}

export interface TemplateTask {
  id: string;
  template_id: string;
  phase: string;
  title: string;
  trade: string;
  zone: Zone;
  start_day: number;
  duration_days: number;
  sort: number;
}

export interface TemplateMaterial {
  id: string;
  template_id: string;
  item: string;
  trade: string;
  qty: number | null;
  unit: string | null;
  lead_time_days: number;
  need_day: number;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  city: string;
  template_id: string | null;
  doctor_id: string | null;
  supervisor_id: string | null;
  coordinator_id: string | null;
  start_date: string;
  planned_days: number;
  status: "active" | "handover" | "closed";
  order_notes: string | null;
  report_token: string;
  last_report_sent_on: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  phase: string;
  title: string;
  trade: string;
  zone: Zone;
  planned_start: string;
  planned_end: string;
  status: TaskStatus;
  done_at: string | null;
  source: Source;
  sort: number;
}

export interface Material {
  id: string;
  project_id: string;
  item: string;
  trade: string;
  qty: number | null;
  unit: string | null;
  lead_time_days: number;
  need_by: string;
  order_by: string;
  status: MaterialStatus;
  vendor: string | null;
  note: string | null;
  ordered_at: string | null;
  received_at: string | null;
  alert_sent_at: string | null;
  escalated_at: string | null;
  source: Source;
}

export type SuggestedAction =
  | { type: "material_status"; material_id: string; status: "received" | "issue" | "ordered"; note?: string }
  | { type: "task_status"; task_id: string; status: "done" | "doing" | "blocked" }
  | { type: "phase_done"; phase: string };

export interface Update {
  id: string;
  project_id: string | null;
  person_id: string | null;
  received_at: string;
  kind: UpdateKind;
  media_path: string | null;
  raw_text: string | null;
  transcript: string | null;
  note: string | null;
  trade: string | null;
  zone: Zone | null;
  is_issue: boolean;
  suggested_routes: RouteTarget[];
  suggested_action: SuggestedAction | null;
  ai_confidence: number | null;
  final_routes: RouteTarget[] | null;
  status: UpdateStatus;
  reviewed_at: string | null;
  auto_routed: boolean;
  lat: number | null;
  lng: number | null;
  telegram_message_id: number | null;
  offered_project_ids: string[] | null;
}

export interface Decision {
  id: string;
  project_id: string;
  question: string;
  asked_at: string;
  answer: "approved" | "change" | null;
  answer_note: string | null;
  answered_at: string | null;
}

export interface Notification {
  id: string;
  created_at: string;
  person_id: string | null;
  project_id: string | null;
  kind: string;
  body: string;
  channel: string;
  status: "sent" | "skipped" | "failed";
  error: string | null;
}

export interface AutopilotSetting {
  enabled: boolean;
  min_confidence: number;
}
