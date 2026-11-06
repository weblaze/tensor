import { MANAGERS, requirePage } from "@/lib/auth";
import Link from "next/link";
import { db, signedUrls } from "@/lib/db";
import { fmtShort, fmtTime, fmtWhen, istDate, plural } from "@/lib/dates";
import { autopilotMeter, getAutopilot } from "@/lib/routing";
import type { Person, Project, SuggestedAction, Update } from "@/lib/types";
import { Flash } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { ReviewItem } from "./ReviewCard";
import { InboxList } from "./InboxList";
import { Shortcuts } from "./Shortcuts";
import { autopilotAction, reopenUpdateAction } from "../actions";
import { headName } from "@/lib/config";

export const metadata = { title: "Inbox" };


async function actionLabels(updates: Update[]): Promise<Map<string, string>> {
  const matIds = updates.map((u) => u.suggested_action).filter((a): a is Extract<SuggestedAction, { type: "material_status" }> => a?.type === "material_status").map((a) => a.material_id);
  const taskIds = updates.map((u) => u.suggested_action).filter((a): a is Extract<SuggestedAction, { type: "task_status" }> => a?.type === "task_status").map((a) => a.task_id);
  const [mats, tasks] = await Promise.all([
    matIds.length ? db().from("materials").select("id, item").in("id", matIds) : Promise.resolve({ data: [] }),
    taskIds.length ? db().from("tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [] }),
  ]);
  const mName = new Map(((mats.data ?? []) as { id: string; item: string }[]).map((m) => [m.id, m.item]));
  const tName = new Map(((tasks.data ?? []) as { id: string; title: string }[]).map((t) => [t.id, t.title]));
  const out = new Map<string, string>();
  for (const u of updates) {
    const a = u.suggested_action;
    if (!a) continue;
    if (a.type === "material_status" && mName.has(a.material_id)) {
      out.set(u.id, `Mark ${mName.get(a.material_id)} as ${a.status === "issue" ? "issue" : a.status}${a.note ? ` · ${a.note}` : ""}`);
    } else if (a.type === "task_status" && tName.has(a.task_id)) {
      out.set(u.id, `Mark ${tName.get(a.task_id)} ${a.status === "doing" ? "in progress" : a.status}`);
    } else if (a.type === "phase_done") {
      out.set(u.id, `Mark every ${a.phase} task done`);
    }
  }
  return out;
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requirePage(...MANAGERS);
  const { msg } = await searchParams;
  const sb = db();
  const [pendingRes, reviewedRes, projRes, peopleRes, meter, autopilot, head] = await Promise.all([
    sb.from("updates").select("*").eq("status", "pending").order("received_at", { ascending: true }).limit(50),
    sb.from("updates").select("*").neq("status", "pending").not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(8),
    sb.from("projects").select("*").neq("status", "closed"),
    sb.from("people").select("id, name"),
    autopilotMeter(),
    getAutopilot(),
    headName(),
  ]);
  const pending = (pendingRes.data ?? []) as Update[];
  const reviewed = (reviewedRes.data ?? []) as Update[];
  const projects = new Map(((projRes.data ?? []) as Project[]).map((p) => [p.id, p]));
  const names = new Map(((peopleRes.data ?? []) as Pick<Person, "id" | "name">[]).map((p) => [p.id, p.name]));
  const [urls, labels] = await Promise.all([signedUrls(pending.map((u) => u.media_path)), actionLabels(pending)]);

  // Issues first, then oldest.
  pending.sort((a, b) => Number(!a.project_id) - Number(!b.project_id) || Number(b.is_issue) - Number(a.is_issue) || a.received_at.localeCompare(b.received_at));

  const items: ReviewItem[] = pending.map((u) => {
    const p = u.project_id ? projects.get(u.project_id) : undefined;
    const offeredIds = u.offered_project_ids?.length ? u.offered_project_ids : [...projects.keys()];
    return {
      id: u.id,
      kind: u.kind,
      note: u.note ?? u.raw_text ?? (u.kind === "photo" ? "Photo from site" : "Update from site"),
      raw: u.raw_text,
      transcript: u.transcript,
      trade: u.trade,
      zone: u.zone,
      isIssue: u.is_issue,
      suggested: u.suggested_routes ?? [],
      confidence: u.ai_confidence,
      actionLabel: labels.get(u.id) ?? null,
      site: p ? `${p.name}, ${p.city}` : null,
      code: p?.code ?? null,
      who: u.person_id ? names.get(u.person_id) ?? null : null,
      when: fmtWhen(u.received_at),
      stamp: `${fmtShort(istDate(u.received_at))} ${fmtTime(u.received_at)} · ${p?.city ?? "Unfiled"}`,
      mediaUrl: u.media_path ? urls.get(u.media_path) ?? null : null,
      lat: u.lat,
      lng: u.lng,
      offered: p ? undefined : offeredIds.map((id) => projects.get(id)).filter((x): x is Project => !!x).map((x) => ({ id: x.id, label: `${x.city} · ${x.name}` })),
    };
  });

  const ready = meter.pct !== null && meter.reviewed >= 20 && meter.pct >= 85;

  return (
    <main className="page">
      <Shortcuts />
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">{items.length ? `${plural(items.length, "update")} to review` : "Inbox clear"}</h1>
          <p className="tn-muted">Check where each site update goes. One click sends it.</p>
        </div>
        {items.length ? <span className="tn-caption hide-sm">Keys: <span className="kbd">A</span> approve top · <span className="kbd">H</span> hold top</span> : null}
      </div>

      <div className="split">
        <div className="stack-4">
          <InboxList items={items} headName={head} />

          {reviewed.length ? (
            <section className="section">
              <div className="section__head"><h2 className="tn-heading">Recently reviewed</h2></div>
              <div className="rows">
                {reviewed.map((u) => {
                  const p = u.project_id ? projects.get(u.project_id) : undefined;
                  const changed = u.status === "approved" && [...(u.final_routes ?? [])].sort().join() !== [...u.suggested_routes].sort().join();
                  return (
                    <div key={u.id} className="rowi">
                      <div className="rowi__main">
                        <span className="rowi__title">{u.note ?? u.raw_text}</span>
                        <span className="rowi__meta">
                          <span>{p?.city ?? "Unfiled"}</span>
                          <span>·</span>
                          <span>{u.status === "held" ? "Held" : (u.final_routes ?? []).length ? `To ${(u.final_routes ?? []).map((r) => (r === "head" ? head : r === "doctor" ? "Doctor" : "Procurement")).join(", ")}` : "Filed only"}</span>
                          {u.auto_routed ? <span className="src">Autopilot</span> : null}
                          {changed ? <span className="tn-caption">· you changed the routes</span> : null}
                          <span>· {fmtWhen(u.reviewed_at)}</span>
                        </span>
                      </div>
                      <div className="rowi__side">
                        <form action={reopenUpdateAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="back" value="/inbox" />
                          <button className="tn-btn tn-btn--quiet">Reopen</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="card stack-4" aria-labelledby="autopilot-h">
          <div className="stack-2">
            <span className="tn-stamp">Autopilot meter</span>
            <h2 id="autopilot-h" className="tn-heading">Suggestions accepted unchanged</h2>
          </div>
          <div className="meter">
            <span className="tn-data-lg">{meter.pct === null ? "—" : `${meter.pct}%`}</span>
            <div className="meter__track" role="img" aria-label={`${meter.pct ?? 0} percent accepted`}>
              <div className="meter__fill" style={{ width: `${meter.pct ?? 0}%` }} />
              <div className="meter__mark" style={{ left: "85%" }} title="85%: ready for autopilot" />
            </div>
            <span className="tn-caption">
              {meter.accepted} of the last {plural(meter.reviewed, "review")}. Autopilot is worth trying above 85% over 20 or more reviews.
            </span>
          </div>
          <form action={autopilotAction} className="stack-4">
            <input type="hidden" name="back" value="/inbox" />
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={autopilot.enabled} />
              <span className="tn-body-strong">Route confident updates on their own</span>
            </label>
            <label className="tn-field">
              <span className="tn-label">Only when Tensor is at least</span>
              <select className="tn-input" name="min_confidence" defaultValue={String(autopilot.min_confidence)}>
                {[0.8, 0.85, 0.9, 0.95].map((v) => <option key={v} value={v}>{Math.round(v * 100)}% sure</option>)}
              </select>
              <span className="tn-help">{autopilot.enabled ? "On. Less confident updates still wait here." : ready ? "Accuracy is high enough to switch on." : "Off. Every update waits for you."}</span>
            </label>
            <button className="tn-btn">
              <Icon name="check" />
              Save autopilot
            </button>
          </form>
          <p className="tn-caption">
            Tensor learns from your last 15 decisions. <Link href="/settings">Settings</Link>
          </p>
        </aside>
      </div>
    </main>
  );
}
