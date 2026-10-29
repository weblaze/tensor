import "server-only";
import { db, signedUrls } from "./db";
import { addDays, fmtDate, isValidDate, today } from "./dates";
import { progressOf, type Progress } from "./insights";
import { notifyPerson } from "./notify";
import type { Decision, Person, Project, Task, Update } from "./types";

export interface ReportEntry {
  id: string;
  num: number;
  time: string;
  trade: string | null;
  zone: Update["zone"];
  note: string;
  who: string | null;
  kind: Update["kind"];
  mediaUrl: string | null;
}

export interface ReportData {
  project: Project;
  doctor: Person | null;
  date: string;
  progress: Progress;
  entries: ReportEntry[];
  trades: string[];
  photos: number;
  people: number;
  decisions: Decision[];
  nextSteps: Task[];
  milestones: Task[];
  prevDate: string | null;
  nextDate: string | null;
}

export async function getReport(token: string, dateParam?: string | null): Promise<ReportData | null> {
  const sb = db();
  const { data: project } = await sb.from("projects").select("*").eq("report_token", token).maybeSingle();
  if (!project) return null;
  const p = project as Project;
  const t0 = today();
  const date = isValidDate(dateParam) && dateParam <= t0 ? dateParam : t0;

  const [tasksRes, updatesRes, decisionsRes, doctorRes] = await Promise.all([
    sb.from("tasks").select("*").eq("project_id", p.id).order("planned_start"),
    sb.from("updates").select("*").eq("project_id", p.id).eq("status", "approved").contains("final_routes", ["doctor"])
      .gte("received_at", `${date}T00:00:00+05:30`).lte("received_at", `${date}T23:59:59.999+05:30`).order("received_at"),
    sb.from("decisions").select("*").eq("project_id", p.id).order("asked_at", { ascending: false }),
    p.doctor_id ? sb.from("people").select("*").eq("id", p.doctor_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const tasks = (tasksRes.data ?? []) as Task[];
  const updates = (updatesRes.data ?? []) as Update[];

  const personIds = [...new Set(updates.map((u) => u.person_id).filter((x): x is string => !!x))];
  const { data: ppl } = personIds.length ? await sb.from("people").select("id, name").in("id", personIds) : { data: [] };
  const names = new Map(((ppl ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
  const urls = await signedUrls(updates.map((u) => u.media_path));

  const entries: ReportEntry[] = updates.map((u, i) => ({
    id: u.id,
    num: i + 1,
    time: u.received_at,
    trade: u.trade,
    zone: u.zone,
    note: u.note ?? u.transcript ?? u.raw_text ?? "",
    who: u.person_id ? names.get(u.person_id) ?? null : null,
    kind: u.kind,
    mediaUrl: u.media_path ? urls.get(u.media_path) ?? null : null,
  }));

  // Days with doctor-approved updates, for previous/next navigation.
  const { data: days } = await sb.from("updates").select("received_at").eq("project_id", p.id).eq("status", "approved")
    .contains("final_routes", ["doctor"]).order("received_at", { ascending: false }).limit(500);
  const dayList = [...new Set(((days ?? []) as { received_at: string }[]).map((d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(d.received_at))))];
  const prevDate = dayList.find((d) => d < date) ?? null;
  const nextCandidates = dayList.filter((d) => d > date && d <= t0);
  const nextDate = nextCandidates.length ? nextCandidates[nextCandidates.length - 1] : date < t0 ? t0 : null;

  const progress = progressOf(p, tasks, date);
  const horizon = addDays(date, 3);
  const nextSteps = tasks.filter((t) => t.status !== "done" && t.planned_start <= horizon).slice(0, 5);
  const milestones = tasks.filter((t) => t.zone === "critical");

  return {
    project: p,
    doctor: (doctorRes.data as Person | null) ?? null,
    date,
    progress,
    entries,
    trades: [...new Set(entries.map((e) => e.trade).filter((x): x is string => !!x))],
    photos: entries.filter((e) => e.kind === "photo" || e.kind === "video").length,
    people: new Set(entries.map((e) => e.who).filter(Boolean)).size,
    decisions: (decisionsRes.data ?? []) as Decision[],
    nextSteps,
    milestones,
    prevDate,
    nextDate: nextDate && nextDate !== date ? nextDate : null,
  };
}

export function reportUrl(project: Pick<Project, "report_token">, date?: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/r/${project.report_token}${date ? `?date=${date}` : ""}`;
}

/** Send tonight's report link to the doctor (Telegram if linked, otherwise logged for the coordinator to copy). */
export async function sendReport(projectId: string, opts: { force?: boolean } = {}): Promise<{ status: string; count: number; url: string }> {
  const sb = db();
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).single();
  const project = p as Project;
  const date = today();
  const { count } = await sb.from("updates").select("id", { count: "exact", head: true }).eq("project_id", projectId)
    .eq("status", "approved").contains("final_routes", ["doctor"])
    .gte("received_at", `${date}T00:00:00+05:30`).lte("received_at", `${date}T23:59:59.999+05:30`);
  const n = count ?? 0;
  const url = reportUrl(project, date);
  if (!opts.force && (n === 0 || project.last_report_sent_on === date)) {
    return { status: n === 0 ? "nothing_today" : "already_sent", count: n, url };
  }
  if (!project.doctor_id) return { status: "no_doctor", count: n, url };
  const { data: doc } = await sb.from("people").select("*").eq("id", project.doctor_id).single();
  const doctor = doc as Person;
  const { data: open } = await sb.from("decisions").select("id").eq("project_id", projectId).is("answer", null);
  const decisions = (open ?? []).length;
  const tasks = ((await sb.from("tasks").select("status, planned_end").eq("project_id", projectId)).data ?? []) as Task[];
  const prog = progressOf(project, tasks, date);
  const body = [
    `${doctor.name}, here is today's site report for ${project.name}.`,
    `Day ${prog.day} of ${prog.planned} · ${fmtDate(date)} · ${n} ${n === 1 ? "update" : "updates"} with photos.`,
    decisions ? `${decisions} ${decisions === 1 ? "decision needs" : "decisions need"} your reply.` : null,
    url,
  ].filter(Boolean).join("\n");
  const res = await notifyPerson(doctor, "doctor_report", body, {
    projectId,
    buttons: url.startsWith("https://") ? [[{ text: "Open report", url }]] : undefined,
  });
  await sb.from("projects").update({ last_report_sent_on: date }).eq("id", projectId);
  return { status: res.status, count: n, url };
}
