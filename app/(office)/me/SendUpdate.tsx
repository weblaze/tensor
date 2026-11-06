"use client";
import { useActionState, useRef } from "react";
import { sendWebUpdateAction, type SendResult } from "./actions";
import { Icon } from "@/components/Icon";

export function SendUpdate({ sites }: { sites: { id: string; label: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SendResult | undefined, FormData>(async (prev, fd) => {
    const res = await sendWebUpdateAction(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, undefined);
  if (!sites.length) return null;
  return (
    <form ref={formRef} action={action} className="card form">
      <div className="stack-2">
        <h2 className="tn-heading">Send an update</h2>
        <p className="tn-caption">Same as sending it on Telegram: a photo and one line.</p>
      </div>
      {sites.length > 1 ? (
        <label className="tn-field">
          <span className="tn-label">Site</span>
          <select className="tn-input" name="project_id" defaultValue={sites[0].id}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="project_id" value={sites[0].id} />}
      <label className="tn-field">
        <span className="tn-label">Photo</span>
        <input className="tn-input" name="photo" type="file" accept="image/*" capture="environment" style={{ paddingTop: 10 }} />
      </label>
      <label className="tn-field">
        <span className="tn-label">What happened</span>
        <input className="tn-input" name="text" placeholder="Glass panels received, 2 broken" maxLength={500} />
      </label>
      {state ? <p className="tn-help" style={{ color: state.ok ? "var(--scrub)" : "var(--alert)" }}>{state.message}</p> : null}
      <div><button className="tn-btn tn-btn--primary" disabled={pending}><Icon name="send" />{pending ? "Sending" : "Send"}</button></div>
    </form>
  );
}
