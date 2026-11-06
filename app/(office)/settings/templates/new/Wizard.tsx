"use client";
import { useEffect, useState, useTransition } from "react";
import { createTemplateFromWizardAction, type WizardTemplate } from "../actions";
import { FIELD_SUGGESTIONS, IVF_EXAMPLE, PHASE_SUGGESTIONS, TRADE_SUGGESTIONS } from "@/lib/examples";
import { DEFAULT_CONFIG, KIND_HELP, type StatusKind } from "@/lib/templateConfig";
import { Icon } from "@/components/Icon";

const DRAFT_KEY = "tensor.setupWizard.draft";

type Data = WizardTemplate;

const EMPTY: Data = {
  name: "",
  description: "",
  days: 45,
  phases: DEFAULT_CONFIG.phases.slice(0, 4),
  statuses: DEFAULT_CONFIG.task_statuses.map((s) => ({ ...s })),
  trades: ["Civil", "Electrical", "Plumbing", "Coordination"],
  zones: { critical: "Critical", general: "General" },
  fields: [],
  tasks: [],
  materials: [],
};

interface Step {
  title: string;
  question: string;
  why: string;
  tips: string[];
}

const STEPS: Step[] = [
  {
    title: "Your template",
    question: "What do you build, and how long does a typical job take?",
    why: "A template is your office's usual way of doing a job. Every new project starts as a copy, so the coordinator only changes what is different this time.",
    tips: ["Name it so anyone in the office knows when to use it, e.g. “IVF clinic — standard fit-out”.", "Use the length of an ordinary job. Each project can still be longer or shorter."],
  },
  {
    title: "Phases",
    question: "Into how many stages do you split a job, and what do you call them?",
    why: "Phases group tasks, so a long plan reads in chunks, and a supervisor can say “phase 1 complete” in one line. They also show the client how far along the build is.",
    tips: ["Four to seven phases is usual.", "Put them in the order they happen; you can reorder with the arrows.", "Use the words your site team already says."],
  },
  {
    title: "Task statuses",
    question: "How many states can a task be in, and what do you call each?",
    why: "Your team marks tasks with these words. Tensor needs to know what each one means: not started, going on, finished, or stuck. That is how it works out what is late and what needs attention.",
    tips: ["Keep it short: three to five states.", "You need at least one “not started” and one “finished” state.", "Two states can share a meaning, e.g. “Material on site” and “Work going on” both mean in progress."],
  },
  {
    title: "Trades and teams",
    question: "Which trades or teams do the work?",
    why: "Every task, material and site update is tagged with a trade, so the office and the client can filter by it and procurement knows whose material it is.",
    tips: ["List the teams you hire or employ, not every skill.", "Keep one for office or coordination work."],
  },
  {
    title: "Zones",
    question: "Do you separate high-risk areas from the rest?",
    why: "Tensor marks each task and update with one of two zones and colours them apart, so work in sensitive rooms (an OT, a lab, a server room) stands out in reports.",
    tips: ["Name the zones the way your client would understand them.", "If you don't separate areas, call them “Main” and “Other” and use one."],
  },
  {
    title: "Project details and contacts",
    question: "Does every project need a point of contact, or other details recorded?",
    why: "These become fields on every new project. Required ones must be filled before the project can be created, so nobody is left without a client phone number on day one.",
    tips: ["A client contact and their phone number are the usual minimum.", "“Person” fields let you pick from the people in Tensor."],
  },
  {
    title: "Tasks",
    question: "What work happens on a usual job, and when?",
    why: "These are the tasks every new project starts with. Days count from the project start, so Tensor can turn them into real dates for any start date and show what is late.",
    tips: ["Start from the example and delete what you don't do.", "Rough days are fine; each project can adjust them.", "Tasks you add by hand on two jobs are suggested for the next one."],
  },
  {
    title: "Materials",
    question: "What do you usually order, how long does it take to arrive, and when is it needed?",
    why: "Tensor works out the order-by date from the day a material is needed and how long the supplier takes, then alerts procurement two days before. Over time it learns real delivery times from your own orders.",
    tips: ["Lead time = days from placing the order to the material reaching site.", "Only list items that are ordered for each job."],
  },
  {
    title: "Review",
    question: "Check it over and save.",
    why: "You can change any of this later from Settings → Templates. Projects already running keep the setup they started with.",
    tips: ["After saving, plan your first project from this template."],
  },
];

