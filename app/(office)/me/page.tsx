import Link from "next/link";
import { canManage, requirePage, type Viewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { diffDays, fmtDate, fmtDue, fmtShort, fmtWhen, plural, today } from "@/lib/dates";
import { progressOf } from "@/lib/insights";
import { channel } from "@/lib/messaging";
import { getAutopilot } from "@/lib/routing";
import { configOf, nextStatus, statusLabel } from "@/lib/templateConfig";
import type { Decision, Material, Project, Task, Update } from "@/lib/types";
import { Clear, DayCounter, Flash, MaterialStatusTag, StatusTag, TradeTag } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";
import { Icon } from "@/components/Icon";
import { materialStatusAction, taskStatusAction } from "../actions";
import { ChangePassphrase } from "./ChangePassphrase";
import { SendUpdate } from "./SendUpdate";

export const metadata = { title: "My work" };

function Hidden({ fields }: { fields: Record<string, string> }) {
  return <>{Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

const ROUTE_WORD: Record<string, string> = { doctor: "the doctor", procurement: "procurement", head: "the head" };

function Account({ viewer }: { viewer: Viewer }) {
  const p = viewer.person;
  if (!p) {
    return (
      <section className="card stack-4">
        <h2 className="tn-heading">Shared office login</h2>
        <p className="tn-muted">You are signed in with the shared office passphrase. Give each person their own login from People, so Tensor knows who approved what.</p>
        <div><Link href="/people" className="tn-btn"><Icon name="users" />People</Link></div>
      </section>
    );
  }
  const link = channel().linkUrl(p.link_code);
  return (
    <section className="card stack-4">
      <h2 className="tn-heading">My account</h2>
      <dl className="kv">
        <dt>Name</dt><dd>{p.name}</dd>
        <dt>Username</dt><dd className="tn-data">{p.username}</dd>
        <dt>Telegram</dt><dd>{p.telegram_chat_id ? "Linked" : <>Not linked · send <span className="tn-data">/start {p.link_code}</span> to the bot</>}</dd>
      </dl>
      {!p.telegram_chat_id && link ? <CopyLink value={link} label="Telegram link" /> : null}
      <ChangePassphrase />
    </section>
  );
}

async function SupervisorView({ viewer }: { viewer: Viewer }) {
  const me = viewer.person!;
  const sb = db();
  const { data: pr } = await sb.from("projects").select("*").in("status", ["active", "handover"]);
  const projects = ((pr ?? []) as Project[]).filter((p) => p.supervisor_id === me.id || p.id === me.current_project_id);
  const ids = projects.map((p) => p.id);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [tr, ur, autopilot] = await Promise.all([
    ids.length ? sb.from("tasks").select("*").in("project_id", ids).neq("status", "done").order("planned_start") : Promise.resolve({ data: [] }),
    sb.from("updates").select("*").eq("person_id", me.id).gte("received_at", since).order("received_at", { ascending: false }).limit(40),
    getAutopilot(),
  ]);
  const tasks = (tr.data ?? []) as Task[];
  const updates = (ur.data ?? []) as Update[];
  const t0 = today();
  const reviewed = updates.filter((u) => u.status !== "pending");
  const unchanged = reviewed.filter((u) => u.status === "approved" && [...(u.final_routes ?? [])].sort().join() === [...u.suggested_routes].sort().join()).length;
  const auto = updates.filter((u) => u.auto_routed).length;
  const site = new Map(projects.map((p) => [p.id, p]));

  return (
    <>
      <section className="section">
        <div className="section__head"><h2 className="tn-heading">My sites</h2></div>
        {projects.length === 0 ? <div className="tn-list"><Clear>No site is assigned to you yet. The office will add you to one.</Clear></div> : (
          <div className="stack-4">
            {projects.map((p) => {
              const cfg = configOf(p);
              const mine = tasks.filter((t) => t.project_id === p.id);
              const now = mine.filter((t) => t.status === "doing" || t.status === "blocked" || t.planned_start <= t0 || diffDays(t.planned_start, t0) <= 3).slice(0, 8);
              return (
                <div key={p.id} className="card stack-4">
                  <div className="row-between">
                    <div className="stack-2" style={{ gap: 2 }}>
                      <span className="tn-data tn-muted">{p.code}</span>
                      <Link href={`/projects/${p.id}?tab=tasks`} className="pcard__name" style={{ color: "var(--ink)", textDecoration: "none" }}>{p.name}</Link>
                      <span className="tn-caption">{p.city}</span>
                    </div>
                    <div style={{ minWidth: 240, flex: "0 1 360px" }}><DayCounter progress={progressOf(p, mine, t0)} /></div>
                  </div>
                  <div className="rows">
                    {now.length === 0 ? <Clear>Nothing due in the next few days.</Clear> : now.map((t) => {
                      const late = diffDays(t0, t.planned_end);
                      const next = nextStatus(cfg, t.status, t.status_label);
                      return (
                        <div key={t.id} className="rowi">
                          <div className="rowi__main">
                            <span className="rowi__title">{t.title}</span>
                            <span className="rowi__meta">
                              <TradeTag trade={t.trade} />
                              <span className="tn-data">{fmtShort(t.planned_start)} – {fmtShort(t.planned_end)}</span>
                            </span>
                          </div>
                          <div className="rowi__side">
                            {t.status === "blocked" ? <StatusTag tone="overdue">{statusLabel(cfg, t.status, t.status_label)}</StatusTag>
                              : late > 0 ? <StatusTag tone="attention">Late {plural(late, "day")}</StatusTag>
                              : <StatusTag icon={t.status === "doing" ? "bolt" : "clock"}>{statusLabel(cfg, t.status, t.status_label)}</StatusTag>}
                            {next ? (
                              <form action={taskStatusAction}>
                                <Hidden fields={{ id: t.id, status: next.kind, label: next.label, back: "/me" }} />
                                <button className="tn-btn">{next.label}</button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="split section">
        <section className="stack-4">
          <div className="section__head" style={{ marginBottom: 0 }}><h2 className="tn-heading">My updates</h2><span className="tn-caption">Last 30 days</span></div>
          <div className="rows">
            {updates.length === 0 ? <div className="empty">Nothing sent yet. Send a photo and a line from Telegram or below.</div> : updates.map((u) => (
              <div key={u.id} className="rowi">
                <div className="rowi__main">
                  <span className="rowi__title">{u.note ?? u.raw_text ?? "Photo from site"}</span>
                  <span className="rowi__meta">
                    <span>{u.project_id ? site.get(u.project_id)?.city ?? "Site" : "Not filed yet"}</span>
                    <span>· {fmtWhen(u.received_at)}</span>
                    {u.status === "approved" && (u.final_routes ?? []).length ? <span>· sent to {(u.final_routes ?? []).map((r) => ROUTE_WORD[r]).join(", ")}</span> : null}
                  </span>
                </div>
                <div className="rowi__side">
                  {u.status === "pending" ? <StatusTag icon="clock">Waiting</StatusTag>
                    : u.status === "held" ? <StatusTag tone="attention" icon="pause">Held</StatusTag>
                    : u.auto_routed ? <StatusTag icon="bolt">Autopilot</StatusTag>
                    : <StatusTag>Approved</StatusTag>}
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="stack-4">
          <SendUpdate sites={projects.map((p) => ({ id: p.id, label: `${p.city} · ${p.name}` }))} />
          <section className="card stack-4">
            <div className="stack-2">
              <span className="tn-stamp">Autopilot</span>
              <h2 className="tn-heading">{autopilot.enabled ? "On" : "Off"}</h2>
              <p className="tn-muted">
                {autopilot.enabled
                  ? `Updates Tensor is at least ${Math.round(autopilot.min_confidence * 100)}% sure about go out without waiting for the office.`
                  : "The office checks every update before it goes to anyone."}
              </p>
            </div>
            <dl className="kv">
              <dt>Sent</dt><dd className="tn-data">{updates.length}</dd>
              <dt>Reviewed</dt><dd className="tn-data">{reviewed.length}</dd>
              <dt>Sorted right</dt><dd className="tn-data">{reviewed.length ? `${Math.round((unchanged / reviewed.length) * 100)}%` : "—"}</dd>
              <dt>By autopilot</dt><dd className="tn-data">{auto}</dd>
            </dl>
            <p className="tn-caption">“Sorted right” is how often the office kept Tensor's suggestion for your updates unchanged.</p>
          </section>
        </aside>
      </div>
    </>
  );
}

async function ProcurementView() {
  const sb = db();
  const { data: pr } = await sb.from("projects").select("id, code, name, city").in("status", ["active", "handover"]);
  const projects = (pr ?? []) as Pick<Project, "id" | "code" | "name" | "city">[];
  const site = new Map(projects.map((p) => [p.id, p]));
  const ids = projects.map((p) => p.id);
  const { data: mr } = ids.length
    ? await sb.from("materials").select("*").in("project_id", ids).in("status", ["to_order", "ordered", "issue"]).order("order_by")
    : { data: [] };
  const materials = (mr ?? []) as Material[];
  const t0 = today();
  const groups: [string, Material[]][] = [
    ["Problems", materials.filter((m) => m.status === "issue")],
    ["To order", materials.filter((m) => m.status === "to_order")],
    ["On the way", materials.filter((m) => m.status === "ordered")],
  ];
  return (
    <section className="section stack-4">
      {groups.map(([title, list]) => (
        <div key={title} className="stack-2">
          <div className="section__head" style={{ marginBottom: 0 }}><h2 className="tn-heading">{title}</h2><span className="tn-caption">{list.length}</span></div>
          <div className="rows">
            {list.length === 0 ? <Clear>Nothing here.</Clear> : list.map((m) => {
              const p = site.get(m.project_id);
              return (
                <div key={m.id} className="rowi">
                  <div className="rowi__main">
                    <span className="rowi__title">{m.item}{m.qty ? <span className="tn-data tn-muted"> · {m.qty} {m.unit}</span> : null}</span>
                    <span className="rowi__meta">
                      <Link href={`/projects/${m.project_id}?tab=materials`} style={{ color: "inherit" }}>{p?.city} · {p?.code}</Link>
                      <span>· order by <span className="tn-data">{fmtShort(m.order_by)}</span> ({fmtDue(m.order_by, t0)})</span>
                      <span>· need <span className="tn-data">{fmtShort(m.need_by)}</span></span>
                      {m.vendor ? <span>· {m.vendor}</span> : null}
                      {m.note ? <span>· {m.note}</span> : null}
                    </span>
                  </div>
                  <div className="rowi__side">
                    <MaterialStatusTag status={m.status} daysToOrder={diffDays(m.order_by, t0)} />
                    {m.status === "ordered" ? (
                      <form action={materialStatusAction}><Hidden fields={{ id: m.id, status: "received", back: "/me" }} /><button className="tn-btn">Mark received</button></form>
                    ) : (
                      <form action={materialStatusAction}><Hidden fields={{ id: m.id, status: "ordered", back: "/me" }} /><button className="tn-btn">{m.status === "issue" ? "Reordered" : "Mark ordered"}</button></form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

async function DoctorView({ viewer }: { viewer: Viewer }) {
  const sb = db();
  const { data: pr } = await sb.from("projects").select("*").eq("doctor_id", viewer.person!.id);
  const projects = (pr ?? []) as Project[];
  const ids = projects.map((p) => p.id);
  const [tr, dr] = await Promise.all([
    ids.length ? sb.from("tasks").select("project_id, status, planned_end").in("project_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("decisions").select("*").in("project_id", ids).is("answer", null) : Promise.resolve({ data: [] }),
  ]);
  const tasks = (tr.data ?? []) as Pick<Task, "project_id" | "status" | "planned_end">[];
  const decisions = (dr.data ?? []) as Decision[];
  return (
    <section className="section stack-4">
      {projects.length === 0 ? <div className="tn-list"><Clear>No clinic is linked to you yet.</Clear></div> : projects.map((p) => {
        const open = decisions.filter((d) => d.project_id === p.id);
        return (
          <div key={p.id} className="card stack-4">
            <div className="stack-2" style={{ gap: 2 }}>
              <span className="pcard__name">{p.name}</span>
              <span className="tn-caption">{p.city} · started {fmtDate(p.start_date)}</span>
            </div>
            <DayCounter progress={progressOf(p, tasks.filter((t) => t.project_id === p.id))} eyebrow="Your clinic build" />
            {open.length ? <StatusTag tone="attention">{plural(open.length, "decision")} waiting for you</StatusTag> : null}
            <div><Link href={`/r/${p.report_token}`} className="tn-btn tn-btn--primary"><Icon name="file" />Open today&apos;s report</Link></div>
          </div>
        );
      })}
    </section>
  );
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const viewer = await requirePage();
  const manage = canManage(viewer);
  const first = viewer.name.split(" ")[0];
  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <span className="tn-stamp">{fmtDate(today())}</span>
          <h1 className="tn-title">{viewer.person ? `Hello, ${first}` : "My work"}</h1>
        </div>
        {manage ? <Link href="/" className="tn-btn"><Icon name="home" />Today</Link> : null}
      </div>
      {viewer.role === "supervisor" ? <SupervisorView viewer={viewer} /> : null}
      {viewer.role === "procurement" ? <ProcurementView /> : null}
      {viewer.role === "doctor" ? <DoctorView viewer={viewer} /> : null}
      {manage ? (
        <section className="tn-list" style={{ marginBottom: 24 }}>
          <Clear>Your work is on Today and in the Inbox.</Clear>
        </section>
      ) : null}
      <div className="section" style={{ maxWidth: 560 }}>
        <Account viewer={viewer} />
      </div>
    </main>
  );
}
