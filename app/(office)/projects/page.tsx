import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDate, plural, today } from "@/lib/dates";
import { progressOf } from "@/lib/insights";
import type { Person, Project, Task } from "@/lib/types";
import { DayCounter, Flash, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const sb = db();
  const [pr, tr, pe] = await Promise.all([
    sb.from("projects").select("*").order("start_date", { ascending: false }),
    sb.from("tasks").select("project_id, status, planned_end"),
    sb.from("people").select("id, name"),
  ]);
  const projects = (pr.data ?? []) as Project[];
  const tasks = (tr.data ?? []) as Pick<Task, "project_id" | "status" | "planned_end">[];
  const names = new Map(((pe.data ?? []) as Pick<Person, "id" | "name">[]).map((p) => [p.id, p.name]));
  const t0 = today();
  const open = projects.filter((p) => p.status !== "closed");
  const closed = projects.filter((p) => p.status === "closed");

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">Projects</h1>
          <p className="tn-muted">{plural(open.length, "active site")} · {closed.length} closed</p>
        </div>
        <Link href="/projects/new" className="tn-btn tn-btn--primary"><Icon name="plus" />New project</Link>
      </div>
      <div className="grid grid--2">
        {open.map((p) => {
          const prog = progressOf(p, tasks.filter((t) => t.project_id === p.id), t0);
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="card pcard">
              <div className="stack-2" style={{ gap: 2 }}>
                <span className="tn-data tn-muted">{p.code}</span>
                <span className="pcard__name">{p.name}</span>
                <span className="tn-caption">
                  {p.city} · {p.supervisor_id ? names.get(p.supervisor_id) : "No supervisor"} · {p.doctor_id ? names.get(p.doctor_id) : "No doctor"}
                </span>
              </div>
              <DayCounter progress={prog} />
              <span className="tn-caption">{prog.doneTasks} of {plural(prog.totalTasks, "task")} done{p.status === "handover" ? " · in handover" : ""}</span>
            </Link>
          );
        })}
      </div>
      {closed.length ? (
        <section className="section">
          <div className="section__head">
            <h2 className="tn-heading">Closed</h2>
            <span className="tn-caption">Tensor learns lead times and extra tasks from these</span>
          </div>
          <div className="rows">
            {closed.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="healthy">
                <StatusTag>Closed</StatusTag>
                <span style={{ flex: 1 }}><span className="tn-body-strong">{p.name}</span> <span className="tn-muted">· {p.city}</span></span>
                <span className="tn-data tn-muted">{p.code} · {fmtDate(p.start_date)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
