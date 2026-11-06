"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { demoMode, headName, newLinkCode } from "@/lib/config";
import { db, must } from "@/lib/db";
import { fmtShort } from "@/lib/dates";
import { notifyPerson, notifyRole } from "@/lib/notify";
import { buildPlan, createProject, type PlanMaterial, type PlanPreview, type PlanTask } from "@/lib/planner";
import { approveUpdate, holdUpdate, reopenUpdate, setAutopilot, setMaterialStatus, setTaskStatus } from "@/lib/routing";
import { sendReport } from "@/lib/report";
import { runDailyChecks } from "@/lib/cron";
import { sortUpdate } from "@/lib/intake";
import { ROLES, ROUTES, type MaterialStatus, type Person, type Project, type Role, type RouteTarget, type TaskStatus, type Update, type Zone } from "@/lib/types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function back(form: FormData, fallback: string): string {
  const b = str(form, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
}

function withMsg(path: string, msg: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------- Inbox ----------

export interface ReviewResult { ok: boolean; message: string }

export async function approveUpdateAction(form: FormData): Promise<ReviewResult> {
  await requireOffice();
  const id = str(form, "id");
  const routes = form.getAll("routes").map(String).filter((r): r is RouteTarget => (ROUTES as string[]).includes(r));
  try {
    const res = await approveUpdate(id, {
      routes,
      note: str(form, "note") || undefined,
      trade: form.has("trade") ? str(form, "trade") || null : undefined,
      zone: form.has("zone") ? ((str(form, "zone") || null) as Zone | null) : undefined,
      applySuggestedAction: form.get("apply_action") !== "off",
    });
    refreshAll();
    const WHO: Record<RouteTarget, string> = { doctor: "the doctor", procurement: "procurement", head: await headName() };
    const parts = [
      "Approved",
      res.action ? res.action : null,
      res.notified.filter((n) => n.sent).length ? `sent to ${res.notified.filter((n) => n.sent).map((n) => WHO[n.target]).join(" and ")}` : null,
      res.notified.filter((n) => !n.sent).length ? `${res.notified.filter((n) => !n.sent).map((n) => WHO[n.target]).join(" and ")} not on Telegram yet, logged in Settings` : null,
      routes.includes("doctor") ? "in tonight's doctor report" : null,
    ].filter(Boolean);
    return { ok: true, message: parts.join(" · ") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function holdUpdateAction(form: FormData): Promise<ReviewResult> {
  await requireOffice();
  try {
    await holdUpdate(str(form, "id"));
    refreshAll();
    return { ok: true, message: "Held. It stays out of every report until you reopen it." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function reopenUpdateAction(form: FormData) {
  await requireOffice();
  await reopenUpdate(str(form, "id"));
  refreshAll();
  redirect(withMsg(back(form, "/inbox"), "Moved back to the inbox"));
}

export async function fileUpdateAction(form: FormData): Promise<ReviewResult> {
  await requireOffice();
  const id = str(form, "id");
  const projectId = str(form, "project_id");
  if (!projectId) return { ok: false, message: "Choose a site first" };
  try {
    const u = must(await db().from("updates").update({ project_id: projectId, offered_project_ids: null }).eq("id", id).select("*").single(), "file update") as Update;
    await sortUpdate(u);
    refreshAll();
    return { ok: true, message: "Filed to the site and sorted" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ---------- Materials and tasks ----------

export async function materialStatusAction(form: FormData) {
  await requireOffice();
  const status = str(form, "status") as MaterialStatus;
  if (!["to_order", "ordered", "received", "issue"].includes(status)) throw new Error("Bad status");
  const note = form.has("note") ? str(form, "note") || null : undefined;
  const vendor = str(form, "vendor");
  const m = await setMaterialStatus(str(form, "id"), status, note);
  if (vendor) await db().from("materials").update({ vendor }).eq("id", m.id);
  if (status === "issue") {
    const { data: p } = await db().from("projects").select("*").eq("id", m.project_id).single();
    const proj = p as Project;
    await notifyRole("procurement", "material_issue", `Issue · ${proj.code} ${proj.name}, ${proj.city}\n${m.item}${note ? `: ${note}` : ""}\nPlease sort out a replacement.`, { projectId: proj.id });
  }
  refreshAll();
  const word = { to_order: "back to To order", ordered: "marked ordered", received: "marked received", issue: "marked issue" }[status];
  redirect(withMsg(back(form, "/"), `${m.item} ${word}`));
}

export async function taskStatusAction(form: FormData) {
  await requireOffice();
  const status = str(form, "status") as TaskStatus;
  if (!["todo", "doing", "done", "blocked"].includes(status)) throw new Error("Bad status");
  await setTaskStatus(str(form, "id"), status);
  refreshAll();
  redirect(back(form, "/projects"));
}

export async function escalateAction(form: FormData) {
  await requireOffice();
  const id = str(form, "id");
  const { data } = await db().from("materials").select("*, projects(*)").eq("id", id).single();
  const m = data as { item: string; order_by: string; projects: Project };
  await notifyRole("head", "escalation", `Escalated by the office · ${m.projects.code} ${m.projects.name}, ${m.projects.city}\n${m.item} still not ordered. Order-by was ${fmtShort(m.order_by)}.`, { projectId: m.projects.id });
  await db().from("materials").update({ escalated_at: new Date().toISOString() }).eq("id", id);
  refreshAll();
  redirect(withMsg(back(form, "/"), `${m.item} escalated to ${await headName()}`));
}

export async function remindSupervisorAction(form: FormData) {
  await requireOffice();
  const projectId = str(form, "project_id");
  const { data } = await db().from("projects").select("*").eq("id", projectId).single();
  const p = data as Project;
  if (!p.supervisor_id) redirect(withMsg(back(form, "/"), "This site has no supervisor yet"));
  const { data: sup } = await db().from("people").select("*").eq("id", p.supervisor_id).single();
  const person = sup as Person;
  const res = await notifyPerson(person, "reminder", `${person.name}, please send today's photo and one line for ${p.city}.\n${p.city} साइट की आज की फ़ोटो और एक लाइन भेजें।`, { projectId });
  refreshAll();
  redirect(withMsg(back(form, "/"), res.status === "sent" ? `Reminder sent to ${person.name}` : `Reminder logged; ${res.error ?? "not sent"}`));
}

export async function addTaskAction(form: FormData) {
  await requireOffice();
  const projectId = str(form, "project_id");
  const title = str(form, "title");
  if (!title) redirect(withMsg(back(form, `/projects/${projectId}`), "Add a title"));
  const start = str(form, "planned_start");
  const end = str(form, "planned_end") || start;
  must(await db().from("tasks").insert({
    project_id: projectId,
    title,
    phase: str(form, "phase") || "Build",
    trade: str(form, "trade") || "Civil",
    zone: (str(form, "zone") || "general") as Zone,
    planned_start: start,
    planned_end: end < start ? start : end,
    source: "manual",
    sort: 999,
  }), "add task");
  refreshAll();
  redirect(withMsg(back(form, `/projects/${projectId}`), `Task added: ${title}`));
}

export async function addMaterialAction(form: FormData) {
  await requireOffice();
  const projectId = str(form, "project_id");
  const item = str(form, "item");
  if (!item) redirect(withMsg(back(form, `/projects/${projectId}?tab=materials`), "Add an item name"));
  must(await db().from("materials").insert({
    project_id: projectId,
    item,
    trade: str(form, "trade") || "Civil",
    qty: Number(str(form, "qty")) || null,
    unit: str(form, "unit") || null,
    lead_time_days: Math.max(0, Number(str(form, "lead_time_days")) || 7),
    need_by: str(form, "need_by"),
    source: "manual",
  }), "add material");
  refreshAll();
  redirect(withMsg(back(form, `/projects/${projectId}?tab=materials`), `Material added: ${item}`));
}

export async function sendReportAction(form: FormData) {
  await requireOffice();
  const projectId = str(form, "project_id");
  const r = await sendReport(projectId, { force: true });
  refreshAll();
  const msg =
    r.status === "sent" ? `Report sent to the doctor on Telegram (${r.count} updates)`
    : r.status === "no_doctor" ? "No doctor on this project yet"
    : `Doctor is not on Telegram yet; copy the link below and send it (${r.count} updates today)`;
  redirect(withMsg(back(form, `/projects/${projectId}`), msg));
}

export async function addDecisionAction(form: FormData) {
  await requireOffice();
  const projectId = str(form, "project_id");
  const question = str(form, "question");
  if (!question) redirect(withMsg(back(form, `/projects/${projectId}`), "Write the question first"));
  const d = must(await db().from("decisions").insert({ project_id: projectId, question }).select("id").single(), "add decision") as { id: string };
  const { data } = await db().from("projects").select("*, doctor:people!projects_doctor_id_fkey(*)").eq("id", projectId).single();
  const proj = data as Project & { doctor: Person | null };
  let note = "Question added to the doctor's report";
  if (proj.doctor?.telegram_chat_id) {
    const r = await notifyPerson(proj.doctor, "decision", `${proj.doctor.name}, the team needs your decision for ${proj.name}:\n${question}`, {
      projectId,
      buttons: [[{ text: "Approve", data: `dec:${d.id}:approved` }, { text: "Request change", data: `dec:${d.id}:change` }]],
    });
    if (r.status === "sent") note = "Question sent to the doctor on Telegram";
  }
  refreshAll();
  redirect(withMsg(back(form, `/projects/${projectId}`), note));
}

export async function projectStatusAction(form: FormData) {
  await requireOffice();
  const id = str(form, "id");
  const status = str(form, "status");
  if (!["active", "handover", "closed"].includes(status)) throw new Error("Bad status");
  await db().from("projects").update({ status }).eq("id", id);
  refreshAll();
  redirect(withMsg(back(form, `/projects/${id}`), `Project marked ${status}`));
}

// ---------- Planner ----------

export async function previewPlanAction(input: { templateId: string; notes: string; useAi: boolean; plannedDays: number }): Promise<PlanPreview | { error: string }> {
  await requireOffice();
  try {
    return await buildPlan(input.templateId, { notes: input.notes, useAi: input.useAi, plannedDays: input.plannedDays });
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createProjectAction(input: {
  name: string;
  city: string;
  templateId: string;
  doctorId: string;
  supervisorId: string;
  coordinatorId: string;
  startDate: string;
  plannedDays: number;
  orderNotes: string;
  tasks: PlanTask[];
  materials: PlanMaterial[];
}): Promise<{ error: string } | never> {
  await requireOffice();
  if (!input.name.trim() || !input.city.trim()) return { error: "Add the clinic name and city" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { error: "Pick a start date" };
  let created: { id: string; code: string };
  try {
    created = await createProject({
      ...input,
      name: input.name.trim(),
      city: input.city.trim(),
      doctorId: input.doctorId || null,
      supervisorId: input.supervisorId || null,
      coordinatorId: input.coordinatorId || null,
      plannedDays: Math.max(1, Math.round(input.plannedDays)),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  refreshAll();
  redirect(withMsg(`/projects/${created.id}`, `${created.code} created with ${input.tasks.length} tasks and ${input.materials.length} materials`));
}

// ---------- People ----------

export async function savePersonAction(form: FormData) {
  await requireOffice();
  const id = str(form, "id");
  const name = str(form, "name");
  const role = str(form, "role") as Role;
  if (!name || !ROLES.includes(role)) redirect(withMsg("/people", "Add a name and role"));
  const row = { name, role, phone: str(form, "phone") || null, current_project_id: str(form, "current_project_id") || null };
  if (id) must(await db().from("people").update(row).eq("id", id), "save person");
  else must(await db().from("people").insert(row), "add person");
  refreshAll();
  redirect(withMsg("/people", id ? `${name} saved` : `${name} added; share their link code`));
}

export async function unlinkPersonAction(form: FormData) {
  await requireOffice();
  await db().from("people").update({ telegram_chat_id: null }).eq("id", str(form, "id"));
  refreshAll();
  redirect(withMsg("/people", "Telegram unlinked"));
}

export async function newLinkCodeAction(form: FormData) {
  await requireOffice();
  const code = newLinkCode();
  await db().from("people").update({ link_code: code }).eq("id", str(form, "id"));
  refreshAll();
  redirect(withMsg("/people", `New code ${code}`));
}

export async function testMessageAction(form: FormData) {
  await requireOffice();
  const { data } = await db().from("people").select("*").eq("id", str(form, "id")).single();
  const p = data as Person;
  const r = await notifyPerson(p, "test", `Test from Tensor. ${p.name}, you are linked as ${p.role}.`);
  refreshAll();
  redirect(withMsg("/people", r.status === "sent" ? `Test message sent to ${p.name}` : `Not sent: ${r.error}`));
}

// ---------- Settings ----------

export async function autopilotAction(form: FormData) {
  await requireOffice();
  const enabled = form.get("enabled") === "on";
  const min = Math.min(0.99, Math.max(0.5, Number(str(form, "min_confidence")) || 0.9));
  await setAutopilot({ enabled, min_confidence: min });
  refreshAll();
  redirect(withMsg(back(form, "/settings"), enabled ? `Autopilot on for suggestions at ${Math.round(min * 100)}% confidence or more` : "Autopilot off; every update waits for review"));
}

export async function runChecksAction(form: FormData) {
  await requireOffice();
  const s = await runDailyChecks({ force: true });
  refreshAll();
  const reports = s.reports.filter((r) => r.status === "sent" || r.status === "skipped").length;
  redirect(withMsg(back(form, "/settings"), `Checks done · ${s.alerts} procurement alerts · ${s.escalations} escalations · ${reports} doctor reports · ${s.quietSites.length} quiet sites`));
}

export async function resetDemoAction(form: FormData) {
  await requireOffice();
  // Never on a production deployment: reseed_demo() replaces every project.
  if (!demoMode()) redirect(withMsg("/settings", "Demo reset is switched off on this deployment"));
  if (str(form, "confirm") !== "RESET") redirect(withMsg("/settings", "Type RESET to confirm"));
  must(await db().rpc("reseed_demo"), "reset demo");
  refreshAll();
  redirect(withMsg("/settings", "Demo data reset. Telegram links were kept."));
}
