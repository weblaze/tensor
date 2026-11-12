import { db } from "@/lib/db";
import { requirePage, MANAGERS } from "@/lib/auth";
import { fmtWhen } from "@/lib/dates";
import { channel } from "@/lib/messaging";
import { ROLES, type Person, type Project, type Role } from "@/lib/types";
import { Flash, StatusTag } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";
import { Icon } from "@/components/Icon";
import { deletePersonAction, newLinkCodeAction, savePersonAction, testMessageAction, unlinkPersonAction } from "../actions";
import { LoginPanel } from "./LoginPanel";

export const metadata = { title: "People" };

const ROLE_WORD: Record<Role, string> = {
  coordinator: "Office coordinator",
  head: "Head",
  procurement: "Procurement",
  supervisor: "Supervisor",
  doctor: "Doctor",
};

const ROLE_JOB: Record<Role, string> = {
  coordinator: "Plans projects, reviews site updates, sends the doctor's report",
  head: "Sees exceptions; gets escalations and issues on Telegram",
  procurement: "Gets order alerts and broken-delivery messages; marks orders",
  supervisor: "Sends photos, notes and voice notes from site on Telegram",
  doctor: "Gets the evening site report; answers decisions",
};

type Row = Person & { pass_hash?: string | null };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ msg?: string; edit?: string }> }) {
  await requirePage(...MANAGERS);
  const { msg, edit } = await searchParams;
  const sb = db();
  const [pr, prj] = await Promise.all([
    sb.from("people").select("*").order("role").order("name"),
    sb.from("projects").select("id, code, name, city, supervisor_id, doctor_id").neq("status", "closed").order("code"),
  ]);
  const people = (pr.data ?? []) as Row[];
  const projects = (prj.data ?? []) as Pick<Project, "id" | "code" | "name" | "city" | "supervisor_id" | "doctor_id">[];
  const sitesOf = (p: Person) => projects.filter((x) => (p.role === "supervisor" && x.supervisor_id === p.id) || (p.role === "doctor" && x.doctor_id === p.id));
  const ch = channel();
  const bot = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const editing = people.find((p) => p.id === edit);
  const editingSites = editing ? sitesOf(editing).map((x) => x.id) : [];
  const editingLink = editing ? ch.linkUrl(editing.link_code) : null;

  return (
    <main className="page">
      {msg ? <Flash>{msg}</Flash> : null}
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="tn-title">People</h1>
          <p className="tn-muted">Everyone who sends or gets messages from Tensor.</p>
        </div>
      </div>

      <details className="card more" style={{ marginBottom: 16 }} open={people.length < 3}>
        <summary>How to add someone</summary>
        <ol className="stack-2" style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li><span className="tn-body-strong">Add them here</span> with their role. For a supervisor or doctor, tick their sites: that makes them the site&apos;s supervisor or doctor.</li>
          <li><span className="tn-body-strong">Send them their Telegram link</span> (on WhatsApp or SMS). Tapping it opens {bot ? `@${bot}` : "the bot"} and connects their phone in one tap. If the link doesn&apos;t open, they can send <span className="tn-data">/start</span> and their code to the bot. Each code works once.</li>
          <li><span className="tn-body-strong">Optional: give them a web login</span> if they want to use Tensor in a browser too. Supervisors and doctors don&apos;t need one.</li>
        </ol>
        <p className="tn-caption" style={{ marginTop: 8 }}>
          Without Telegram connected, a person can still be assigned and shown everywhere, but Tensor can&apos;t message them or take updates from them; their messages are listed under Settings → Messages as “Not sent”.
        </p>
      </details>

      <div className="split">
        <div className="rows">
          {ROLES.map((role) => {
            const list = people.filter((p) => p.role === role);
            if (!list.length) return null;
            return (
              <div key={role} style={{ display: "contents" }}>
                <div className="rows__group">
                  <span className="tn-body-strong">{ROLE_WORD[role]}</span>
                  <span className="tn-caption">{ROLE_JOB[role]}</span>
                </div>
                {list.map((p) => {
                  const sites = sitesOf(p);
                  return (
                    <div key={p.id} className={`rowi${p.id === edit ? " rowi--selected" : ""}`}>
                      <div className="rowi__main">
                        <span className="rowi__title">{p.name}</span>
                        <span className="rowi__meta">
                          {p.telegram_chat_id ? <StatusTag icon="send">On Telegram</StatusTag> : <StatusTag tone="attention" icon="phone">Telegram not connected</StatusTag>}
                          {p.pass_hash ? <span>· web login <span className="tn-data">{p.username}</span></span> : null}
                          {role === "supervisor" || role === "doctor" ? (
                            <span>· {sites.length ? `${role === "doctor" ? "Doctor" : "Supervisor"} of ${sites.map((s) => s.city).join(", ")}` : "No site yet"}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="rowi__side">
                        {p.phone ? <a className="tn-btn tn-btn--quiet" href={`tel:${p.phone.replace(/\s/g, "")}`}><Icon name="phone" />Call</a> : null}
                        <a className="tn-btn" href={`/people?edit=${p.id}`}>{p.telegram_chat_id ? "Edit" : "Edit · link"}</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!people.length ? <div className="empty">Nobody yet. Add the office coordinator first.</div> : null}
        </div>

        <aside className="stack-4">
          <div className="card">
            <form action={savePersonAction} className="form" key={editing?.id ?? "new"}>
              <h2 className="tn-heading">{editing ? editing.name : "Add a person"}</h2>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <label className="tn-field">
                <span className="tn-label">Name</span>
                <input className="tn-input" name="name" required defaultValue={editing?.name} placeholder="Name or title" />
              </label>
              <label className="tn-field">
                <span className="tn-label">Role</span>
                <select className="tn-input" name="role" defaultValue={editing?.role ?? "supervisor"}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_WORD[r]}</option>)}
                </select>
              </label>
              <label className="tn-field">
                <span className="tn-label">Phone (optional)</span>
                <input className="tn-input" name="phone" inputMode="tel" defaultValue={editing?.phone ?? ""} placeholder="+91 98100 00000" />
                <span className="tn-help">Only for the Call button. Messages go by Telegram.</span>
              </label>
              {projects.length ? (
                <fieldset className="stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="tn-label" style={{ marginBottom: 8 }}>Sites (supervisors and doctors)</legend>
                  {projects.map((x) => (
                    <label key={x.id} className="check">
                      <input type="checkbox" name="sites" value={x.id} defaultChecked={editingSites.includes(x.id)} />
                      <span>{x.city} · {x.name} <span className="tn-data tn-muted">{x.code}</span></span>
                    </label>
                  ))}
                  <span className="tn-help">A site has one supervisor and one doctor; ticking a site here replaces whoever had it.</span>
                </fieldset>
              ) : null}
              <div className="tn-row">
                <button className="tn-btn tn-btn--primary"><Icon name="check" />{editing ? "Save" : "Add person"}</button>
                {editing ? <a className="tn-btn tn-btn--quiet" href="/people">Close</a> : null}
              </div>
            </form>
          </div>

          {editing ? (
            <div className="card stack-4">
              <h3 className="tn-heading">Telegram</h3>
              {editing.telegram_chat_id ? (
                <>
                  <p className="tn-muted">Connected. {editing.name} gets messages and can send updates.</p>
                  <div className="tn-row">
                    <form action={testMessageAction}><input type="hidden" name="id" value={editing.id} /><button className="tn-btn"><Icon name="send" />Send a test</button></form>
                    <form action={unlinkPersonAction}><input type="hidden" name="id" value={editing.id} /><button className="tn-btn tn-btn--quiet">Disconnect</button></form>
                  </div>
                </>
              ) : (
                <>
                  <p className="tn-muted">Send {editing.name} this link. Tapping it connects their Telegram.</p>
                  {editingLink ? <CopyLink value={editingLink} label={`Telegram link for ${editing.name}`} /> : <p className="tn-caption">The Telegram bot is not set up on the server.</p>}
                  <p className="tn-caption">Or they send <span className="tn-data">/start {editing.link_code}</span> to {bot ? `@${bot}` : "the bot"}.</p>
                  <form action={newLinkCodeAction}><input type="hidden" name="id" value={editing.id} /><button className="tn-btn tn-btn--quiet"><Icon name="refresh" />Make a new link</button></form>
                </>
              )}
            </div>
          ) : null}

          {editing ? (
            <div className="card">
              <LoginPanel
                key={editing.id}
                id={editing.id}
                name={editing.name}
                username={editing.username ?? null}
                hasLogin={!!editing.pass_hash}
                lastLogin={editing.last_login_at ? fmtWhen(editing.last_login_at) : null}
                linked={!!editing.telegram_chat_id}
              />
              <form action={deletePersonAction} className="tn-row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 16 }}>
                <input type="hidden" name="id" value={editing.id} />
                <label className="check"><input type="checkbox" name="confirm" /><span>Yes, remove {editing.name}</span></label>
                <button className="tn-btn tn-btn--quiet">Remove</button>
              </form>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
