import "server-only";
import { db, must, signedUrls } from "./db";
import { fmtTime, today } from "./dates";
import { notifyRole } from "./notify";
import type { AutopilotSetting, Material, MaterialStatus, Person, Project, RouteTarget, SuggestedAction, Update, Zone } from "./types";

export async function getAutopilot(): Promise<AutopilotSetting> {
  const { data } = await db().from("app_settings").select("value").eq("key", "autopilot").maybeSingle();
  const v = (data?.value ?? {}) as Partial<AutopilotSetting>;
  return { enabled: !!v.enabled, min_confidence: typeof v.min_confidence === "number" ? v.min_confidence : 0.9 };
}

export async function setAutopilot(value: AutopilotSetting): Promise<void> {
  must(await db().from("app_settings").upsert({ key: "autopilot", value }), "save autopilot");
}

function sameRoutes(a: string[] | null, b: string[] | null): boolean {
  const x = [...(a ?? [])].sort().join(",");
  const y = [...(b ?? [])].sort().join(",");
  return x === y;
}

export interface Meter {
  reviewed: number;
  accepted: number;
  pct: number | null;
}

/** Share of suggestions accepted unchanged over the last 50 coordinator reviews. */
export async function autopilotMeter(): Promise<Meter> {
  const { data } = await db()
    .from("updates")
    .select("status, suggested_routes, final_routes, auto_routed")
    .not("reviewed_at", "is", null)
    .eq("auto_routed", false)
    .order("reviewed_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Pick<Update, "status" | "suggested_routes" | "final_routes">[];
  const accepted = rows.filter((r) => r.status === "approved" && sameRoutes(r.suggested_routes, r.final_routes)).length;
  return { reviewed: rows.length, accepted, pct: rows.length ? Math.round((accepted / rows.length) * 100) : null };
}

export async function setMaterialStatus(id: string, status: MaterialStatus, note?: string | null): Promise<Material> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "ordered") patch.ordered_at = now;
  if (status === "received") patch.received_at = now;
  if (status === "to_order") Object.assign(patch, { ordered_at: null, received_at: null, alert_sent_at: null, escalated_at: null });
  if (note !== undefined) patch.note = note;
  return must(await db().from("materials").update(patch).eq("id", id).select("*").single(), "update material") as Material;
}

export async function setTaskStatus(id: string, status: "todo" | "doing" | "done" | "blocked", label: string | null = null): Promise<void> {
  must(
    await db().from("tasks").update({ status, status_label: label, done_at: status === "done" ? new Date().toISOString() : null }).eq("id", id),
    "update task",
  );
}

/** Applies a suggested action and returns a one-line description of what changed. */
export async function applyAction(action: SuggestedAction, projectId: string | null): Promise<string | null> {
  const sb = db();
  if (action.type === "material_status") {
    const m = await setMaterialStatus(action.material_id, action.status, action.note ?? undefined);
    const word = action.status === "issue" ? "marked issue" : `marked ${action.status}`;
    return `${m.item} ${word}${action.note ? ` (${action.note})` : ""}`;
  }
  if (action.type === "task_status") {
    await setTaskStatus(action.task_id, action.status);
    const { data } = await sb.from("tasks").select("title").eq("id", action.task_id).single();
    return `${data?.title ?? "Task"} marked ${action.status}`;
  }
  if (action.type === "phase_done" && projectId) {
    must(
      await sb.from("tasks").update({ status: "done", done_at: new Date().toISOString() })
        .eq("project_id", projectId).eq("phase", action.phase).neq("status", "done"),
      "phase done",
    );
    return `${action.phase} phase marked done`;
  }
  return null;
}

async function loadUpdateContext(u: Update) {
  const sb = db();
  const [proj, person] = await Promise.all([
    u.project_id ? sb.from("projects").select("*").eq("id", u.project_id).single() : Promise.resolve({ data: null }),
    u.person_id ? sb.from("people").select("*").eq("id", u.person_id).single() : Promise.resolve({ data: null }),
  ]);
  return { project: proj.data as Project | null, person: person.data as Person | null };
}

