import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManage, requirePage } from "@/lib/auth";
import { configOf, nextStatus, otherStatuses, statusLabel, type TemplateConfig } from "@/lib/templateConfig";
import { db, signedUrls } from "@/lib/db";
import { diffDays, fmtDate, fmtShort, fmtTime, fmtWhen, istDate, plural, today } from "@/lib/dates";
import { progressOf } from "@/lib/insights";
import { phaseRank } from "@/lib/planner";
import { reportUrl } from "@/lib/report";
import { type Decision, type Material, type Person, type Project, type Task, type Update } from "@/lib/types";
import { DayCounter, Flash, KindIcon, MaterialStatusTag, Photo, SourceTag, StatusTag, TaskStatusTag, TradeTag, ZoneTag, stampFor } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";
import { Icon } from "@/components/Icon";
import { MaterialEdit, ProjectEdit, TaskEdit } from "./EditForms";
import {
  addDecisionAction, addMaterialAction, addTaskAction, materialStatusAction, projectStatusAction,
  remindSupervisorAction, reopenUpdateAction, sendReportAction, taskStatusAction,
} from "../../actions";

type Tab = "updates" | "tasks" | "materials" | "report";
interface Perms { manage: boolean; materials: boolean; tasks: boolean }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await db().from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Project" };
}

