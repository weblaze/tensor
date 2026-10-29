import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasDb } from "@/lib/db";
import { fmtDate, fmtShort, fmtTime, istDate, plural } from "@/lib/dates";
import { getReport } from "@/lib/report";
import { DayCounter, Mark, Photo, StatusTag, TradeTag, ZoneTag, stampFor } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { answerDecisionAction } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  if (!hasDb()) return { title: "Site report" };
  const r = await getReport(token);
  return { title: r ? `${r.project.name} · site report` : "Site report", robots: { index: false, follow: false } };
}

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string; trade?: string; answered?: string }>;
}) {
  const { token } = await params;
  const { date, trade, answered } = await searchParams;
  if (!hasDb() || !/^[\w-]{8,64}$/.test(token)) notFound();
  const r = await getReport(token, date);
  if (!r) notFound();

  const base = `/r/${token}`;
  const q = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const all = { date: r.date, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) sp.set(k, v);
    return `${base}?${sp.toString()}`;
  };
  const shown = trade ? r.entries.filter((e) => e.trade === trade) : r.entries;
  const open = r.decisions.filter((d) => !d.answer);
  const answeredList = r.decisions.filter((d) => d.answer).slice(0, 3);
  const doctorName = r.doctor?.name ?? "Doctor";

  return (
    <main className="report">
      <div className="report__brand">
        <span className="brand" style={{ fontSize: 16 }}>
          <Mark size={20} />
          <span>Tensor</span>
        </span>
        <span className="tn-caption">Design Matrix · {r.project.code}</span>
      </div>

      {answered ? (
        <div className="flash" role="status">
          <Icon name="check" />
          <span>{answered === "approved" ? "Thank you. Your approval is recorded and the team will proceed." : "Noted. The coordinator will call you to discuss the change."}</span>
        </div>
      ) : null}

      <header className="report__head">
        <span className="tn-stamp">Site report · {fmtDate(r.date)}</span>
        <h1 className="tn-display">{r.project.name}</h1>
        <p className="tn-muted">{r.project.city} · prepared for {doctorName}</p>
      </header>

      <DayCounter progress={r.progress} eyebrow="Your clinic build" />

      <div className="report__counts">
        <div><span className="tn-data-lg">{r.entries.length}</span><span className="tn-caption">{r.entries.length === 1 ? "update" : "updates"}</span></div>
        <div><span className="tn-data-lg">{r.photos}</span><span className="tn-caption">photos</span></div>
        <div><span className="tn-data-lg">{r.trades.length}</span><span className="tn-caption">{r.trades.length === 1 ? "trade" : "trades"} at work</span></div>
      </div>

      {open.length ? (
        <section className="card decision" aria-labelledby="dec-h" style={{ borderColor: "var(--signal)" }}>
          <div className="stack-2">
            <span className="tn-stamp" style={{ color: "var(--signal)" }}>Needs your decision</span>
            <h2 id="dec-h" className="tn-heading">{plural(open.length, "question")} from the team</h2>
          </div>
          {open.map((d) => (
            <form key={d.id} action={answerDecisionAction.bind(null, "approved")} className="stack-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="date" value={date ?? ""} />
              <p className="tn-body-strong">{d.question}</p>
              <span className="tn-caption">Asked {fmtShort(istDate(d.asked_at))}</span>
              <label className="tn-field">
                <span className="tn-label">Note for the team (optional)</span>
                <input className="tn-input" name="note" placeholder="Anything you want changed" maxLength={500} />
              </label>
              <div className="decision__buttons">
                <button className="tn-btn tn-btn--primary"><Icon name="check" />Approve</button>
                <button className="tn-btn" formAction={answerDecisionAction.bind(null, "change")}><Icon name="refresh" />Request change</button>
              </div>
            </form>
          ))}
        </section>
      ) : null}

      <section className="stack-4" aria-labelledby="today-h">
        <div className="row-between">
          <h2 id="today-h" className="tn-heading">{r.entries.length ? "What happened on site" : "No updates for this day"}</h2>
        </div>
        {r.trades.length > 1 ? (
          <nav className="report__filters" aria-label="Filter by trade">
            <Link href={q({})} aria-current={!trade ? "true" : undefined}>All</Link>
            {r.trades.map((t) => <Link key={t} href={q({ trade: t })} aria-current={trade === t ? "true" : undefined}>{t}</Link>)}
          </nav>
        ) : null}
        {r.entries.length === 0 ? (
          <p className="tn-muted">The site team has not shared approved updates for {fmtDate(r.date)} yet. The report updates through the day and is sent around 9 PM.</p>
        ) : null}
        {shown.map((e) => (
          <article key={e.id} className="tn-entry">
            <div className="tn-entry__head">
              <span className="tn-entry__num">{String(e.num).padStart(2, "0")}</span>
              <TradeTag trade={e.trade} />
              <ZoneTag zone={e.zone} />
              <span className="tn-entry__time">{fmtTime(e.time)}</span>
            </div>
            <Photo url={e.mediaUrl} kind={e.kind} stamp={stampFor(e.time, r.project.city)} alt={e.note} />
            <p className="tn-entry__note">{e.note}</p>
            <p className="tn-entry__who">{e.who ?? "Site team"} · {r.project.city}</p>
          </article>
        ))}
      </section>

      {r.nextSteps.length ? (
        <section className="card stack-4">
          <h2 className="tn-heading">Coming up next</h2>
          <div className="milestones">
            {r.nextSteps.map((t) => (
              <div key={t.id} className="milestone">
                <Icon name={t.status === "doing" ? "bolt" : "calendar"} />
                <span style={{ flex: 1 }}>{t.title}</span>
                <span className="tn-data tn-muted">{t.status === "doing" ? "Under way" : fmtShort(t.planned_start)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card stack-4">
        <div className="stack-2">
          <h2 className="tn-heading">Critical zone milestones</h2>
          <p className="tn-caption">OT, embryology lab, cryostorage and collection rooms</p>
        </div>
        <div className="milestones">
          {r.milestones.map((t) => (
            <div key={t.id} className="milestone">
              {t.status === "done" ? <StatusTag>Done</StatusTag> : t.status === "doing" ? <StatusTag icon="bolt">Under way</StatusTag> : <StatusTag icon="calendar">{fmtShort(t.planned_start)}</StatusTag>}
              <span style={{ flex: 1, color: t.status === "done" ? "var(--ink-muted)" : undefined }}>{t.title}</span>
            </div>
          ))}
        </div>
      </section>

      {answeredList.length ? (
        <section className="stack-2">
          <h2 className="tn-heading">Your recent decisions</h2>
          {answeredList.map((d) => (
            <p key={d.id} className="tn-muted">
              {d.question} · {d.answer === "approved" ? "you approved" : "you asked for a change"}{d.answered_at ? ` on ${fmtShort(istDate(d.answered_at))}` : ""}
            </p>
          ))}
        </section>
      ) : null}

      <nav className="report__days no-print" aria-label="Other days">
        {r.prevDate ? <Link className="tn-btn tn-btn--quiet" href={`${base}?date=${r.prevDate}`}><Icon name="back" />{fmtShort(r.prevDate)}</Link> : <span />}
        {r.nextDate ? <Link className="tn-btn tn-btn--quiet" href={`${base}?date=${r.nextDate}`}>{fmtShort(r.nextDate)} →</Link> : <span />}
      </nav>

      <p className="report__foot">
        Photos carry the time and site they were taken. Questions? Call your Design Matrix coordinator.
      </p>
    </main>
  );
}
