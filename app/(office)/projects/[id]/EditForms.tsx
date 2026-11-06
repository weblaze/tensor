import { TRADES, type Material, type Person, type Project, type Task } from "@/lib/types";
import { Icon } from "@/components/Icon";
import {
  deleteMaterialAction, deleteTaskAction, updateMaterialAction, updateProjectAction, updateTaskAction,
} from "../../actions";

const PHASES = ["Site setup", "Services", "Build", "Finishes", "HVAC", "Handover"];

function Hidden({ fields }: { fields: Record<string, string> }) {
  return <>{Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

/** Delete sits behind a tick box: a quiet action, never one tap away. */
function DeleteForm({ action, id, back, label }: { action: (f: FormData) => Promise<void>; id: string; back: string; label: string }) {
  return (
    <form action={action} className="tn-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <Hidden fields={{ id, back }} />
      <label className="check"><input type="checkbox" name="confirm" /><span>Yes, delete this {label}</span></label>
      <button className="tn-btn tn-btn--quiet">Delete</button>
    </form>
  );
}

export function TaskEdit({ task, back }: { task: Task; back: string }) {
  return (
    <details className="more">
      <summary>Edit</summary>
      <div className="stack-4" style={{ paddingTop: 8 }}>
        <form action={updateTaskAction} className="form">
          <Hidden fields={{ id: task.id, back }} />
          <div className="form-grid">
            <label className="tn-field"><span className="tn-label">Task</span><input className="tn-input" name="title" required defaultValue={task.title} /></label>
            <label className="tn-field"><span className="tn-label">Phase</span>
              <select className="tn-input" name="phase" defaultValue={task.phase}>{[...new Set([...PHASES, task.phase])].map((p) => <option key={p}>{p}</option>)}</select>
            </label>
            <label className="tn-field"><span className="tn-label">Trade</span>
              <select className="tn-input" name="trade" defaultValue={task.trade}>{[...new Set([...TRADES, task.trade])].map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="tn-field"><span className="tn-label">Zone</span>
              <select className="tn-input" name="zone" defaultValue={task.zone}><option value="critical">Critical</option><option value="general">General</option></select>
            </label>
            <label className="tn-field"><span className="tn-label">Start</span><input className="tn-input" type="date" name="planned_start" required defaultValue={task.planned_start} /></label>
            <label className="tn-field"><span className="tn-label">End</span><input className="tn-input" type="date" name="planned_end" required defaultValue={task.planned_end} /></label>
          </div>
          <div><button className="tn-btn"><Icon name="check" />Save task</button></div>
        </form>
        <DeleteForm action={deleteTaskAction} id={task.id} back={back} label="task" />
      </div>
    </details>
  );
}

export function MaterialEdit({ material: m, back }: { material: Material; back: string }) {
  return (
    <details className="more">
      <summary>Edit</summary>
      <div className="stack-4" style={{ paddingTop: 8 }}>
        <form action={updateMaterialAction} className="form">
          <Hidden fields={{ id: m.id, back }} />
          <div className="form-grid">
            <label className="tn-field"><span className="tn-label">Item</span><input className="tn-input" name="item" required defaultValue={m.item} /></label>
            <label className="tn-field"><span className="tn-label">Trade</span>
              <select className="tn-input" name="trade" defaultValue={m.trade}>{[...new Set([...TRADES, m.trade])].map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="tn-field"><span className="tn-label">Quantity</span><input className="tn-input" name="qty" inputMode="decimal" defaultValue={m.qty ?? ""} /></label>
            <label className="tn-field"><span className="tn-label">Unit</span><input className="tn-input" name="unit" defaultValue={m.unit ?? ""} /></label>
            <label className="tn-field"><span className="tn-label">Lead time (days)</span><input className="tn-input" name="lead_time_days" inputMode="numeric" defaultValue={m.lead_time_days} /></label>
            <label className="tn-field"><span className="tn-label">Needed on site</span><input className="tn-input" type="date" name="need_by" required defaultValue={m.need_by} /></label>
            <label className="tn-field"><span className="tn-label">Vendor</span><input className="tn-input" name="vendor" defaultValue={m.vendor ?? ""} /></label>
            <label className="tn-field"><span className="tn-label">Note</span><input className="tn-input" name="note" defaultValue={m.note ?? ""} /></label>
          </div>
          <span className="tn-help">Order-by moves with the date and lead time.</span>
          <div><button className="tn-btn"><Icon name="check" />Save material</button></div>
        </form>
        <DeleteForm action={deleteMaterialAction} id={m.id} back={back} label="material" />
      </div>
    </details>
  );
}

export function ProjectEdit({ project: p, people, back }: { project: Project; people: Person[]; back: string }) {
  const pick = (role: Person["role"]) => people.filter((x) => x.role === role);
  const select = (name: string, role: Person["role"], value: string | null) => (
    <select className="tn-input" name={name} defaultValue={value ?? ""}>
      <option value="">Not set</option>
      {pick(role).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );
  return (
    <details className="more">
      <summary>Edit project</summary>
      <form action={updateProjectAction} className="form" style={{ paddingTop: 8 }}>
        <Hidden fields={{ id: p.id, back }} />
        <label className="tn-field"><span className="tn-label">Clinic name</span><input className="tn-input" name="name" required defaultValue={p.name} /></label>
        <label className="tn-field"><span className="tn-label">City</span><input className="tn-input" name="city" required defaultValue={p.city} /></label>
        <label className="tn-field"><span className="tn-label">Doctor</span>{select("doctor_id", "doctor", p.doctor_id)}</label>
        <label className="tn-field"><span className="tn-label">Supervisor</span>{select("supervisor_id", "supervisor", p.supervisor_id)}</label>
        <label className="tn-field"><span className="tn-label">Coordinator</span>{select("coordinator_id", "coordinator", p.coordinator_id)}</label>
        <label className="tn-field"><span className="tn-label">Start date</span><input className="tn-input" type="date" name="start_date" required defaultValue={p.start_date} /></label>
        <label className="check"><input type="checkbox" name="shift_plan" defaultChecked /><span>If the start moves, move open tasks and unordered materials with it</span></label>
        <label className="tn-field"><span className="tn-label">Planned days</span><input className="tn-input" name="planned_days" inputMode="numeric" defaultValue={p.planned_days} /></label>
        <label className="tn-field"><span className="tn-label">Order notes</span><textarea className="tn-input" name="order_notes" defaultValue={p.order_notes ?? ""} /></label>
        <div><button className="tn-btn"><Icon name="check" />Save project</button></div>
      </form>
    </details>
  );
}
