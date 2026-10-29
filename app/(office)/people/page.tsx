import { db } from "@/lib/db";
import { channel } from "@/lib/messaging";
import { ROLES, type Person, type Project, type Role } from "@/lib/types";
import { Flash, StatusTag } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";
import { Icon } from "@/components/Icon";
import { newLinkCodeAction, savePersonAction, testMessageAction, unlinkPersonAction } from "../actions";

export const metadata = { title: "People" };

const ROLE_WORD: Record<Role, string> = {
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  procurement: "Procurement",
  head: "Head",
  doctor: "Doctor",
};

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ msg?: string; edit?: string }> }) {
  const { msg, edit } = await searchParams;
  const sb = db();
  const [pr, prj] = await Promise.all([
    sb.from("people").select("*").order("role").order("name"),
    sb.from("projects").select("id, code, name, city").neq("status", "closed").order("code"),
  ]);
  const people = (pr.data ?? []) as Person[];
  const projects = (prj.data ?? []) as Pick<Project, "id" | "code" | "name" | "city">[];
  const site = new Map(projects.map((p) => [p.id, p]));
  const ch = channel();
  const bot = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const editing = people.find((p) => p.id === edit);

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">People</h1>
          <p className="tn-muted">
            Each person links their phone once: open the bot and send <span className="tn-data">/start CODE</span>.
            {bot ? <> Bot: <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">@{bot}</a></> : " The Telegram bot is not set up yet."}
          </p>
        </div>
      </div>

      <div className="split">
        <div className="rows">
          {ROLES.map((role) => {
            const list = people.filter((p) => p.role === role);
            if (!list.length) return null;
            return (
              <div key={role} style={{ display: "contents" }}>
                <div className="rows__group"><span className="tn-body-strong">{ROLE_WORD[role]}</span><span className="tn-caption">{list.length}</span></div>
                {list.map((p) => {
                  const link = ch.linkUrl(p.link_code);
                  const cur = p.current_project_id ? site.get(p.current_project_id) : undefined;
                  return (
                    <div key={p.id} className="rowi">
                      <div className="rowi__main">
                        <span className="rowi__title">
                          {p.name}
                          {p.is_demo ? <span className="tn-caption"> · demo</span> : null}
                        </span>
                        <span className="rowi__meta">
                          {p.telegram_chat_id ? <StatusTag>Linked</StatusTag> : <StatusTag tone="attention" icon="phone">Not linked</StatusTag>}
                          <span>Code <span className="tn-data">{p.link_code}</span></span>
                          {p.phone ? <span className="tn-data">· {p.phone}</span> : null}
                          {cur ? <span>· reporting for {cur.city}</span> : null}
                        </span>
                        {!p.telegram_chat_id && link ? <div style={{ marginTop: 8, maxWidth: 420 }}><CopyLink value={link} label={`Telegram link for ${p.name}`} /></div> : null}
                      </div>
                      <div className="rowi__side">
                        {p.telegram_chat_id ? (
                          <>
                            <form action={testMessageAction}><input type="hidden" name="id" value={p.id} /><button className="tn-btn tn-btn--quiet">Test</button></form>
                            <form action={unlinkPersonAction}><input type="hidden" name="id" value={p.id} /><button className="tn-btn tn-btn--quiet">Unlink</button></form>
                          </>
                        ) : (
                          <form action={newLinkCodeAction}><input type="hidden" name="id" value={p.id} /><button className="tn-btn tn-btn--quiet">New code</button></form>
                        )}
                        {p.phone ? <a className="tn-btn tn-btn--quiet" href={`tel:${p.phone.replace(/\s/g, "")}`}><Icon name="phone" />Call</a> : null}
                        <a className="tn-btn tn-btn--quiet" href={`/people?edit=${p.id}`}>Edit</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <aside className="card">
          <form action={savePersonAction} className="form" key={editing?.id ?? "new"}>
            <h2 className="tn-heading">{editing ? `Edit ${editing.name}` : "Add a person"}</h2>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label className="tn-field">
              <span className="tn-label">Name</span>
              <input className="tn-input" name="name" required defaultValue={editing?.name} placeholder="Rahul" />
            </label>
            <label className="tn-field">
              <span className="tn-label">Role</span>
              <select className="tn-input" name="role" defaultValue={editing?.role ?? "supervisor"}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_WORD[r]}</option>)}
              </select>
            </label>
            <label className="tn-field">
              <span className="tn-label">Phone</span>
              <input className="tn-input" name="phone" inputMode="tel" defaultValue={editing?.phone ?? ""} placeholder="+91 98100 00000" />
            </label>
            <label className="tn-field">
              <span className="tn-label">Reports for site</span>
              <select className="tn-input" name="current_project_id" defaultValue={editing?.current_project_id ?? ""}>
                <option value="">Their assigned sites</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.city} · {p.name}</option>)}
              </select>
              <span className="tn-help">For supervisors. Updates go here unless they pick another site with /site.</span>
            </label>
            <div className="tn-row">
              <button className="tn-btn tn-btn--primary"><Icon name="check" />{editing ? "Save" : "Add person"}</button>
              {editing ? <a className="tn-btn tn-btn--quiet" href="/people">Cancel</a> : null}
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}
