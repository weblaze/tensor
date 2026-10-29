import "server-only";
import { db } from "./db";
import { channel, type Button } from "./messaging";
import type { Person, Role } from "./types";

export interface NotifyResult {
  status: "sent" | "skipped" | "failed";
  error?: string;
}

/** Send a message to a person and log it. Unlinked people are logged as skipped, so the office can see what would have gone out. */
export async function notifyPerson(
  person: Pick<Person, "id" | "name" | "telegram_chat_id">,
  kind: string,
  body: string,
  opts: { projectId?: string | null; buttons?: Button[][]; photoUrl?: string | null } = {},
): Promise<NotifyResult> {
  const ch = channel();
  let result: NotifyResult;
  if (!person.telegram_chat_id) {
    result = { status: "skipped", error: `${person.name} has not linked Telegram` };
  } else if (!ch.configured()) {
    result = { status: "skipped", error: "Telegram bot is not configured" };
  } else {
    const sent = opts.photoUrl
      ? await ch.sendPhoto(person.telegram_chat_id, opts.photoUrl, body.slice(0, 1000))
      : await ch.sendText(person.telegram_chat_id, body, opts.buttons);
    // A photo can fail (e.g. expired URL); fall back to text so the message still lands.
    const final = !sent.ok && opts.photoUrl ? await ch.sendText(person.telegram_chat_id, body, opts.buttons) : sent;
    result = final.ok ? { status: "sent" } : { status: "failed", error: final.error };
  }
  await db().from("notifications").insert({
    person_id: person.id,
    project_id: opts.projectId ?? null,
    kind,
    body,
    channel: ch.name,
    status: result.status,
    error: result.error ?? null,
  });
  return result;
}

export async function peopleByRole(role: Role): Promise<Person[]> {
  const { data } = await db().from("people").select("*").eq("role", role).order("name");
  return (data ?? []) as Person[];
}

export async function notifyRole(
  role: Role,
  kind: string,
  body: string,
  opts: { projectId?: string | null; buttons?: Button[][]; photoUrl?: string | null } = {},
): Promise<NotifyResult[]> {
  const people = await peopleByRole(role);
  return Promise.all(people.map((p) => notifyPerson(p, kind, body, opts)));
}
