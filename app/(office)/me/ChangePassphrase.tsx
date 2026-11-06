"use client";
import { useActionState } from "react";
import { changeOwnPassphraseAction, type LoginResult } from "../people/loginActions";
import { Icon } from "@/components/Icon";

export function ChangePassphrase() {
  const [state, action, pending] = useActionState<LoginResult | undefined, FormData>(changeOwnPassphraseAction, undefined);
  return (
    <details className="more">
      <summary>Change my passphrase</summary>
      <form action={action} className="form" style={{ paddingTop: 8 }}>
        <label className="tn-field">
          <span className="tn-label">Current passphrase</span>
          <input className="tn-input" name="current" type="password" autoComplete="current-password" required />
        </label>
        <label className="tn-field">
          <span className="tn-label">New passphrase</span>
          <input className="tn-input" name="next" type="password" autoComplete="new-password" minLength={12} required />
          <span className="tn-help">At least 12 characters. A few unrelated words are easy to remember and hard to guess.</span>
        </label>
        {state ? <p className="tn-help" style={{ color: state.ok ? "var(--scrub)" : "var(--alert)" }}>{state.message}</p> : null}
        <div><button className="tn-btn" disabled={pending}><Icon name="check" />Change passphrase</button></div>
      </form>
    </details>
  );
}
