import "server-only";
import { db, must } from "./db";
import { addDays, diffDays, fmtDue, fmtShort, istDate, istHour, plural, projectDay, today } from "./dates";
import type { Decision, Material, Person, Project, Task, Update } from "./types";

export interface Progress {
  day: number;
  planned: number;
  elapsed: number;
  slip: number;
  handoverPlanned: string;
  handoverProjected: string;
  doneTasks: number;
  totalTasks: number;
}

/** Day X of Y and slip: the longest overrun among unfinished tasks whose planned end has passed. */
export function progressOf(project: Pick<Project, "start_date" | "planned_days">, tasks: Pick<Task, "status" | "planned_end">[], ref = today()): Progress {
  const day = projectDay(project.start_date, ref);
  let slip = 0;
  for (const t of tasks) {
    if (t.status === "done") continue;
    const late = diffDays(ref, t.planned_end);
    if (late > slip) slip = late;
  }
  const handoverPlanned = addDays(project.start_date, project.planned_days - 1);
  return {
    day,
    planned: project.planned_days,
    elapsed: Math.max(0, Math.min(day, project.planned_days + slip)),
    slip,
    handoverPlanned,
    handoverProjected: addDays(handoverPlanned, slip),
    doneTasks: tasks.filter((t) => t.status === "done").length,
    totalTasks: tasks.length,
  };
}

export type Severity = "overdue" | "attention";

export interface Exception {
  key: string;
  severity: Severity;
  kind: "order_overdue" | "order_soon" | "material_issue" | "task_late" | "task_blocked" | "quiet_site" | "decision" | "review";
  tag: string;
  what: string;
  projectId: string;
  projectCode: string;
  site: string;
  person: string | null;
  date: string | null;
  /** How old the problem is in days, for sorting oldest first. */
  age: number;
  materialId?: string;
  escalated?: boolean;
}

export interface Snapshot {
  projects: Project[];
  people: Map<string, Person>;
  tasks: Task[];
  materials: Material[];
  lastUpdate: Map<string, string>;
  pendingByProject: Map<string, number>;
  pendingTotal: number;
  decisions: Decision[];
}

