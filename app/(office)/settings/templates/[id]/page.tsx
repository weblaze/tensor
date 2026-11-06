import { MANAGERS, requirePage } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { phaseRank } from "@/lib/planner";
import { configOf } from "@/lib/templateConfig";
import { TRADES, type Template, type TemplateMaterial, type TemplateTask } from "@/lib/types";
import { Flash, TradeTag, ZoneTag } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  deleteTemplateAction, deleteTemplateRowAction, saveTemplateMaterialAction, saveTemplateTaskAction, updateTemplateAction,
} from "../actions";

const PHASES = ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await db().from("templates").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Template" };
}

function TaskFields({ t }: { t?: TemplateTask }) {
  return (
    <div className="form-grid">
      <label className="tn-field"><span className="tn-label">Task</span><input className="tn-input" name="title" required defaultValue={t?.title} placeholder="MGPS pressure test" /></label>
      <label className="tn-field"><span className="tn-label">Phase</span>
        <select className="tn-input" name="phase" defaultValue={t?.phase ?? "Build"}>{[...new Set([...PHASES, t?.phase ?? "Build"])].map((p) => <option key={p}>{p}</option>)}</select>
      </label>
      <label className="tn-field"><span className="tn-label">Trade</span>
        <select className="tn-input" name="trade" defaultValue={t?.trade ?? "Civil"}>{[...new Set([...TRADES, t?.trade ?? "Civil"])].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className="tn-field"><span className="tn-label">Zone</span>
        <select className="tn-input" name="zone" defaultValue={t?.zone ?? "general"}><option value="critical">Critical</option><option value="general">General</option></select>
      </label>
      <label className="tn-field"><span className="tn-label">Starts on day</span><input className="tn-input" name="start_day" inputMode="numeric" defaultValue={t ? t.start_day + 1 : 1} /><span className="tn-help">Day 1 is the project start</span></label>
      <label className="tn-field"><span className="tn-label">Days</span><input className="tn-input" name="duration_days" inputMode="numeric" defaultValue={t?.duration_days ?? 1} /></label>
    </div>
  );
}

function MaterialFields({ m }: { m?: TemplateMaterial }) {
  return (
    <div className="form-grid">
      <label className="tn-field"><span className="tn-label">Item</span><input className="tn-input" name="item" required defaultValue={m?.item} placeholder="Pass box, SS" /></label>
      <label className="tn-field"><span className="tn-label">Trade</span>
        <select className="tn-input" name="trade" defaultValue={m?.trade ?? "Civil"}>{[...new Set([...TRADES, m?.trade ?? "Civil"])].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className="tn-field"><span className="tn-label">Quantity</span><input className="tn-input" name="qty" inputMode="decimal" defaultValue={m?.qty ?? ""} /></label>
      <label className="tn-field"><span className="tn-label">Unit</span><input className="tn-input" name="unit" defaultValue={m?.unit ?? ""} /></label>
      <label className="tn-field"><span className="tn-label">Lead time (days)</span><input className="tn-input" name="lead_time_days" inputMode="numeric" defaultValue={m?.lead_time_days ?? 7} /></label>
      <label className="tn-field"><span className="tn-label">Needed on day</span><input className="tn-input" name="need_day" inputMode="numeric" defaultValue={m ? m.need_day + 1 : 1} /><span className="tn-help">Day 1 is the project start</span></label>
    </div>
  );
}

function RemoveRow({ templateId, id, kind }: { templateId: string; id: string; kind: "task" | "material" }) {
  return (
    <form action={deleteTemplateRowAction}>
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <button className="tn-btn tn-btn--quiet">Remove {kind}</button>
    </form>
  );
}

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requirePage(...MANAGERS);
  const { id } = await params;
  const { msg } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = db();
  const [tr, tt, tm, used] = await Promise.all([
    sb.from("templates").select("*").eq("id", id).maybeSingle(),
    sb.from("template_tasks").select("*").eq("template_id", id),
    sb.from("template_materials").select("*").eq("template_id", id).order("need_day"),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("template_id", id),
  ]);
  if (!tr.data) notFound();
  const template = tr.data as Template;
  const tasks = ((tt.data ?? []) as TemplateTask[]).sort((a, b) => phaseRank(a.phase, configOf(template).phases) - phaseRank(b.phase, configOf(template).phases) || a.start_day - b.start_day || a.sort - b.sort);
  const materials = (tm.data ?? []) as TemplateMaterial[];
  const phases = [...new Set(tasks.map((t) => t.phase))];
  const hidden = <input type="hidden" name="template_id" value={id} />;

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <Link href="/settings/templates" className="tn-btn tn-btn--quiet" style={{ marginLeft: -16, marginBottom: 8 }}><Icon name="back" />Templates</Link>

      <div className="split">
        <div className="stack-4">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div className="page-head__text">
              <span className="tn-stamp">Template · used by {used.count ?? 0} {used.count === 1 ? "project" : "projects"}</span>
              <h1 className="tn-title">{template.name}</h1>
              {template.description ? <p className="tn-muted">{template.description}</p> : null}
            </div>
          </div>

          <h2 className="tn-heading">Tasks</h2>
          <div className="rows">
            {phases.map((ph) => (
              <div key={ph} style={{ display: "contents" }}>
                <div className="rows__group"><span className="tn-body-strong">{ph}</span></div>
                {tasks.filter((t) => t.phase === ph).map((t) => (
                  <div key={t.id} className="rowi">
                    <div className="rowi__main">
                      <span className="rowi__title">{t.title}</span>
                      <span className="rowi__meta">
                        <TradeTag trade={t.trade} />
                        <ZoneTag zone={t.zone} />
                        <span className="tn-data">Day {t.start_day + 1}{t.duration_days > 1 ? `–${t.start_day + t.duration_days}` : ""}</span>
                      </span>
                      <details className="more">
                        <summary>Edit</summary>
                        <div className="stack-4" style={{ paddingTop: 8 }}>
                          <form action={saveTemplateTaskAction} className="form">
                            {hidden}<input type="hidden" name="id" value={t.id} />
                            <TaskFields t={t} />
                            <div><button className="tn-btn"><Icon name="check" />Save task</button></div>
                          </form>
                          <RemoveRow templateId={id} id={t.id} kind="task" />
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {!tasks.length ? <div className="empty">No tasks yet.</div> : null}
          </div>
          <details className="card more">
            <summary>Add a task</summary>
            <form action={saveTemplateTaskAction} className="form" style={{ paddingTop: 8 }}>
              {hidden}
              <TaskFields />
              <div><button className="tn-btn"><Icon name="plus" />Add task</button></div>
            </form>
          </details>

          <h2 className="tn-heading" style={{ marginTop: 16 }}>Materials</h2>
          <p className="tn-muted">Order-by for a project = day needed − lead time.</p>
          <div className="rows">
            {materials.map((m) => (
              <div key={m.id} className="rowi">
                <div className="rowi__main">
                  <span className="rowi__title">{m.item}{m.qty ? <span className="tn-data tn-muted"> · {m.qty} {m.unit}</span> : null}</span>
                  <span className="rowi__meta">
                    <TradeTag trade={m.trade} />
                    <span>needed day <span className="tn-data">{m.need_day + 1}</span></span>
                    <span>· lead <span className="tn-data">{m.lead_time_days}d</span></span>
                  </span>
                  <details className="more">
                    <summary>Edit</summary>
                    <div className="stack-4" style={{ paddingTop: 8 }}>
                      <form action={saveTemplateMaterialAction} className="form">
                        {hidden}<input type="hidden" name="id" value={m.id} />
                        <MaterialFields m={m} />
                        <div><button className="tn-btn"><Icon name="check" />Save material</button></div>
                      </form>
                      <RemoveRow templateId={id} id={m.id} kind="material" />
                    </div>
                  </details>
                </div>
              </div>
            ))}
            {!materials.length ? <div className="empty">No materials yet.</div> : null}
          </div>
          <details className="card more">
            <summary>Add a material</summary>
            <form action={saveTemplateMaterialAction} className="form" style={{ paddingTop: 8 }}>
              {hidden}
              <MaterialFields />
              <div><button className="tn-btn"><Icon name="plus" />Add material</button></div>
            </form>
          </details>
        </div>

        <aside className="card stack-4">
          <form action={updateTemplateAction} className="form">
            <input type="hidden" name="id" value={id} />
            <h2 className="tn-heading">Details</h2>
            <label className="tn-field"><span className="tn-label">Name</span><input className="tn-input" name="name" required defaultValue={template.name} /></label>
            <label className="tn-field"><span className="tn-label">Description</span><input className="tn-input" name="description" defaultValue={template.description ?? ""} /></label>
            <label className="tn-field"><span className="tn-label">Planned days</span><input className="tn-input" name="default_days" inputMode="numeric" defaultValue={template.default_days} /></label>
            <div><button className="tn-btn tn-btn--primary"><Icon name="check" />Save details</button></div>
          </form>
          <form action={deleteTemplateAction} className="tn-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <input type="hidden" name="id" value={id} />
            <label className="check"><input type="checkbox" name="confirm" /><span>Yes, delete this template</span></label>
            <button className="tn-btn tn-btn--quiet">Delete</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
