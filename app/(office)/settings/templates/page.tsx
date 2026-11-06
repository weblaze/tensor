import { MANAGERS, requirePage } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { plural } from "@/lib/dates";
import type { Project, Template } from "@/lib/types";
import { Flash } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createTemplateAction } from "./actions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requirePage(...MANAGERS);
  const { msg } = await searchParams;
  const sb = db();
  const [tr, tt, tm, pr] = await Promise.all([
    sb.from("templates").select("*").order("name"),
    sb.from("template_tasks").select("template_id"),
    sb.from("template_materials").select("template_id"),
    sb.from("projects").select("id, code, name, city, status, template_id").order("start_date", { ascending: false }),
  ]);
  const templates = (tr.data ?? []) as Template[];
  const projects = (pr.data ?? []) as Pick<Project, "id" | "code" | "name" | "city" | "status" | "template_id">[];
  const count = (rows: { template_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.template_id === id).length;

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <Link href="/settings" className="tn-btn tn-btn--quiet" style={{ marginLeft: -16, marginBottom: 8 }}><Icon name="back" />Settings</Link>
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">Project templates</h1>
          <p className="tn-muted">Every new project starts from one. Lead times here are the fallback; Tensor uses real ones from past deliveries when it has them.</p>
        </div>
      </div>

      <div className="split">
        <div className="rows">
          {templates.length === 0 ? <div className="empty">No templates yet. Create one to start planning projects.</div> : templates.map((t) => (
            <Link key={t.id} href={`/settings/templates/${t.id}`} className="healthy">
              <Icon name="file" />
              <span style={{ flex: 1 }}>
                <span className="tn-body-strong">{t.name}</span>
                <span className="tn-muted"> · {plural(count(tt.data as { template_id: string }[], t.id), "task")}, {plural(count(tm.data as { template_id: string }[], t.id), "material")}</span>
              </span>
              <span className="tn-data tn-muted">{t.default_days} days</span>
            </Link>
          ))}
        </div>

        <aside className="card">
          <form action={createTemplateAction} className="form">
            <h2 className="tn-heading">New template</h2>
            <label className="tn-field">
              <span className="tn-label">Name</span>
              <input className="tn-input" name="name" required placeholder="IVF lab — compact, 30 days" />
            </label>
            <label className="tn-field">
              <span className="tn-label">Start from</span>
              <select className="tn-input" name="from" defaultValue={templates[0] ? `template:${templates[0].id}` : ""}>
                <option value="">Blank</option>
                {templates.length ? <optgroup label="Copy a template">{templates.map((t) => <option key={t.id} value={`template:${t.id}`}>{t.name}</option>)}</optgroup> : null}
                {projects.length ? <optgroup label="Use a project's plan">{projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.code} {p.name}, {p.city}{p.status === "closed" ? " (closed)" : ""}</option>)}</optgroup> : null}
              </select>
              <span className="tn-help">From a project, Tensor keeps its tasks and timing and uses the lead times orders actually took.</span>
            </label>
            <label className="tn-field">
              <span className="tn-label">Description</span>
              <input className="tn-input" name="description" placeholder="What kind of clinic this suits" />
            </label>
            <div><button className="tn-btn tn-btn--primary"><Icon name="plus" />Create template</button></div>
          </form>
        </aside>
      </div>
    </main>
  );
}