function ListEditor({ values, onChange, suggestions, placeholder, label }: { values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string; label: string }) {
  const set = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= values.length) return;
    const next = [...values];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const unused = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="stack-4">
      <label className="tn-field" style={{ maxWidth: 200 }}>
        <span className="tn-label">How many {label}?</span>
        <input className="tn-input" type="number" min={1} max={20} value={values.length} onChange={(e) => {
          const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
          onChange(n > values.length ? [...values, ...Array.from({ length: n - values.length }, (_, k) => unused[k] ?? "")] : values.slice(0, n));
        }} />
      </label>
      <div className="rows">
        {values.map((v, i) => (
          <div key={i} className="rowi wiz-row wiz-row--list">
            <span className="tn-data tn-muted">{i + 1}</span>
            <input className="tn-input" value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} aria-label={`${label} ${i + 1}`} />
            <span className="rowi__side">
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => move(i, 1)} disabled={i === values.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => onChange(values.filter((_, j) => j !== i))} disabled={values.length === 1} aria-label="Remove"><Icon name="x" /></button>
            </span>
          </div>
        ))}
      </div>
      {unused.length ? (
        <div className="stack-2">
          <span className="tn-caption">Add a common one:</span>
          <div className="chips">
            {unused.slice(0, 10).map((s) => (
              <button key={s} type="button" className="tn-btn" onClick={() => onChange([...values.filter(Boolean), s])}><Icon name="plus" size="sm" />{s}</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function validate(step: number, d: Data): string | null {
  if (step === 0 && !d.name.trim()) return "Give the template a name.";
  if (step === 1 && !d.phases.some((p) => p.trim())) return "Add at least one phase.";
  if (step === 2) {
    const named = d.statuses.filter((s) => s.label.trim());
    if (!named.some((s) => s.kind === "todo")) return "One status must mean “not started”.";
    if (!named.some((s) => s.kind === "done")) return "One status must mean “finished”.";
    if (new Set(named.map((s) => s.label.trim().toLowerCase())).size !== named.length) return "Two statuses have the same name.";
  }
  if (step === 3 && !d.trades.some((t) => t.trim())) return "Add at least one trade or team.";
  if (step === 5 && d.fields.some((f) => !f.label.trim())) return "Name every detail field, or remove the empty one.";
  return null;
}

export function Wizard({ tutorial: tutorialDefault, initialName, templateId, initial }: { tutorial: boolean; initialName: string; templateId?: string; initial?: Data }) {
  const draftKey = `${DRAFT_KEY}.${templateId ?? "new"}`;
  const [step, setStep] = useState(0);
  const [tutorial, setTutorial] = useState(tutorialDefault);
  const [d, setD] = useState<Data>(initial ?? { ...EMPTY, name: initialName });
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const [restored, setRestored] = useState(false);

  // Keep a draft in this browser so a closed tab doesn't lose the work.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw && !initialName) {
        const saved = JSON.parse(raw) as { d: Data; step: number };
        setD(saved.d);
        setStep(saved.step);
        setRestored(true);
      }
    } catch { /* storage blocked: start fresh */ }
  }, [initialName, draftKey]);
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ d, step })); } catch { /* ignore */ }
  }, [d, step, draftKey]);

  const s = STEPS[step];
  const patch = (p: Partial<Data>) => setD((x) => ({ ...x, ...p }));
  const phases = d.phases.map((p) => p.trim()).filter(Boolean);
  const trades = d.trades.map((t) => t.trim()).filter(Boolean);

  function next() {
    const problem = validate(step, d);
    if (problem) return setError(problem);
    setError(null);
    setStep((x) => Math.min(STEPS.length - 1, x + 1));
    window.scrollTo({ top: 0 });
  }

  function useExampleTasks() {
    const fit = (ph: string) => (phases.includes(ph) ? ph : phases[0]);
    const tr = (t: string) => (trades.includes(t) ? t : trades[0]);
    patch({ tasks: IVF_EXAMPLE.tasks.map((t) => ({ ...t, phase: fit(t.phase), trade: tr(t.trade), start_day: Math.min(t.start_day, d.days), duration_days: t.duration_days })) });
  }
  function useExampleMaterials() {
    const tr = (t: string) => (trades.includes(t) ? t : trades[0]);
    patch({ materials: IVF_EXAMPLE.materials.map((m) => ({ ...m, trade: tr(m.trade), need_day: Math.min(m.need_day, d.days) })) });
  }
  function useWholeExample() {
    setD({
      name: d.name || IVF_EXAMPLE.name,
      description: IVF_EXAMPLE.description,
      days: IVF_EXAMPLE.days,
      phases: [...DEFAULT_CONFIG.phases],
      statuses: DEFAULT_CONFIG.task_statuses.map((x) => ({ ...x })),
      trades: [...DEFAULT_CONFIG.trades],
      zones: { ...IVF_EXAMPLE.zones },
      fields: IVF_EXAMPLE.fields.map((f) => ({ ...f })),
      tasks: IVF_EXAMPLE.tasks.map((t) => ({ ...t })),
      materials: IVF_EXAMPLE.materials.map((m) => ({ ...m })),
    });
  }

  function save() {
    for (let i = 0; i < STEPS.length - 1; i++) {
      const problem = validate(i, d);
      if (problem) { setStep(i); return setError(problem); }
    }
    setError(null);
    start(async () => {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      const res = await createTemplateFromWizardAction({
        ...d,
        phases,
        trades,
        statuses: d.statuses.filter((x) => x.label.trim()),
        fields: d.fields.filter((f) => f.label.trim()),
      }, templateId);
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div className="stack-4">
      <div className="card stack-4">
        <div className="row-between">
          <span className="tn-stamp">Step {step + 1} of {STEPS.length} · {s.title}</span>
          <label className="check" style={{ minHeight: 0 }}>
            <input type="checkbox" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} />
            <span className="tn-caption">Show explanations</span>
          </label>
        </div>
        <div className="tn-day__track" aria-hidden="true">
          {STEPS.map((_, i) => <span key={i} className={`tn-day__seg${i <= step ? " tn-day__seg--done" : ""}`} />)}
        </div>
        <h1 className="tn-title">{s.question}</h1>
        {tutorial ? (
          <div className="review__action" style={{ gap: 8 }}>
            <span className="tn-stamp">Why this matters</span>
            <p>{s.why}</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{s.tips.map((t) => <li key={t} className="tn-muted">{t}</li>)}</ul>
          </div>
        ) : null}
        {restored && step > 0 ? <p className="tn-caption">Picked up where you left off. <button type="button" className="tn-btn tn-btn--quiet" onClick={() => { setD(initial ?? EMPTY); setStep(0); setRestored(false); }}>Start over</button></p> : null}
      </div>

      <section className="card stack-4">
        {step === 0 ? (
          <div className="form">
            <label className="tn-field"><span className="tn-label">Template name</span><input className="tn-input" value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="IVF clinic — standard fit-out" autoFocus /></label>
            <label className="tn-field"><span className="tn-label">What kind of job is it for?</span><input className="tn-input" value={d.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Turnkey IVF clinic with OT, lab and reception" /></label>
            <label className="tn-field" style={{ maxWidth: 240 }}><span className="tn-label">Usual length in days</span><input className="tn-input" type="number" min={1} max={730} value={d.days} onChange={(e) => patch({ days: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <div className="review__action">
              <span className="tn-body-strong">In a hurry?</span>
              <span className="tn-caption">Fill every step with Design Matrix&apos;s IVF fit-out, then change what is different for you.</span>
              <div><button type="button" className="tn-btn" onClick={useWholeExample}><Icon name="bolt" />Use the IVF example</button></div>
            </div>
          </div>
        ) : null}

        {step === 1 ? <ListEditor label="phases" values={d.phases} onChange={(phases) => patch({ phases })} suggestions={PHASE_SUGGESTIONS} placeholder="Phase name" /> : null}

        {step === 2 ? (
          <div className="stack-4">
            <label className="tn-field" style={{ maxWidth: 200 }}>
              <span className="tn-label">How many statuses?</span>
              <input className="tn-input" type="number" min={2} max={8} value={d.statuses.length} onChange={(e) => {
                const n = Math.max(2, Math.min(8, Number(e.target.value) || 2));
                patch({ statuses: n > d.statuses.length ? [...d.statuses, ...Array.from({ length: n - d.statuses.length }, () => ({ label: "", kind: "doing" as StatusKind }))] : d.statuses.slice(0, n) });
              }} />
            </label>
            <div className="rows">
              {d.statuses.map((st, i) => (
                <div key={i} className="rowi wiz-row wiz-row--status">
                  <span className="tn-data tn-muted">{i + 1}</span>
                  <input className="tn-input" value={st.label} placeholder="What your team calls it" aria-label={`Status ${i + 1} name`} onChange={(e) => patch({ statuses: d.statuses.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <select className="tn-input" value={st.kind} aria-label={`Status ${i + 1} meaning`} onChange={(e) => patch({ statuses: d.statuses.map((x, j) => (j === i ? { ...x, kind: e.target.value as StatusKind } : x)) })}>
                    {(Object.keys(KIND_HELP) as StatusKind[]).map((k) => <option key={k} value={k}>{KIND_HELP[k]}</option>)}
                  </select>
                  <button type="button" className="tn-btn tn-btn--quiet" aria-label="Remove" disabled={d.statuses.length <= 2} onClick={() => patch({ statuses: d.statuses.filter((_, j) => j !== i) })}><Icon name="x" /></button>
                </div>
              ))}
            </div>
            <p className="tn-caption">On a task, the one-tap button moves to the next status in this order (stuck states are skipped).</p>
          </div>
        ) : null}

        {step === 3 ? <ListEditor label="trades" values={d.trades} onChange={(trades) => patch({ trades })} suggestions={TRADE_SUGGESTIONS} placeholder="Trade or team" /> : null}

        {step === 4 ? (
          <div className="form-grid">
            <label className="tn-field"><span className="tn-label">Sensitive areas are called</span><input className="tn-input" value={d.zones.critical} onChange={(e) => patch({ zones: { ...d.zones, critical: e.target.value } })} placeholder="Critical" /><span className="tn-help">Shown in green, e.g. OT, embryology lab</span></label>
            <label className="tn-field"><span className="tn-label">Everything else is called</span><input className="tn-input" value={d.zones.general} onChange={(e) => patch({ zones: { ...d.zones, general: e.target.value } })} placeholder="General" /><span className="tn-help">Shown in stone, e.g. reception, waiting</span></label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="stack-4">
            <div className="tn-row">
              <span className="tn-body-strong">Does every project need a point of contact?</span>
              <button type="button" className="tn-btn" onClick={() => patch({ fields: [...d.fields.filter((f) => !/client contact/i.test(f.label)), { label: "Client contact person", kind: "text", required: true }, { label: "Client contact phone", kind: "phone", required: true }] })}>Yes, add contact and phone</button>
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => patch({ fields: d.fields.filter((f) => !/client contact/i.test(f.label)) })}>No</button>
            </div>
            <div className="rows">
              {d.fields.length === 0 ? <div className="empty">No extra details. Projects will only ask for name, city, people and dates.</div> : d.fields.map((f, i) => (
                <div key={i} className="rowi wiz-row wiz-row--field">
                  <input className="tn-input" value={f.label} placeholder="Detail name" aria-label={`Detail ${i + 1}`} onChange={(e) => patch({ fields: d.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <select className="tn-input" value={f.kind} aria-label="Kind" onChange={(e) => patch({ fields: d.fields.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof f.kind } : x)) })}>
                    <option value="text">Text</option><option value="phone">Phone number</option><option value="person">Person in Tensor</option><option value="date">Date</option>
                  </select>
                  <label className="check"><input type="checkbox" checked={f.required} onChange={(e) => patch({ fields: d.fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} /><span>Required</span></label>
                  <button type="button" className="tn-btn tn-btn--quiet" aria-label="Remove" onClick={() => patch({ fields: d.fields.filter((_, j) => j !== i) })}><Icon name="x" /></button>
                </div>
              ))}
            </div>
            <div className="chips">
              {FIELD_SUGGESTIONS.filter((x) => !d.fields.some((f) => f.label === x)).map((x) => (
                <button key={x} type="button" className="tn-btn" onClick={() => patch({ fields: [...d.fields, { label: x, kind: /phone/i.test(x) ? "phone" : "text", required: false }] })}><Icon name="plus" size="sm" />{x}</button>
              ))}
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => patch({ fields: [...d.fields, { label: "", kind: "text", required: false }] })}><Icon name="plus" size="sm" />Other</button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="stack-4">
            <div className="tn-row">
              <button type="button" className="tn-btn" onClick={useExampleTasks}><Icon name="bolt" />Fill with the IVF example</button>
              <span className="tn-caption">{d.tasks.length} tasks · days count from 1 (the start)</span>
            </div>
            <div className="rows">
              {phases.map((ph) => {
                const list = d.tasks.map((t, i) => ({ t, i })).filter((x) => x.t.phase === ph);
                return (
                  <div key={ph} style={{ display: "contents" }}>
                    <div className="rows__group">
                      <span className="tn-body-strong">{ph}</span>
                      <button type="button" className="tn-btn tn-btn--quiet" onClick={() => patch({ tasks: [...d.tasks, { phase: ph, title: "", trade: trades[0], zone: "general", start_day: 1, duration_days: 1 }] })}><Icon name="plus" size="sm" />Task</button>
                    </div>
                    {list.map(({ t, i }) => {
                      const up = (p: Partial<typeof t>) => patch({ tasks: d.tasks.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                      return (
                        <div key={i} className="rowi wiz-row wiz-row--task">
                          <input className="tn-input" value={t.title} placeholder="Task" aria-label="Task" onChange={(e) => up({ title: e.target.value })} />
                          <select className="tn-input" value={t.trade} aria-label="Trade" onChange={(e) => up({ trade: e.target.value })}>{[...new Set([...trades, t.trade])].map((x) => <option key={x}>{x}</option>)}</select>
                          <select className="tn-input" value={t.zone} aria-label="Zone" onChange={(e) => up({ zone: e.target.value as "critical" | "general" })}><option value="critical">{d.zones.critical || "Critical"}</option><option value="general">{d.zones.general || "General"}</option></select>
                          <input className="tn-input" type="number" min={1} value={t.start_day} aria-label="Starts on day" title="Starts on day" onChange={(e) => up({ start_day: Number(e.target.value) || 1 })} />
                          <input className="tn-input" type="number" min={1} value={t.duration_days} aria-label="Days" title="Days" onChange={(e) => up({ duration_days: Number(e.target.value) || 1 })} />
                          <button type="button" className="tn-btn tn-btn--quiet" aria-label="Remove" onClick={() => patch({ tasks: d.tasks.filter((_, j) => j !== i) })}><Icon name="x" /></button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="tn-caption">Columns: task · trade · zone · starts on day · number of days.</p>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="stack-4">
            <div className="tn-row">
              <button type="button" className="tn-btn" onClick={useExampleMaterials}><Icon name="bolt" />Fill with the IVF example</button>
              <button type="button" className="tn-btn tn-btn--quiet" onClick={() => patch({ materials: [...d.materials, { item: "", trade: trades[0], qty: null, unit: "", lead_time_days: 7, need_day: 1 }] })}><Icon name="plus" size="sm" />Material</button>
            </div>
            <div className="rows">
              {d.materials.length === 0 ? <div className="empty">No materials yet.</div> : d.materials.map((m, i) => {
                const up = (p: Partial<typeof m>) => patch({ materials: d.materials.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                return (
                  <div key={i} className="rowi wiz-row wiz-row--mat">
                    <input className="tn-input" value={m.item} placeholder="Item" aria-label="Item" onChange={(e) => up({ item: e.target.value })} />
                    <select className="tn-input" value={m.trade} aria-label="Trade" onChange={(e) => up({ trade: e.target.value })}>{[...new Set([...trades, m.trade])].map((x) => <option key={x}>{x}</option>)}</select>
                    <input className="tn-input" type="number" value={m.qty ?? ""} placeholder="Qty" aria-label="Quantity" onChange={(e) => up({ qty: e.target.value === "" ? null : Number(e.target.value) })} />
                    <input className="tn-input" value={m.unit} placeholder="Unit" aria-label="Unit" onChange={(e) => up({ unit: e.target.value })} />
                    <input className="tn-input" type="number" min={0} value={m.lead_time_days} aria-label="Lead time in days" title="Lead time (days)" onChange={(e) => up({ lead_time_days: Number(e.target.value) || 0 })} />
                    <input className="tn-input" type="number" min={1} value={m.need_day} aria-label="Needed on day" title="Needed on day" onChange={(e) => up({ need_day: Number(e.target.value) || 1 })} />
                    <button type="button" className="tn-btn tn-btn--quiet" aria-label="Remove" onClick={() => patch({ materials: d.materials.filter((_, j) => j !== i) })}><Icon name="x" /></button>
                  </div>
                );
              })}
            </div>
            <p className="tn-caption">Columns: item · trade · quantity · unit · lead time in days · needed on day. Order-by = needed day − lead time.</p>
          </div>
        ) : null}

        {step === 8 ? (
          <dl className="kv">
            <dt>Name</dt><dd>{d.name || "—"}{d.description ? ` · ${d.description}` : ""}</dd>
            <dt>Length</dt><dd>{d.days} days</dd>
            <dt>Phases</dt><dd>{phases.join(" → ")}</dd>
            <dt>Statuses</dt><dd>{d.statuses.filter((x) => x.label.trim()).map((x) => `${x.label} (${KIND_HELP[x.kind].toLowerCase()})`).join(", ")}</dd>
            <dt>Trades</dt><dd>{trades.join(", ")}</dd>
            <dt>Zones</dt><dd>{d.zones.critical} · {d.zones.general}</dd>
            <dt>Project details</dt><dd>{d.fields.length ? d.fields.map((f) => `${f.label}${f.required ? " (required)" : ""}`).join(", ") : "None"}</dd>
            <dt>Tasks</dt><dd>{d.tasks.filter((t) => t.title.trim()).length}</dd>
            <dt>Materials</dt><dd>{d.materials.filter((m) => m.item.trim()).length}</dd>
          </dl>
        ) : null}
      </section>

      {error ? <div className="flash flash--error"><Icon name="alert" /><span>{error}</span></div> : null}
      <div className="row-between">
        <button type="button" className="tn-btn" onClick={() => { setError(null); setStep((x) => Math.max(0, x - 1)); }} disabled={step === 0}><Icon name="back" />Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="tn-btn tn-btn--primary" onClick={next}>Next</button>
        ) : (
          <button type="button" className="tn-btn tn-btn--primary" onClick={save} disabled={saving}><Icon name="check" />{saving ? "Saving" : templateId ? "Save setup" : "Save template"}</button>
        )}
      </div>
    </div>
  );
}