function routeMessage(u: Update, project: Project | null, person: Person | null, actionLine: string | null, target: RouteTarget): string {
  const lines = [
    project ? `${project.code} ${project.name} · ${project.city}` : "Site update",
    u.note ?? u.raw_text ?? "",
    [u.trade, u.zone ? `${u.zone} zone` : null, person?.name, fmtTime(u.received_at)].filter(Boolean).join(" · "),
  ];
  if (actionLine) lines.push(`Done in Tensor: ${actionLine}`);
  if (target === "procurement" && u.is_issue) lines.push("Please act within 24 hours.");
  return lines.filter(Boolean).join("\n");
}

export interface ApproveInput {
  routes: RouteTarget[];
  note?: string;
  trade?: string | null;
  zone?: Zone | null;
  applySuggestedAction?: boolean;
  auto?: boolean;
  /** Person who approved; null for the shared office login or autopilot. */
  reviewedBy?: string | null;
}

/** Approve: save the coordinator's choices, apply the action, notify procurement/head now. Doctor items wait for the nightly report. */
export async function approveUpdate(id: string, input: ApproveInput): Promise<{ action: string | null; notified: { target: RouteTarget; sent: boolean }[] }> {
  const sb = db();
  const u = must(await sb.from("updates").select("*").eq("id", id).single(), "load update") as Update;
  const routes = [...new Set(input.routes)];
  const patch: Record<string, unknown> = {
    status: "approved",
    final_routes: routes,
    reviewed_at: new Date().toISOString(),
    auto_routed: !!input.auto,
    reviewed_by: input.reviewedBy ?? null,
  };
  if (input.note !== undefined && input.note.trim()) patch.note = input.note.trim();
  if (input.trade !== undefined) patch.trade = input.trade || null;
  if (input.zone !== undefined) patch.zone = input.zone || null;
  const updated = must(await sb.from("updates").update(patch).eq("id", id).select("*").single(), "approve update") as Update;

  let actionLine: string | null = null;
  if (input.applySuggestedAction !== false && u.suggested_action) {
    actionLine = await applyAction(u.suggested_action, u.project_id);
  }

  const { project, person } = await loadUpdateContext(updated);
  const photo = updated.kind === "photo" && updated.media_path ? (await signedUrls([updated.media_path])).get(updated.media_path) ?? null : null;
  const notified: { target: RouteTarget; sent: boolean }[] = [];
  for (const target of ["procurement", "head"] as const) {
    if (!routes.includes(target)) continue;
    const results = await notifyRole(target, `update_${target}`, routeMessage(updated, project, person, actionLine, target), {
      projectId: updated.project_id,
      photoUrl: photo,
    });
    notified.push({ target, sent: results.some((r) => r.status === "sent") });
  }
  return { action: actionLine, notified };
}

export async function holdUpdate(id: string, reviewedBy: string | null = null): Promise<void> {
  must(await db().from("updates").update({ status: "held", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy }).eq("id", id), "hold update");
}

export async function reopenUpdate(id: string): Promise<void> {
  must(await db().from("updates").update({ status: "pending", reviewed_at: null, final_routes: null }).eq("id", id), "reopen update");
}

/** After intake: route on its own when autopilot is on and the suggestion is confident. */
export async function maybeAutopilot(u: Update): Promise<boolean> {
  const ap = await getAutopilot();
  if (!ap.enabled || u.status !== "pending" || !u.project_id) return false;
  if ((u.ai_confidence ?? 0) < ap.min_confidence) return false;
  await approveUpdate(u.id, { routes: u.suggested_routes, auto: true });
  return true;
}

export async function approvedDoctorCount(projectId: string, date: string = today()): Promise<number> {
  const { data } = await db()
    .from("updates")
    .select("id, received_at")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .contains("final_routes", ["doctor"])
    .gte("received_at", `${date}T00:00:00+05:30`)
    .lt("received_at", `${date}T23:59:59.999+05:30`);
  return (data ?? []).length;
}
