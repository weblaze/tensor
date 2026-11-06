"use client";
import { useActionState } from "react";
import { removeLoginAction, setLoginAction, type LoginResult } from "./loginActions";
import { CopyLink } from "@/components/CopyLink";
import { Icon } from "@/components/Icon";

export function LoginPanel(props: {
  id: string;
  name: string;
  username: string | null;
  hasLogin: boolean;
  lastLogin: string | null;
  linked: boolean;
}) {
  const [set, setAction, setting] = useActionState<LoginResult | undefined, FormData>(setLoginAction, undefined);
  const [removed, removeAction, removing] = useActionState<LoginResult | undefined, FormData>(removeLoginAction, undefined);
  const suggested = props.username ?? props.name.toLowerCase().replace(/^dr\.?\s*/, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  const active = (props.hasLogin || set?.ok) && !removed?.ok;

  return (
    <div className="stack-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 }}>
      <div className="stack-2">
        <h3 className="tn-heading">Web login</h3>
        <p className="tn-caption">
          {active
            ? `${props.name} can sign in as “${set?.username ?? props.username}”.${props.lastLogin ? ` Last signed in ${props.lastLogin}.` : " Not signed in yet."}`
            : `${props.name} has no web login. Telegram works without one.`}
        </p>
      </div>

      {set?.ok && set.passphrase ? (
        <div className="flash" style={{ margin: 0, flexDirection: "column", alignItems: "stretch" }}>
          <span>{set.message} Copy the passphrase now: it is not shown again.</span>
          <CopyLink value={set.passphrase} label="New passphrase" />
        </div>
      ) : null}
      {set && !set.ok ? <p className="tn-help" style={{ color: "var(--alert)" }}>{set.message}</p> : null}
      {removed?.ok ? <p className="tn-help">{removed.message}</p> : null}

      <form action={setAction} className="form">
        <input type="hidden" name="id" value={props.id} />
        <label className="tn-field">
          <span className="tn-label">Username</span>
          <input className="tn-input" name="username" defaultValue={suggested} autoCapitalize="none" spellCheck={false} required />
        </label>
        <label className="tn-field">
          <span className="tn-label">Passphrase</span>
          <input className="tn-input" name="passphrase" type="text" autoComplete="off" placeholder="Leave empty to make one" />
          <span className="tn-help">Tensor makes a four-word passphrase if you leave this empty. At least 12 characters if you type one.</span>
        </label>
        {props.linked ? (
          <label className="check"><input type="checkbox" name="send" defaultChecked /><span>Send it to their Telegram</span></label>
        ) : null}
        <div className="tn-row">
          <button className="tn-btn" disabled={setting}><Icon name="check" />{active ? "New passphrase" : "Give a login"}</button>
        </div>
      </form>

      {active ? (
        <form action={removeAction}>
          <input type="hidden" name="id" value={props.id} />
          <button className="tn-btn tn-btn--quiet" disabled={removing}>Remove web login</button>
        </form>
      ) : null}
    </div>
  );
}
