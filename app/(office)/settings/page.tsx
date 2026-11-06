import Link from "next/link";
import { db } from "@/lib/db";
import { demoMode, headName } from "@/lib/config";
import { fmtWhen } from "@/lib/dates";
import { aiConfigured } from "@/lib/ai";
import { channel } from "@/lib/messaging";
import { autopilotMeter, getAutopilot } from "@/lib/routing";
import type { Notification, Person } from "@/lib/types";
import { Flash, StatusTag } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { autopilotAction, resetDemoAction, runChecksAction } from "../actions";

export const metadata = { title: "Settings" };

const KIND_WORD: Record<string, string> = {
  procurement_alert: "Procurement alert",
  escalation: "Escalation",
  doctor_report: "Doctor report",
  update_procurement: "Update to procurement",
  update_head: "Update to the head",
  quiet_sites: "Quiet sites",
  reminder: "Reminder",
  material_issue: "Material issue",
  decision: "Decision",
  test: "Test",
  decision_answer: "Doctor answered",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const sb = db();
  const [ap, meter, nr, pr, head] = await Promise.all([
    getAutopilot(),
    autopilotMeter(),
    sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
    sb.from("people").select("id, name"),
    headName(),
  ]);
  const demo = demoMode();
  const outbox = (nr.data ?? []) as Notification[];
  const names = new Map(((pr.data ?? []) as Pick<Person, "id" | "name">[]).map((p) => [p.id, p.name]));
  const integrations = [
    { name: "Database", ok: true, detail: "Supabase, Mumbai region" },
    { name: "Telegram bot", ok: channel().configured(), detail: channel().configured() ? `@${process.env.TELEGRAM_BOT_USERNAME ?? "bot"}` : "Add TELEGRAM_BOT_TOKEN; messages are logged below meanwhile" },
    { name: "AI (Gemini)", ok: aiConfigured(), detail: aiConfigured() ? (process.env.GEMINI_MODEL || "gemini-2.5-flash") : "Not set; keyword rules sort updates" },
  ];

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">Settings</h1>
          <p className="tn-muted">Autopilot, daily checks, templates and messages.</p>
        </div>
      </div>

      <div className="grid grid--2">
        <section className="card stack-4">
          <div className="stack-2">
            <span className="tn-stamp">Routing</span>
            <h2 className="tn-heading">Autopilot</h2>
            <p className="tn-muted">
              Tensor suggests where each update goes and the coordinator confirms. When suggestions are reliably right, let confident ones go on their own.
            </p>
          </div>
          <p>
            <span className="tn-data-lg">{meter.pct === null ? "—" : `${meter.pct}%`}</span>{" "}
            <span className="tn-caption">accepted unchanged, last {meter.reviewed} reviews</span>
          </p>
          <form action={autopilotAction} className="stack-4">
            <input type="hidden" name="back" value="/settings" />
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={ap.enabled} />
              <span className="tn-body-strong">Autopilot on</span>
            </label>
            <label className="tn-field">
              <span className="tn-label">Minimum confidence</span>
              <select className="tn-input" name="min_confidence" defaultValue={String(ap.min_confidence)}>
                {[0.8, 0.85, 0.9, 0.95].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
              </select>
              <span className="tn-help">Nothing reaches the doctor without approval while autopilot is off.</span>
            </label>
            <div><button className="tn-btn tn-btn--primary"><Icon name="check" />Save</button></div>
          </form>
        </section>

        <section className="card stack-4">
          <div className="stack-2">
            <span className="tn-stamp">Every hour</span>
            <h2 className="tn-heading">Daily checks</h2>
            <p className="tn-muted">
              Procurement alerts 2 days before order-by, escalation to {head} after 24 hours, quiet-site reminders from 6 PM and the doctor report at 9 PM.
            </p>
          </div>
          <form action={runChecksAction}>
            <input type="hidden" name="back" value="/settings" />
            <button className="tn-btn"><Icon name="refresh" />Run daily checks now</button>
          </form>
          <p className="tn-caption">Running now also sends tonight&apos;s doctor reports for sites with approved updates.</p>

          <div className="stack-2" style={{ marginTop: 8 }}>
            <span className="tn-stamp">Connections</span>
            {integrations.map((i) => (
              <div key={i.name} className="row-between">
                <span className="tn-body-strong">{i.name}</span>
                <span className="tn-row">
                  <span className="tn-caption">{i.detail}</span>
                  {i.ok ? <StatusTag>Connected</StatusTag> : <StatusTag tone="attention">Not set</StatusTag>}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="tn-heading">Messages sent</h2>
          <span className="tn-caption">Last 30. “Not sent” means the person has not linked Telegram yet.</span>
        </div>
        <div className="rows">
          {outbox.length === 0 ? <div className="empty">No messages yet.</div> : outbox.map((n) => (
            <div key={n.id} className="rowi">
              <div className="rowi__main">
                <span className="rowi__meta">
                  <span className="tn-body-strong" style={{ color: "var(--ink)" }}>{KIND_WORD[n.kind] ?? n.kind}</span>
                  <span>to {n.person_id ? names.get(n.person_id) ?? "someone" : "someone"}</span>
                  <span>· {fmtWhen(n.created_at)}</span>
                </span>
                <span className="outbox-body">{n.body}</span>
              </div>
              <div className="rowi__side">
                {n.status === "sent" ? <StatusTag icon="send">Sent</StatusTag> : n.status === "failed" ? <StatusTag tone="overdue">Failed</StatusTag> : <StatusTag tone="attention" icon="clock">Not sent</StatusTag>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="card row-between">
          <div className="stack-2">
            <span className="tn-stamp">Planning</span>
            <h2 className="tn-heading">Project templates</h2>
            <p className="tn-muted">The tasks, materials and lead times new projects start from.</p>
          </div>
          <Link href="/settings/templates" className="tn-btn"><Icon name="file" />Edit templates</Link>
        </div>
      </section>

      {demo ? (
      <section className="section">
        <div className="card stack-4" style={{ maxWidth: 560 }}>
          <div className="stack-2">
            <span className="tn-stamp">Demo</span>
            <h2 className="tn-heading">Reset demo data</h2>
            <p className="tn-muted">Puts back the four demo sites with dates relative to today. Telegram links and link codes are kept. Everything else is replaced.</p>
          </div>
          <form action={resetDemoAction} className="tn-row">
            <label className="tn-field" style={{ flex: 1 }}>
              <span className="tn-label">Type RESET to confirm</span>
              <input className="tn-input" name="confirm" autoComplete="off" />
            </label>
            <button className="tn-btn" style={{ alignSelf: "flex-end" }}><Icon name="refresh" />Reset demo</button>
          </form>
        </div>
      </section>
      ) : null}
    </main>
  );
}
