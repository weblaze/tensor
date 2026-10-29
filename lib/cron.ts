import "server-only";
import { db } from "./db";
import { addDays, fmtShort, fmtDue, istHour, today } from "./dates";
import { loadSnapshot, quietDays } from "./insights";
import { notifyPerson, notifyRole, peopleByRole } from "./notify";
import { sendReport } from "./report";
import type { Material, Project } from "./types";

export interface CronSummary {
  at: string;
  alerts: number;
  escalations: number;
  reports: { project: string; status: string; count: number }[];
  quietSites: string[];
}

/**
 * Daily checks. Safe to run hourly: each step marks what it sent so nothing repeats.
 * - Procurement alert: to_order, order-by within 2 days, not yet alerted.
 * - Escalation to head: alerted more than 24 h ago and still to_order.
 * - Doctor report: from 9 PM India time (or forced), once per day, only if there are approved items.
 * - Quiet sites: from 6 PM (or forced), once per day, to the coordinator.
 */
export async function runDailyChecks(opts: { force?: boolean } = {}): Promise<CronSummary> {
  const sb = db();
  const t0 = today();
  const hour = istHour();
  const summary: CronSummary = { at: new Date().toISOString(), alerts: 0, escalations: 0, reports: [], quietSites: [] };

  const { data: projData } = await sb.from("projects").select("*").eq("status", "active");
  const projects = (projData ?? []) as Project[];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const ids = projects.map((p) => p.id);
  if (!ids.length) return summary;

  // 1. Procurement alerts, grouped per project so Anil gets one message per site.
  const { data: dueData } = await sb.from("materials").select("*").in("project_id", ids).eq("status", "to_order")
    .lte("order_by", addDays(t0, 2)).is("alert_sent_at", null).order("order_by");
  const due = (dueData ?? []) as Material[];
  const dueByProject = new Map<string, Material[]>();
  due.forEach((m) => dueByProject.set(m.project_id, [...(dueByProject.get(m.project_id) ?? []), m]));
  for (const [pid, items] of dueByProject) {
    const p = byId.get(pid)!;
    const lines = items.map((m) => `• ${m.item}${m.qty ? ` (${m.qty} ${m.unit ?? ""})`.replace(" )", ")") : ""} · order ${fmtDue(m.order_by, t0)} (${fmtShort(m.order_by)})`);
    await notifyRole(
      "procurement",
      "procurement_alert",
      [`Order now · ${p.code} ${p.name}, ${p.city}`, ...lines, "Tap Ordered when done. Not ordered in 24 hours goes to Prashant."].join("\n"),
      { projectId: pid, buttons: items.slice(0, 8).map((m) => [{ text: `Ordered: ${m.item}`.slice(0, 60), data: `ord:${m.id}` }]) },
    );
    await sb.from("materials").update({ alert_sent_at: new Date().toISOString() }).in("id", items.map((m) => m.id));
    summary.alerts += items.length;
  }

  // 2. Escalation after 24 h unacknowledged.
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: escData } = await sb.from("materials").select("*").in("project_id", ids).eq("status", "to_order")
    .lt("alert_sent_at", cutoff).is("escalated_at", null);
  const esc = (escData ?? []) as Material[];
  for (const m of esc) {
    const p = byId.get(m.project_id)!;
    await notifyRole("head", "escalation", `Escalated · ${p.code} ${p.name}, ${p.city}\n${m.item} not ordered. Order-by was ${fmtShort(m.order_by)}; procurement was alerted over 24 hours ago.`, { projectId: p.id });
    await sb.from("materials").update({ escalated_at: new Date().toISOString() }).eq("id", m.id);
    summary.escalations++;
  }

  // 3. Nightly doctor report.
  if (opts.force || hour >= 21) {
    for (const p of projects) {
      if (p.last_report_sent_on === t0) continue;
      const r = await sendReport(p.id);
      summary.reports.push({ project: p.code, status: r.status, count: r.count });
    }
  }

  // 4. Quiet sites, once a day to the coordinator.
  if (opts.force || hour >= 18) {
    const snap = await loadSnapshot();
    const quiet = snap.projects.filter((p) => p.status === "active" && p.start_date <= t0 && quietDays(snap.lastUpdate.get(p.id), t0) !== null);
    if (quiet.length) {
      const { data: sentToday } = await sb.from("notifications").select("id").eq("kind", "quiet_sites").gte("created_at", `${t0}T00:00:00+05:30`).limit(1);
      if (!sentToday?.length) {
        const coordinators = await peopleByRole("coordinator");
        const body = `Quiet sites today\n${quiet.map((p) => `• ${p.code} ${p.name}, ${p.city} · ${snap.people.get(p.supervisor_id ?? "")?.name ?? "no supervisor"}`).join("\n")}\nCall the supervisor or send a reminder from Tensor.`;
        for (const c of coordinators) await notifyPerson(c, "quiet_sites", body);
      }
      summary.quietSites = quiet.map((p) => p.code);
    }
  }

  return summary;
}
