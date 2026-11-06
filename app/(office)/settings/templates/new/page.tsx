import Link from "next/link";
import { MANAGERS, requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { configOf } from "@/lib/templateConfig";
import type { Template, TemplateMaterial, TemplateTask } from "@/lib/types";
import { Icon } from "@/components/Icon";
import type { WizardTemplate } from "../actions";
import { Wizard } from "./Wizard";

export const metadata = { title: "Set up a template" };

/** The wizard's answers for an existing template, so its setup can be edited step by step. Days count from 1. */
async function loadForEdit(id: string): Promise<WizardTemplate | null> {
  const sb = db();
  const [t, tt, tm] = await Promise.all([
    sb.from("templates").select("*").eq("id", id).maybeSingle(),
    sb.from("template_tasks").select("*").eq("template_id", id).order("sort"),
    sb.from("template_materials").select("*").eq("template_id", id).order("need_day"),
  ]);
  if (!t.data) return null;
  const tpl = t.data as Template;
  const cfg = configOf(tpl);
  return {
    name: tpl.name,
    description: tpl.description ?? "",
    days: tpl.default_days,
    phases: cfg.phases,
    statuses: cfg.task_statuses,
    trades: cfg.trades,
    zones: cfg.zone_labels,
    fields: cfg.project_fields.map((f) => ({ label: f.label, kind: f.kind, required: f.required, help: f.help })),
    tasks: ((tt.data ?? []) as TemplateTask[]).map((x) => ({ phase: x.phase, title: x.title, trade: x.trade, zone: x.zone, start_day: x.start_day + 1, duration_days: x.duration_days })),
    materials: ((tm.data ?? []) as TemplateMaterial[]).map((m) => ({ item: m.item, trade: m.trade, qty: m.qty, unit: m.unit ?? "", lead_time_days: m.lead_time_days, need_day: m.need_day + 1 })),
  };
}

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<{ tutorial?: string; name?: string; edit?: string }> }) {
  await requirePage(...MANAGERS);
  const { tutorial, name, edit } = await searchParams;
  const initial = edit && /^[0-9a-f-]{36}$/.test(edit) ? await loadForEdit(edit) : null;
  return (
    <main className="page page--narrow" style={{ maxWidth: 960 }}>
      <Link href={initial ? `/settings/templates/${edit}` : "/settings/templates"} className="tn-btn tn-btn--quiet" style={{ marginLeft: -16, marginBottom: 8 }}><Icon name="back" />{initial ? initial.name : "Templates"}</Link>
      <Wizard
        tutorial={tutorial ? tutorial !== "0" : !initial}
        initialName={initial ? "" : (name ?? "").slice(0, 120)}
        templateId={initial ? edit : undefined}
        initial={initial ?? undefined}
      />
    </main>
  );
}
