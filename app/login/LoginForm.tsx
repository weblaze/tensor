"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { Icon } from "@/components/Icon";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next} />
      <label className={`tn-field${state?.error ? " tn-field--error" : ""}`}>
        <span className="tn-label">Office passphrase</span>
        <input className="tn-input" name="pin" type="password" autoComplete="current-password" autoFocus required />
        {state?.error ? (
          <span className="tn-help"><Icon name="alert" size="sm" />{state.error}</span>
        ) : (
          <span className="tn-help">The shared office passphrase. Ask Abhay if you do not have it.</span>
        )}
      </label>
      <button className="tn-btn tn-btn--primary tn-btn--block" disabled={pending}>
        {pending ? "Checking" : "Open Tensor"}
      </button>
    </form>
  );
}
