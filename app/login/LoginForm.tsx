"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { Icon } from "@/components/Icon";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next} />
      <label className="tn-field">
        <span className="tn-label">Username</span>
        <input className="tn-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required defaultValue={state?.username} />
      </label>
      <label className={`tn-field${state?.error ? " tn-field--error" : ""}`}>
        <span className="tn-label">Passphrase</span>
        <input className="tn-input" name="pin" type="password" autoComplete="current-password" required />
        {state?.error ? (
          <span className="tn-help"><Icon name="alert" size="sm" />{state.error}</span>
        ) : (
          <span className="tn-help">Your own passphrase from the office. Forgot it? Ask the coordinator to set a new one.</span>
        )}
      </label>
      <button className="tn-btn tn-btn--primary tn-btn--block" disabled={pending}>
        {pending ? "Checking" : "Sign in"}
      </button>
    </form>
  );
}