export async function loadSnapshot(): Promise<Snapshot> {
  const sb = db();
  const projects = must(await sb.from("projects").select("*").neq("status", "closed").order("start_date"), "projects") as Project[];
  const ids = projects.map((p) => p.id);
  const [people, tasks, materials, updates, decisions] = await Promise.all([
    sb.from("people").select("*"),
    ids.length ? sb.from("tasks").select("*").in("project_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from("materials").select("*").in("project_id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from("updates").select("project_id, received_at, status").in("project_id", ids).order("received_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from("decisions").select("*").in("project_id", ids).is("answer", null) : Promise.resolve({ data: [], error: null }),
  ]);
  const lastUpdate = new Map<string, string>();
  const pendingByProject = new Map<string, number>();
  for (const u of (updates.data ?? []) as Pick<Update, "project_id" | "received_at" | "status">[]) {
    if (!u.project_id) continue;
    if (!lastUpdate.has(u.project_id)) lastUpdate.set(u.project_id, u.received_at);
    if (u.status === "pending") pendingByProject.set(u.project_id, (pendingByProject.get(u.project_id) ?? 0) + 1);
  }
  const { count } = await sb.from("updates").select("id", { count: "exact", head: true }).eq("status", "pending");
  return {
    projects,
    people: new Map(((people.data ?? []) as Person[]).map((p) => [p.id, p])),
    tasks: (tasks.data ?? []) as Task[],
    materials: (materials.data ?? []) as Material[],
    lastUpdate,
    pendingByProject,
    pendingTotal: count ?? 0,
    decisions: (decisions.data ?? []) as Decision[],
  };
}

/** Quiet = nothing yesterday or today, or nothing today after 3 PM. */
export function quietDays(last: string | undefined, ref = today()): number | null {
  if (!last) return 99;
  const d = diffDays(ref, istDate(last));
  if (d >= 2) return d;
  if (d === 1 && istHour() >= 15) return 1;
  return null;
}

export function exceptionsFor(s: Snapshot, ref = today()): Exception[] {
  const out: Exception[] = [];
  const byId = new Map(s.projects.map((p) => [p.id, p]));
  const name = (id: string | null) => (id ? s.people.get(id)?.name ?? null : null);
  const buyer = [...s.people.values()].find((p) => p.role === "procurement")?.name ?? null;

  for (const m of s.materials) {
    const p = byId.get(m.project_id);
    if (!p || p.status === "closed") continue;
    if (m.status === "to_order") {
      const days = diffDays(m.order_by, ref);
      if (days < 0) {
        out.push({
          key: `m-${m.id}`, severity: "overdue", kind: "order_overdue",
          tag: `Overdue ${plural(-days, "day")}`,
          what: `${m.item} · order by ${fmtShort(m.order_by)}`,
          projectId: p.id, projectCode: p.code, site: p.city, person: buyer, date: m.order_by, age: -days,
          materialId: m.id, escalated: !!m.escalated_at,
        });
      } else if (days <= 2) {
        out.push({
          key: `m-${m.id}`, severity: "attention", kind: "order_soon",
          tag: `Order ${fmtDue(m.order_by, ref)}`,
          what: `${m.item} · needed on site ${fmtShort(m.need_by)}`,
          projectId: p.id, projectCode: p.code, site: p.city, person: buyer, date: m.order_by, age: -days,
          materialId: m.id,
        });
      }
    } else if (m.status === "issue") {
      out.push({
        key: `m-${m.id}`, severity: "overdue", kind: "material_issue",
        tag: "Issue",
        what: `${m.item}${m.note ? ` · ${m.note}` : ""}`,
        projectId: p.id, projectCode: p.code, site: p.city, person: buyer, date: m.received_at ? istDate(m.received_at) : null, age: 0,
        materialId: m.id,
      });
    }
  }

  for (const t of s.tasks) {
    const p = byId.get(t.project_id);
    if (!p || t.status === "done") continue;
    if (t.status === "blocked") {
      out.push({
        key: `t-${t.id}`, severity: "overdue", kind: "task_blocked", tag: "Blocked",
        what: t.title, projectId: p.id, projectCode: p.code, site: p.city, person: name(p.supervisor_id), date: t.planned_end, age: 0,
      });
      continue;
    }
    const late = diffDays(ref, t.planned_end);
    if (late > 0) {
      out.push({
        key: `t-${t.id}`, severity: "attention", kind: "task_late", tag: `Late ${plural(late, "day")}`,
        what: `${t.title} · due ${fmtShort(t.planned_end)}`,
        projectId: p.id, projectCode: p.code, site: p.city, person: name(p.supervisor_id), date: t.planned_end, age: late,
      });
    }
  }

  for (const p of s.projects) {
    if (p.status !== "active" || p.start_date > ref) continue;
    const q = quietDays(s.lastUpdate.get(p.id), ref);
    if (q !== null) {
      const last = s.lastUpdate.get(p.id);
      out.push({
        key: `q-${p.id}`, severity: "attention", kind: "quiet_site",
        tag: q >= 99 ? "No updates yet" : `Quiet ${plural(q, "day")}`,
        what: last ? `No update since ${fmtShort(istDate(last))}` : "No update from site yet",
        projectId: p.id, projectCode: p.code, site: p.city, person: name(p.supervisor_id), date: last ? istDate(last) : null, age: q,
      });
    }
  }

  for (const d of s.decisions) {
    const p = byId.get(d.project_id);
    if (!p) continue;
    const waited = diffDays(ref, istDate(d.asked_at));
    out.push({
      key: `d-${d.id}`, severity: "attention", kind: "decision",
      tag: waited > 0 ? `Waiting ${plural(waited, "day")}` : "Asked today",
      what: d.question, projectId: p.id, projectCode: p.code, site: p.city, person: name(p.doctor_id), date: istDate(d.asked_at), age: waited,
    });
  }

  return out.sort((a, b) => (a.severity === b.severity ? b.age - a.age : a.severity === "overdue" ? -1 : 1));
}
