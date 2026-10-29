"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, diffDays, fmtShort, plural } from "@/lib/dates";
import type { PlanMaterial, PlanPreview, PlanTask } from "@/lib/planner";
import { createProjectAction, previewPlanAction } from "../../actions";
import { Icon } from "@/components/Icon";

interface Opt { id: string; name: string }

export function Planner(props: {
  templates: { id: string; name: string; days: number; description: string | null }[];
  doctors: Opt[];
  supervisors: Opt[];
  coordinators: Opt[];
  today: string;
  defaultStart: string;
  aiLabel: string;
}) {
  const first = props.templates[0];
  const [templateId, setTemplateId] = useState(first?.id ?? "");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [supervisorId, setSupervisorId] = useState(props.supervisors[0]?.id ?? "");
  const [coordinatorId, setCoordinatorId] = useState(props.coordinators[0]?.id ?? "");
  const [startDate, setStartDate] = useState(props.defaultStart);
  const [plannedDays, setPlannedDays] = useState(first?.days ?? 45);
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function load(useAi: boolean) {
    if (!templateId) return;
    setError(null);
    startLoading(async () => {
      const res = await previewPlanAction({ templateId, notes, useAi, plannedDays });
      if ("error" in res) setError(res.error);
      else {
        setPlan(res);
        setExcluded(new Set());
      }
    });
  }

  // Load the template plan on open and when the template changes.
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const toggle = (key: string) => setExcluded((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });

  const tasks = plan?.tasks ?? [];
  const materials = plan?.materials ?? [];
  const phases = useMemo(() => [...new Set(tasks.map((t) => t.phase))], [tasks]);
  const keptTasks = tasks.filter((t) => !excluded.has(t.key));
  const keptMaterials = materials.filter((m) => !excluded.has(m.key));
  const lateOrders = keptMaterials.filter((m) => diffDays(addDays(startDate, m.need_day - m.lead_time_days), props.today) < 0);
  const suggestions = tasks.filter((t) => t.source !== "template").length + materials.filter((m) => m.source !== "template").length;

  function submit() {
    setError(null);
    startSaving(async () => {
      const res = await createProjectAction({
        name, city, templateId, doctorId, supervisorId, coordinatorId, startDate, plannedDays, orderNotes: notes,
        tasks: keptTasks, materials: keptMaterials,
      });
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div className="stack-4">
      <section className="card form">
        <h2 className="tn-heading">Order</h2>
        <div className="form-grid">
          <label className="tn-field">
            <span className="tn-label">Template</span>
            <select className="tn-input" value={templateId} onChange={(e) => {
              setTemplateId(e.target.value);
              const t = props.templates.find((x) => x.id === e.target.value);
              if (t) setPlannedDays(t.days);
            }}>
              {props.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="tn-field">
            <span className="tn-label">Clinic name</span>
            <input className="tn-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shree IVF" required />
          </label>
          <label className="tn-field">
            <span className="tn-label">City</span>
            <input className="tn-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Muzaffarpur" required />
          </label>
          <label className="tn-field">
            <span className="tn-label">Doctor</span>
            <select className="tn-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Add later</option>
              {props.doctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="tn-field">
            <span className="tn-label">Supervisor</span>
            <select className="tn-input" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
              <option value="">Add later</option>
              {props.supervisors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="tn-field">
            <span className="tn-label">Coordinator</span>
            <select className="tn-input" value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)}>
              <option value="">None</option>
              {props.coordinators.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="tn-field">
            <span className="tn-label">Start date</span>
            <input className="tn-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="tn-field">
            <span className="tn-label">Planned days</span>
            <input className="tn-input" inputMode="numeric" value={plannedDays} onChange={(e) => setPlannedDays(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} />
            <span className="tn-help">Handover {fmtShort(addDays(startDate, plannedDays - 1))}</span>
          </label>
        </div>
        <label className="tn-field">
          <span className="tn-label">Order notes</span>
          <textarea className="tn-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="First floor. Existing AC to be removed. Cryostorage room needs extra power point." />
          <span className="tn-help">Tensor can read these and suggest extra tasks or materials, using {props.aiLabel}.</span>
        </label>
        <div>
          <button type="button" className="tn-btn" onClick={() => load(true)} disabled={loading || !notes.trim()}>
            <Icon name="bolt" />
            {loading ? "Reading notes" : "Suggest from notes"}
          </button>
        </div>
      </section>

      <section className="card stack-4">
        <div className="row-between">
          <div className="stack-2" style={{ gap: 2 }}>
            <h2 className="tn-heading">Plan</h2>
            <span className="tn-caption">
              {loading ? "Building plan" : `${plural(keptTasks.length, "task")} · ${plural(keptMaterials.length, "material")}${suggestions ? ` · ${plural(suggestions, "suggestion")} marked` : ""}`}
            </span>
          </div>
          <span className="tn-caption">Untick anything you do not need.</span>
        </div>

        {lateOrders.length ? (
          <div className="flash flash--warn" style={{ margin: 0 }}>
            <Icon name="alert" />
            <span>{plural(lateOrders.length, "order-by date")} already passed for this start date. Order {lateOrders.map((m) => m.item).join(", ")} today, or move the start.</span>
          </div>
        ) : null}

        <h3 className="tn-stamp">Tasks</h3>
        <div className="rows">
          {phases.map((ph) => (
            <div key={ph} style={{ display: "contents" }}>
              <div className="rows__group"><span className="tn-body-strong">{ph}</span></div>
              {tasks.filter((t) => t.phase === ph).map((t) => <TaskRow key={t.key} t={t} start={startDate} off={excluded.has(t.key)} onToggle={() => toggle(t.key)} />)}
            </div>
          ))}
          {!tasks.length ? <div className="empty">{loading ? "Loading" : "Pick a template"}</div> : null}
        </div>

        <h3 className="tn-stamp">Materials · order-by = needed on site − lead time</h3>
        <div className="rows">
          {materials.map((m) => <MaterialRow key={m.key} m={m} start={startDate} today={props.today} off={excluded.has(m.key)} onToggle={() => toggle(m.key)} />)}
        </div>
      </section>

      {error ? <div className="flash flash--error"><Icon name="alert" /><span>{error}</span></div> : null}
      <div className="row-between">
        <span className="tn-caption">The supervisor&apos;s Telegram updates go to this site once it starts.</span>
        <button type="button" className="tn-btn tn-btn--primary" onClick={submit} disabled={saving || loading || !name.trim() || !city.trim() || !plan}>
          <Icon name="check" />
          {saving ? "Creating" : "Create project"}
        </button>
      </div>
    </div>
  );
}

function Suggest({ source, why }: { source: PlanTask["source"]; why?: string }) {
  if (source === "template" || source === "manual") return null;
  return (
    <>
      <span className={`src${source === "ai" ? " src--ai" : ""}`}>{source === "ai" ? "AI" : "Learned"}</span>
      {why ? <span>{why}</span> : null}
    </>
  );
}

function TaskRow({ t, start, off, onToggle }: { t: PlanTask; start: string; off: boolean; onToggle: () => void }) {
  const s = addDays(start, t.start_day);
  const e = addDays(s, t.duration_days - 1);
  return (
    <label className={`rowi${off ? " rowi--done" : ""}`} style={{ cursor: "pointer", gridTemplateColumns: "auto minmax(0,1fr)" }}>
      <input type="checkbox" checked={!off} onChange={onToggle} style={{ width: 20, height: 20, accentColor: "var(--scrub)" }} />
      <span className="rowi__main">
        <span className="rowi__title" style={off ? { textDecoration: "line-through" } : undefined}>{t.title}</span>
        <span className="rowi__meta">
          <span className="tn-tag tn-tag--trade">{t.trade}</span>
          <span className={`tn-zone tn-zone--${t.zone}`}>{t.zone === "critical" ? "Critical" : "General"}</span>
          <span className="tn-data">{s === e ? fmtShort(s) : `${fmtShort(s)} – ${fmtShort(e)}`}</span>
          <Suggest source={t.source} why={t.why} />
        </span>
      </span>
    </label>
  );
}

function MaterialRow({ m, start, today, off, onToggle }: { m: PlanMaterial; start: string; today: string; off: boolean; onToggle: () => void }) {
  const need = addDays(start, m.need_day);
  const orderBy = addDays(need, -m.lead_time_days);
  const late = diffDays(orderBy, today) < 0;
  return (
    <label className={`rowi${off ? " rowi--done" : ""}`} style={{ cursor: "pointer", gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
      <input type="checkbox" checked={!off} onChange={onToggle} style={{ width: 20, height: 20, accentColor: "var(--scrub)" }} />
      <span className="rowi__main">
        <span className="rowi__title" style={off ? { textDecoration: "line-through" } : undefined}>
          {m.item}{m.qty ? <span className="tn-data tn-muted"> · {m.qty} {m.unit}</span> : null}
        </span>
        <span className="rowi__meta">
          <span className="tn-tag tn-tag--trade">{m.trade}</span>
          <span>need <span className="tn-data">{fmtShort(need)}</span></span>
          <span>· lead <span className="tn-data">{m.lead_time_days}d</span>{m.source === "learned" && m.template_lead_days ? <span className="tn-muted"> (was {m.template_lead_days}d)</span> : null}</span>
          <Suggest source={m.source} why={m.source === "ai" ? m.why : undefined} />
        </span>
      </span>
      <span className="rowi__side">
        {late ? (
          <span className="tn-tag tn-tag--overdue"><Icon name="alert" size="sm" />Order by {fmtShort(orderBy)}</span>
        ) : (
          <span className="tn-tag"><Icon name="calendar" size="sm" />Order by {fmtShort(orderBy)}</span>
        )}
      </span>
    </label>
  );
}
