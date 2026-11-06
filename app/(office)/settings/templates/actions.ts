"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth";
import { db, must } from "@/lib/db";
import type { Material, Project, Task, Zone } from "@/lib/types";

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
function int(form: FormData, key: string, min = 0): number {
  return Math.max(min, Math.round(Number(str(form, key)) || 0));
}
function done(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}
const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);

/** New template: blank, a copy of another template, or built from a project's actual plan. */
export async function createTemplateAction(form: FormData) {
  await requireOffice();
  const name = str(form, "name");
  if (!name) done("/settings/templates", "Give the template a name");
  const from = str(form, "from");
  const sb = db();

  let days = 45;
  let tasks: Record<string, unknown>[] = [];
  let materials: Record<string, unknown>[] = [];
  if (from.startsWith("template:")) {
    const id = from.slice(9);
    const [t, tt, tm] = await Promise.all([
      sb.from("templates").select("default_days").eq("id", id).single(),
      sb.from("template_tasks").select("phase, title, trade, zone, start_day, duration_days, sort").eq("template_id", id),
      sb.from("template_materials").select("item, trade, qty, unit, lead_time_days, need_day").eq("template_id", id),
    ]);
    days = (t.data?.default_days as number) ?? 45;
    tasks = tt.data ?? [];
    materials = tm.data ?? [];
  } else if (from.startsWith("project:")) {
    const id = from.slice(8);
    const [p, pt, pm] = await Promise.all([
      sb.from("projects").select("*").eq("id", id).single(),
      sb.from("tasks").select("*").eq("project_id", id).order("sort"),
      sb.from("materials").select("*").eq("project_id", id),
    ]);
    const project = p.data as Project;
    days = project.planned_days;
    tasks = ((pt.data ?? []) as Task[]).map((t, i) => ({
      phase: t.phase, title: t.title, trade: t.trade, zone: t.zone,
      start_day: Math.max(0, daysBetween(t.planned_start, project.start_date)),
      duration_days: Math.max(1, daysBetween(t.planned_end, t.planned_start) + 1),
      sort: i + 1,
    }));
    // Use the lead time the order actually took when the project recorded it.
    materials = ((pm.data ?? []) as Material[]).map((m) => ({
      item: m.item, trade: m.trade, qty: m.qty, unit: m.unit,
      lead_time_days: m.ordered_at && m.received_at ? Math.max(1, daysBetween(m.received_at.slice(0, 10), m.ordered_at.slice(0, 10))) : m.lead_time_days,
      need_day: Math.max(0, daysBetween(m.need_by, project.start_date)),
    }));
  }

  const tpl = must(await sb.from("templates").insert({ name, description: str(form, "description") || null, default_days: days }).select("id").single(), "create template") as { id: string };
  if (tasks.length) must(await sb.from("template_tasks").insert(tasks.map((t) => ({ ...t, template_id: tpl.id }))), "copy tasks");
  if (materials.length) must(await sb.from("template_materials").insert(materials.map((m) => ({ ...m, template_id: tpl.id }))), "copy materials");
  done(`/settings/templates/${tpl.id}`, `Template created with ${tasks.length} tasks and ${materials.length} materials`);
}

export async function updateTemplateAction(form: FormData) {
  await requireOffice();
  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) done(`/settings/templates/${id}`, "A template needs a name");
  must(await db().from("templates").update({ name, description: str(form, "description") || null, default_days: int(form, "default_days", 1) }).eq("id", id), "save template");
  done(`/settings/templates/${id}`, "Template saved");
}

export async function deleteTemplateAction(form: FormData) {
  await requireOffice();
  const id = str(form, "id");
  if (form.get("confirm") !== "on") done(`/settings/templates/${id}`, "Tick the box to confirm the delete");
  const { count } = await db().from("projects").select("id", { count: "exact", head: true }).eq("template_id", id);
  if (count) done(`/settings/templates/${id}`, `${count} ${count === 1 ? "project uses" : "projects use"} this template, so it stays. Rename it instead.`);
  must(await db().from("templates").delete().eq("id", id), "delete template");
  done("/settings/templates", "Template deleted");
}

export async function saveTemplateTaskAction(form: FormData) {
  await requireOffice();
  const templateId = str(form, "template_id");
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) done(`/settings/templates/${templateId}`, "A task needs a title");
  const row = {
    template_id: templateId,
    title,
    phase: str(form, "phase") || "Build",
    trade: str(form, "trade") || "Civil",
    zone: (str(form, "zone") || "general") as Zone,
    // The form counts from day 1; the database from day 0.
    start_day: int(form, "start_day", 1) - 1,
    duration_days: int(form, "duration_days", 1),
  };
  if (id) must(await db().from("template_tasks").update(row).eq("id", id), "save task");
  else must(await db().from("template_tasks").insert({ ...row, sort: 999 }), "add task");
  done(`/settings/templates/${templateId}`, `${id ? "Saved" : "Added"}: ${title}`);
}

export async function saveTemplateMaterialAction(form: FormData) {
  await requireOffice();
  const templateId = str(form, "template_id");
  const id = str(form, "id");
  const item = str(form, "item");
  if (!item) done(`/settings/templates/${templateId}`, "A material needs a name");
  const row = {
    template_id: templateId,
    item,
    trade: str(form, "trade") || "Civil",
    qty: str(form, "qty") ? Number(str(form, "qty")) || null : null,
    unit: str(form, "unit") || null,
    lead_time_days: int(form, "lead_time_days"),
    need_day: int(form, "need_day", 1) - 1,
  };
  if (id) must(await db().from("template_materials").update(row).eq("id", id), "save material");
  else must(await db().from("template_materials").insert(row), "add material");
  done(`/settings/templates/${templateId}`, `${id ? "Saved" : "Added"}: ${item}`);
}

export async function deleteTemplateRowAction(form: FormData) {
  await requireOffice();
  const templateId = str(form, "template_id");
  const table = str(form, "kind") === "material" ? "template_materials" : "template_tasks";
  must(await db().from(table).delete().eq("id", str(form, "id")).eq("template_id", templateId), "delete row");
  done(`/settings/templates/${templateId}`, "Removed from the template");
}