function Hidden({ fields }: { fields: Record<string, string> }) {
  return <>{Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; msg?: string }> }) {
  const { id } = await params;
  const { tab: tabParam, msg } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = db();
  const { data: pd } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (!pd) notFound();
  const project = pd as Project;
  const viewer = await requirePage();
  const manage = canManage(viewer);
  const me = viewer.person?.id;
  // Doctors read their report; supervisors see their own sites only.
  if (viewer.role === "doctor") redirect(project.doctor_id === me ? `/r/${project.report_token}` : "/me");
  if (viewer.role === "supervisor" && project.supervisor_id !== me && viewer.person?.current_project_id !== project.id) redirect("/me");
  const cfg = configOf(project);
  const perms: Perms = { manage, materials: manage || viewer.role === "procurement", tasks: manage || viewer.role === "supervisor" };
  const tab: Tab = (["updates", "tasks", "materials", "report"] as Tab[]).includes(tabParam as Tab) && (manage || tabParam !== "report") ? (tabParam as Tab) : "updates";
  const t0 = today();

  const [tr, mr, ur, dr, pr] = await Promise.all([
    sb.from("tasks").select("*").eq("project_id", id),
    sb.from("materials").select("*").eq("project_id", id).order("order_by"),
    sb.from("updates").select("*").eq("project_id", id).order("received_at", { ascending: false }).limit(200),
    sb.from("decisions").select("*").eq("project_id", id).order("asked_at", { ascending: false }),
    sb.from("people").select("*"),
  ]);
  const tasks = ((tr.data ?? []) as Task[]).sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.planned_start.localeCompare(b.planned_start) || a.sort - b.sort);
  const materials = (mr.data ?? []) as Material[];
  const updates = (ur.data ?? []) as Update[];
  const decisions = (dr.data ?? []) as Decision[];
  const people = new Map(((pr.data ?? []) as Person[]).map((p) => [p.id, p]));
  const head = [...people.values()].find((p) => p.role === "head")?.name ?? "the head";
  const prog = progressOf(project, tasks, t0);
  const sup = project.supervisor_id ? people.get(project.supervisor_id) : undefined;
  const doc = project.doctor_id ? people.get(project.doctor_id) : undefined;
  const pendingCount = updates.filter((u) => u.status === "pending").length;
  const toOrder = materials.filter((m) => m.status === "to_order" && diffDays(m.order_by, t0) <= 2).length;
  const lateTasks = tasks.filter((t) => t.status !== "done" && diffDays(t0, t.planned_end) > 0).length;
  const here = `/projects/${id}`;
  const url = reportUrl(project, t0);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "updates", label: "Updates", count: pendingCount || undefined },
    { key: "tasks", label: "Tasks", count: lateTasks || undefined },
    { key: "materials", label: "Materials", count: toOrder || undefined },
    { key: "report", label: "Doctor report" },
  ];

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <Link href={manage ? "/projects" : "/me"} className="tn-btn tn-btn--quiet" style={{ marginLeft: -16, marginBottom: 8 }}>
        <Icon name="back" />
        {manage ? "Projects" : "My work"}
      </Link>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div className="page-head__text" style={{ gap: 8 }}>
          <span className="tn-stamp">{project.code} · {project.city}{project.status !== "active" ? ` · ${project.status}` : ""}</span>
          <h1 className="tn-display">{project.name}</h1>
          <p className="tn-muted">
            Supervisor {sup?.name ?? "not set"} · Doctor {doc?.name ?? "not set"} · {project.start_date > t0 ? "Starts" : "Started"} {fmtDate(project.start_date)}
          </p>
        </div>
        <div style={{ minWidth: 280, flex: "0 1 420px" }}>
          <DayCounter progress={prog} />
        </div>
      </div>

      <nav className="tabs" aria-label="Project sections">
        {tabs.filter((t) => manage || t.key !== "report").map((t) => (
          <Link key={t.key} href={`${here}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined}>
            {t.label}
            {t.count ? <span className="nav-count">{t.count}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "updates" ? <UpdatesTab project={project} updates={updates} people={people} here={here} /> : null}
      {tab === "tasks" ? <TasksTab project={project} tasks={tasks} here={`${here}?tab=tasks`} cfg={cfg} perms={perms} /> : null}
      {tab === "materials" ? <MaterialsTab head={head} project={project} materials={materials} here={`${here}?tab=materials`} cfg={cfg} perms={perms} /> : null}
      {tab === "report" ? (
        <section className="split">
          <div className="stack-4">
            <div className="card stack-4">
              <div className="stack-2">
                <h2 className="tn-heading">Tonight&apos;s report</h2>
                <p className="tn-muted">
                  Approved updates for the doctor go out at 9 PM{doc?.telegram_chat_id ? ` to ${doc.name} on Telegram` : ""}.
                  {project.last_report_sent_on ? ` Last sent ${fmtDate(project.last_report_sent_on)}.` : " Not sent yet."}
                </p>
              </div>
              <CopyLink value={url} label="Doctor report link" />
              <div className="tn-row">
                <form action={sendReportAction}>
                  <Hidden fields={{ project_id: id, back: `${here}?tab=report` }} />
                  <button className="tn-btn tn-btn--primary"><Icon name="send" />Send report now</button>
                </form>
                <a className="tn-btn" href={`/r/${project.report_token}`} target="_blank" rel="noreferrer"><Icon name="external" />Open report</a>
              </div>
              {!doc?.telegram_chat_id ? <p className="tn-caption">{doc ? `${doc.name} has not linked Telegram, so copy the link and send it on WhatsApp.` : "Add a doctor to this project to send reports."}</p> : null}
            </div>
            <div className="card stack-4">
              <h2 className="tn-heading">Decisions for the doctor</h2>
              {decisions.length === 0 ? <p className="tn-muted">No questions yet.</p> : (
                <div className="rows">
                  {decisions.map((d) => (
                    <div key={d.id} className="rowi">
                      <div className="rowi__main">
                        <span className="rowi__title">{d.question}</span>
                        <span className="rowi__meta">Asked {fmtWhen(d.asked_at)}{d.answer_note ? ` · “${d.answer_note}”` : ""}</span>
                      </div>
                      <div className="rowi__side">
                        {d.answer === "approved" ? <StatusTag>Approved {d.answered_at ? fmtShort(istDate(d.answered_at)) : ""}</StatusTag>
                          : d.answer === "change" ? <StatusTag tone="attention" icon="refresh">Change requested</StatusTag>
                          : <StatusTag tone="attention">Waiting {plural(diffDays(t0, istDate(d.asked_at)), "day")}</StatusTag>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <form action={addDecisionAction} className="stack-2">
                <Hidden fields={{ project_id: id, back: `${here}?tab=report` }} />
                <label className="tn-field">
                  <span className="tn-label">Ask the doctor</span>
                  <input className="tn-input" name="question" placeholder="Approve reception colour: warm grey" maxLength={200} />
                  <span className="tn-help">Shows in the report with Approve and Request change buttons.</span>
                </label>
                <div><button className="tn-btn"><Icon name="plus" />Add question</button></div>
              </form>
            </div>
          </div>
          <aside className="card stack-4">
            <h2 className="tn-heading">Project</h2>
            <dl className="kv">
              <dt>Code</dt><dd className="tn-data">{project.code}</dd>
              <dt>Planned</dt><dd>{plural(project.planned_days, "day")}</dd>
              <dt>Handover</dt><dd>{fmtDate(prog.handoverProjected)}</dd>
              <dt>Status</dt><dd>{project.status}</dd>
              {cfg.project_fields.map((f) => (
                <div key={f.key} style={{ display: "contents" }}>
                  <dt>{f.label}</dt><dd>{project.details?.[f.key] || <span className="tn-muted">{f.required ? "Missing" : "Not set"}</span>}</dd>
                </div>
              ))}
            </dl>
            {project.order_notes ? <p className="review__raw">{project.order_notes}</p> : null}
            <ProjectEdit project={project} people={[...people.values()]} back={`${here}?tab=report`} fields={cfg.project_fields} />
            <form action={projectStatusAction} className="tn-row">
              <Hidden fields={{ id, back: `${here}?tab=report` }} />
              <select name="status" className="tn-input" defaultValue={project.status} aria-label="Project status" style={{ flex: 1 }}>
                <option value="active">Active</option>
                <option value="handover">Handover</option>
                <option value="closed">Closed</option>
              </select>
              <button className="tn-btn">Save</button>
            </form>
          </aside>
        </section>
      ) : null}
    </main>
  );

  async function UpdatesTab({ project, updates, people, here }: { project: Project; updates: Update[]; people: Map<string, Person>; here: string }) {
    const urls = await signedUrls(updates.map((u) => u.media_path));
    const byDay = new Map<string, Update[]>();
    for (const u of updates) {
      if (u.status === "held") continue;
      const d = istDate(u.received_at);
      byDay.set(d, [...(byDay.get(d) ?? []), u]);
    }
    const held = updates.filter((u) => u.status === "held");
    const last = updates[0];
    return (
      <section>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <p className="tn-muted">{last ? `Last update ${fmtWhen(last.received_at)}` : "No updates from site yet."}</p>
          <div className="tn-row">
            {manage && pendingCount ? <Link href="/inbox" className="tn-btn"><Icon name="inbox" />Review {pendingCount}</Link> : null}
            {manage ? (
              <form action={remindSupervisorAction}>
                <Hidden fields={{ project_id: project.id, back: here }} />
                <button className="tn-btn tn-btn--quiet"><Icon name="send" />Remind {sup?.name ?? "supervisor"}</button>
              </form>
            ) : null}
          </div>
        </div>
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day}>
            <div className="day-head">
              <h2 className="tn-heading">{fmtDate(day)}</h2>
              <span className="tn-caption">Day {diffDays(day, project.start_date) + 1} · {plural(list.length, "update")}</span>
            </div>
            <div className="timeline">
              {list.map((u) => (
                <article key={u.id} className="tn-entry">
                  <div className="tn-entry__head">
                    <TradeTag trade={u.trade} />
                    <ZoneTag zone={u.zone} />
                    {u.status === "pending" ? <StatusTag tone="attention" icon="inbox">To review</StatusTag> : null}
                    {u.is_issue ? <StatusTag tone="overdue">Issue</StatusTag> : null}
                    <span className="tn-entry__time">{fmtTime(u.received_at)}</span>
                  </div>
                  <Photo url={u.media_path ? urls.get(u.media_path) ?? null : null} kind={u.kind} stamp={stampFor(u.received_at, project.city)} alt={u.note ?? "Site update"} />
                  <p className="tn-entry__note">{u.note ?? u.raw_text}</p>
                  <p className="tn-entry__who">
                    {u.person_id ? people.get(u.person_id)?.name : "Unknown"}
                    {u.status === "approved" ? ` · ${(u.final_routes ?? []).length ? `sent to ${(u.final_routes ?? []).map((r) => (r === "head" ? head : r)).join(", ")}` : "filed"}` : ""}
                    {u.auto_routed ? " · autopilot" : ""}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ))}
        {held.length ? (
          <section className="section">
            <h2 className="tn-heading" style={{ marginBottom: 12 }}>Held</h2>
            <div className="rows">
              {held.map((u) => (
                <div key={u.id} className="rowi">
                  <div className="rowi__main">
                    <span className="rowi__title">{u.note ?? u.raw_text}</span>
                    <span className="rowi__meta"><KindIcon kind={u.kind} />{fmtWhen(u.received_at)}</span>
                  </div>
                  <div className="rowi__side">
                    <form action={reopenUpdateAction}>
                      <Hidden fields={{ id: u.id, back: here }} />
                      <button className="tn-btn tn-btn--quiet">Reopen</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    );
  }
}

function TaskStatusBadge({ task, cfg, late }: { task: Task; cfg: TemplateConfig; late: number }) {
  const label = statusLabel(cfg, task.status, task.status_label);
  if (task.status === "blocked") return <StatusTag tone="overdue">{label}</StatusTag>;
  if (task.status !== "done" && late > 0) return <StatusTag tone="attention">Late {plural(late, "day")} · {label}</StatusTag>;
  if (task.status === "done") return <StatusTag>{label}</StatusTag>;
  return <StatusTag icon={task.status === "doing" ? "bolt" : "clock"}>{label}</StatusTag>;
}

function TasksTab({ project, tasks, here, cfg, perms }: { project: Project; tasks: Task[]; here: string; cfg: TemplateConfig; perms: Perms }) {
  const t0 = today();
  const phases = [...new Set(tasks.map((t) => t.phase))];
  return (
    <section className="stack-4">
      <div className="rows">
        {phases.map((phase) => {
          const list = tasks.filter((t) => t.phase === phase);
          const done = list.filter((t) => t.status === "done").length;
          return (
            <div key={phase} style={{ display: "contents" }}>
              <div className="rows__group">
                <span className="tn-body-strong">{phase}</span>
                <span className="tn-caption">{done} / {list.length} {statusLabel(cfg, "done").toLowerCase()}</span>
              </div>
              {list.map((t) => {
                const late = diffDays(t0, t.planned_end);
                const next = nextStatus(cfg, t.status, t.status_label);
                const others = otherStatuses(cfg, t.status, t.status_label).filter((s) => s.label !== next?.label);
                return (
                  <div key={t.id} className={`rowi${t.status === "done" ? " rowi--done" : ""}`}>
                    <div className="rowi__main">
                      <span className="rowi__title">{t.title}</span>
                      <span className="rowi__meta">
                        <TradeTag trade={t.trade} />
                        <ZoneTag zone={t.zone} label={cfg.zone_labels[t.zone]} />
                        <span className="tn-data">{t.planned_start === t.planned_end ? fmtShort(t.planned_start) : `${fmtShort(t.planned_start)} – ${fmtShort(t.planned_end)}`}</span>
                        <SourceTag source={t.source} />
                      </span>
                      {perms.manage ? <TaskEdit task={t} back={here} phases={cfg.phases} trades={cfg.trades} zoneLabels={cfg.zone_labels} /> : null}
                    </div>
                    <div className="rowi__side">
                      <TaskStatusBadge task={t} cfg={cfg} late={late} />
                      {perms.tasks && next ? (
                        <form action={taskStatusAction}>
                          <Hidden fields={{ id: t.id, status: next.kind, label: next.label, back: here }} />
                          <button className="tn-btn">{next.label}</button>
                        </form>
                      ) : null}
                      {perms.tasks && others.length ? (
                        <details className="more">
                          <summary>Status</summary>
                          <div className="tn-row" style={{ paddingTop: 4 }}>
                            {others.map((s) => (
                              <form key={s.label} action={taskStatusAction}>
                                <Hidden fields={{ id: t.id, status: s.kind, label: s.label, back: here }} />
                                <button className="tn-btn tn-btn--quiet">{s.label}</button>
                              </form>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {perms.manage ? (
        <details className="card more">
          <summary>Add a task</summary>
          <form action={addTaskAction} className="form" style={{ paddingTop: 8 }}>
            <Hidden fields={{ project_id: project.id, back: here }} />
            <div className="form-grid">
              <label className="tn-field"><span className="tn-label">Task</span><input className="tn-input" name="title" required /></label>
              <label className="tn-field"><span className="tn-label">Phase</span>
                <select className="tn-input" name="phase" defaultValue={cfg.phases[0]}>{cfg.phases.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label className="tn-field"><span className="tn-label">Trade</span>
                <select className="tn-input" name="trade" defaultValue={cfg.trades[0]}>{cfg.trades.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="tn-field"><span className="tn-label">Zone</span>
                <select className="tn-input" name="zone" defaultValue="general"><option value="critical">{cfg.zone_labels.critical}</option><option value="general">{cfg.zone_labels.general}</option></select>
              </label>
              <label className="tn-field"><span className="tn-label">Start</span><input className="tn-input" type="date" name="planned_start" required defaultValue={t0} /></label>
              <label className="tn-field"><span className="tn-label">End</span><input className="tn-input" type="date" name="planned_end" defaultValue={t0} /></label>
            </div>
            <span className="tn-help">Tasks you add by hand in two or more projects are suggested for the next one.</span>
            <div><button className="tn-btn"><Icon name="plus" />Add task</button></div>
          </form>
        </details>
      ) : null}
    </section>
  );
}

function MaterialsTab({ project, materials, here, head, cfg, perms }: { project: Project; materials: Material[]; here: string; head: string; cfg: TemplateConfig; perms: Perms }) {
  const t0 = today();
  const rank = (m: Material) => (m.status === "issue" ? 0 : m.status === "to_order" ? 1 : m.status === "ordered" ? 2 : 3);
  const list = [...materials].sort((a, b) => rank(a) - rank(b) || a.order_by.localeCompare(b.order_by));
  return (
    <section className="stack-4">
      <p className="tn-muted">Order-by = needed on site − lead time. Procurement is alerted 2 days before; unordered after 24 hours goes to {head}.</p>
      <div className="rows">
        {list.map((m) => {
          const days = diffDays(m.order_by, t0);
          return (
            <div key={m.id} className={`rowi${m.status === "received" ? " rowi--done" : ""}`}>
              <div className="rowi__main">
                <span className="rowi__title">{m.item}{m.qty ? <span className="tn-data tn-muted"> · {m.qty} {m.unit}</span> : null}</span>
                <span className="rowi__meta">
                  <TradeTag trade={m.trade} />
                  <span>Order by <span className="tn-data">{fmtShort(m.order_by)}</span></span>
                  <span>· need <span className="tn-data">{fmtShort(m.need_by)}</span></span>
                  <span>· lead <span className="tn-data">{m.lead_time_days}d</span></span>
                  {m.vendor ? <span>· {m.vendor}</span> : null}
                  {m.note ? <span>· {m.note}</span> : null}
                  {m.escalated_at && m.status === "to_order" ? <span>· escalated</span> : m.alert_sent_at && m.status === "to_order" ? <span>· alerted {fmtWhen(m.alert_sent_at)}</span> : null}
                  <SourceTag source={m.source} />
                </span>
                {perms.materials ? <MaterialEdit material={m} back={here} trades={cfg.trades} /> : null}
              </div>
              <div className="rowi__side">
                <MaterialStatusTag status={m.status} daysToOrder={days} />
                {!perms.materials ? null : m.status === "to_order" || m.status === "issue" ? (
                  <form action={materialStatusAction}>
                    <Hidden fields={{ id: m.id, status: "ordered", back: here }} />
                    <button className="tn-btn">{m.status === "issue" ? "Reordered" : "Mark ordered"}</button>
                  </form>
                ) : null}
                {perms.materials && m.status === "ordered" ? (
                  <>
                    <form action={materialStatusAction}>
                      <Hidden fields={{ id: m.id, status: "received", back: here }} />
                      <button className="tn-btn">Mark received</button>
                    </form>
                    <form action={materialStatusAction}>
                      <Hidden fields={{ id: m.id, status: "issue", back: here, note: "Problem on delivery" }} />
                      <button className="tn-btn tn-btn--quiet">Issue</button>
                    </form>
                  </>
                ) : null}
                {perms.materials && m.status === "received" ? (
                  <form action={materialStatusAction}>
                    <Hidden fields={{ id: m.id, status: "issue", back: here, note: "Problem found after delivery" }} />
                    <button className="tn-btn tn-btn--quiet">Issue</button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {perms.manage ? (
      <details className="card more">
        <summary>Add a material</summary>
        <form action={addMaterialAction} className="form" style={{ paddingTop: 8 }}>
          <Hidden fields={{ project_id: project.id, back: here }} />
          <div className="form-grid">
            <label className="tn-field"><span className="tn-label">Item</span><input className="tn-input" name="item" required placeholder="Pass box, SS" /></label>
            <label className="tn-field"><span className="tn-label">Trade</span>
              <select className="tn-input" name="trade" defaultValue={cfg.trades[0]}>{cfg.trades.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="tn-field"><span className="tn-label">Quantity</span><input className="tn-input" name="qty" inputMode="numeric" /></label>
            <label className="tn-field"><span className="tn-label">Unit</span><input className="tn-input" name="unit" placeholder="pcs" /></label>
            <label className="tn-field"><span className="tn-label">Lead time (days)</span><input className="tn-input" name="lead_time_days" inputMode="numeric" defaultValue="7" /></label>
            <label className="tn-field"><span className="tn-label">Needed on site</span><input className="tn-input" type="date" name="need_by" required /></label>
          </div>
          <div><button className="tn-btn"><Icon name="plus" />Add material</button></div>
        </form>
      </details>
      ) : null}
    </section>
  );
}
