import { MANAGERS, requirePage } from "@/lib/auth";
import Link from "next/link";
import { exceptionsFor, loadSnapshot, progressOf, type Exception } from "@/lib/insights";
import { fmtDate, fmtWhen, plural, today } from "@/lib/dates";
import { Clear, DayCounter, Flash, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { escalateAction, materialStatusAction, remindSupervisorAction } from "./actions";
import { headName } from "@/lib/config";

export const metadata = { title: "Today" };

function ExceptionAction({ e }: { e: Exception }) {
  if (e.kind === "order_overdue") {
    return (
      <div className="tn-exc__action">
        <form action={materialStatusAction}>
          <input type="hidden" name="id" value={e.materialId} />
          <input type="hidden" name="status" value="ordered" />
          <input type="hidden" name="back" value="/" />
          <button className="tn-btn">Mark ordered</button>
        </form>
        {!e.escalated ? (
          <form action={escalateAction}>
            <input type="hidden" name="id" value={e.materialId} />
            <input type="hidden" name="back" value="/" />
            <button className="tn-btn tn-btn--alert">Escalate</button>
          </form>
        ) : null}
      </div>
    );
  }
  if (e.kind === "order_soon" || e.kind === "material_issue") {
    return (
      <form action={materialStatusAction} className="tn-exc__action">
        <input type="hidden" name="id" value={e.materialId} />
        <input type="hidden" name="status" value="ordered" />
        <input type="hidden" name="back" value="/" />
        <button className="tn-btn">{e.kind === "material_issue" ? "Mark reordered" : "Mark ordered"}</button>
      </form>
    );
  }
  if (e.kind === "quiet_site") {
    return (
      <form action={remindSupervisorAction} className="tn-exc__action">
        <input type="hidden" name="project_id" value={e.projectId} />
        <input type="hidden" name="back" value="/" />
        <button className="tn-btn">Remind {e.person ?? "site"}</button>
      </form>
    );
  }
  return (
    <div className="tn-exc__action">
      <Link className="tn-btn tn-btn--quiet" href={`/projects/${e.projectId}?tab=${e.kind === "decision" ? "report" : "tasks"}`}>
        {e.kind === "decision" ? "Open report" : "Open tasks"}
      </Link>
    </div>
  );
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requirePage(...MANAGERS);
  const { msg } = await searchParams;
  const [snap, head] = await Promise.all([loadSnapshot(), headName()]);
  const t0 = today();
  const exceptions = exceptionsFor(snap, t0);
  const active = snap.projects.filter((p) => p.status !== "closed");
  const overdue = exceptions.filter((e) => e.severity === "overdue").length;
  const toOrderSoon = exceptions.filter((e) => e.kind === "order_soon").length;
  const quiet = exceptions.filter((e) => e.kind === "quiet_site").length;
  const sitesWithIssues = new Set(exceptions.map((e) => e.projectId));
  const healthy = active.filter((p) => !sitesWithIssues.has(p.id));

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <span className="tn-stamp">{fmtDate(t0)}</span>
          <h1 className="tn-title">{exceptions.length ? "Needs you today" : "Nothing needs you today"}</h1>
        </div>
        <Link href="/projects/new" className="tn-btn tn-btn--primary">
          <Icon name="plus" />
          New project
        </Link>
      </div>

      <div className="stats">
        <Link href="/inbox" className={`stat${snap.pendingTotal ? " stat--attention" : ""}`}>
          <span className="tn-stamp">To review</span>
          <span className="tn-data-lg">{snap.pendingTotal}</span>
          <span className="tn-caption">site updates waiting</span>
        </Link>
        <div className={`stat${overdue ? " stat--overdue" : ""}`}>
          <span className="tn-stamp">Overdue</span>
          <span className="tn-data-lg">{overdue}</span>
          <span className="tn-caption">orders or issues</span>
        </div>
        <div className={`stat${toOrderSoon ? " stat--attention" : ""}`}>
          <span className="tn-stamp">Order soon</span>
          <span className="tn-data-lg">{toOrderSoon}</span>
          <span className="tn-caption">within 2 days</span>
        </div>
        <div className={`stat${quiet ? " stat--attention" : ""}`}>
          <span className="tn-stamp">Quiet sites</span>
          <span className="tn-data-lg">{quiet}</span>
          <span className="tn-caption">of {plural(active.length, "active site")}</span>
        </div>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="tn-heading">Exceptions</h2>
          <span className="tn-caption">Overdue first, then oldest</span>
        </div>
        <div className="tn-list">
          {exceptions.length === 0 ? (
            <Clear>All sites are on track. Nothing needs you.</Clear>
          ) : (
            exceptions.map((e) => (
              <div key={e.key} className="tn-exc">
                <StatusTag tone={e.severity}>{e.tag}</StatusTag>
                <div className="tn-exc__main">
                  <p className="tn-exc__what">{e.what}</p>
                  <p className="tn-exc__meta">
                    {e.site}
                    {e.person ? ` · ${e.person}` : ""} · <span className="tn-data">{e.projectCode}</span>
                    {e.escalated ? ` · escalated to ${head}` : ""}
                  </p>
                </div>
                <ExceptionAction e={e} />
              </div>
            ))
          )}
          {snap.pendingTotal > 0 ? (
            <div className="tn-exc">
              <StatusTag tone="attention" icon="inbox">{plural(snap.pendingTotal, "update")}</StatusTag>
              <div className="tn-exc__main">
                <p className="tn-exc__what">Site updates waiting for review</p>
                <p className="tn-exc__meta">Nothing reaches the doctor until approved</p>
              </div>
              <div className="tn-exc__action">
                <Link href="/inbox" className="tn-btn">Review</Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="tn-heading">Sites</h2>
          <Link href="/projects" className="tn-caption">All projects</Link>
        </div>
        <div className="grid grid--2">
          {active.filter((p) => sitesWithIssues.has(p.id)).map((p) => {
            const tasks = snap.tasks.filter((t) => t.project_id === p.id);
            const ex = exceptions.filter((e) => e.projectId === p.id);
            const last = snap.lastUpdate.get(p.id);
            const sup = p.supervisor_id ? snap.people.get(p.supervisor_id)?.name : null;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="card pcard">
                <div className="pcard__top">
                  <div className="stack-2" style={{ gap: 2 }}>
                    <span className="tn-data tn-muted">{p.code}</span>
                    <span className="pcard__name">{p.name}</span>
                    <span className="tn-caption">{p.city}{sup ? ` · ${sup}` : ""}</span>
                  </div>
                </div>
                <DayCounter progress={progressOf(p, tasks, t0)} />
                <div className="pcard__flags">
                  {ex.some((e) => e.severity === "overdue") ? <StatusTag tone="overdue">{plural(ex.filter((e) => e.severity === "overdue").length, "overdue")}</StatusTag> : null}
                  {ex.some((e) => e.severity === "attention") ? <StatusTag tone="attention">{plural(ex.filter((e) => e.severity === "attention").length, "to watch", "to watch")}</StatusTag> : null}
                  {snap.pendingByProject.get(p.id) ? <StatusTag icon="inbox">{snap.pendingByProject.get(p.id)} to review</StatusTag> : null}
                </div>
                <span className="tn-caption">Last update {last ? fmtWhen(last) : "none yet"}</span>
              </Link>
            );
          })}
        </div>
        {healthy.length ? (
          <div className="rows" style={{ marginTop: 16 }}>
            {healthy.map((p) => {
              const prog = progressOf(p, snap.tasks.filter((t) => t.project_id === p.id), t0);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="healthy">
                  <Icon name="check" />
                  <span style={{ flex: 1 }}>
                    <span className="tn-body-strong">{p.city}</span>
                    <span className="tn-muted"> — nothing needs you</span>
                  </span>
                  <span className="tn-data tn-muted">{prog.day < 1 ? `Starts ${fmtDate(p.start_date)}` : `Day ${prog.day} / ${prog.planned}`}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
        {active.length === 0 ? (
          <div className="card empty">
            <span>No active projects.</span>
            <Link href="/projects/new" className="tn-btn">Plan a project</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
