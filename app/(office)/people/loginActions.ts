"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getViewer, requireOffice } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyPerson } from "@/lib/notify";
import { generatePassphrase, hashPassphrase, makeSessionValue, OFFICE_SUBJECT, SESSION_COOKIE, USERNAME, verifyPassphrase } from "@/lib/session";
import type { Person } from "@/lib/types";

export interface LoginResult {
  ok: boolean;
  message: string;
  /** Shown once to whoever set it; never stored in clear. */
  passphrase?: string;
  username?: string;
}

const MIN_OWN = 12;

/** Give someone a login, or a new passphrase. Signs them out everywhere else. */
export async function setLoginAction(_: LoginResult | undefined, form: FormData): Promise<LoginResult> {
  await requireOffice();
  const id = String(form.get("id") ?? "");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const typed = String(form.get("passphrase") ?? "").trim();
  if (!USERNAME.test(username) || username === OFFICE_SUBJECT) {
    return { ok: false, message: "Usernames are 2–32 letters, digits, dots or dashes, and can't be \"office\"." };
  }
  if (typed && typed.length < MIN_OWN) return { ok: false, message: `A passphrase needs at least ${MIN_OWN} characters. Leave it empty to get one made for you.` };

  const sb = db();
  const { data: taken } = await sb.from("people").select("id").eq("username", username).neq("id", id).maybeSingle();
  if (taken) return { ok: false, message: `"${username}" is already someone's username.` };

  const passphrase = typed || generatePassphrase();
  const { data, error } = await sb.from("people")
    .update({ username, pass_hash: await hashPassphrase(passphrase), pass_set_at: new Date().toISOString() })
    .eq("id", id).select("*").single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not save" };
  const person = data as Person;

  let sent = "";
  if (form.get("send") === "on") {
    const app = (process.env.APP_URL || "").replace(/\/$/, "");
    const r = await notifyPerson(person, "login", `${person.name}, your Tensor login:\nUsername: ${username}\nPassphrase: ${passphrase}\n${app ? `${app}/login\n` : ""}Keep this to yourself. Delete this message once you have signed in.`);
    sent = r.status === "sent" ? " Sent to their Telegram." : ` Not sent: ${r.error ?? "Telegram failed"}.`;
  }
  revalidatePath("/people");
  return { ok: true, username, passphrase, message: `${person.name} can now sign in.${sent} Older sign-ins were ended.` };
}

export async function removeLoginAction(_: LoginResult | undefined, form: FormData): Promise<LoginResult> {
  await requireOffice();
  const id = String(form.get("id") ?? "");
  await db().from("people").update({ pass_hash: null, pass_set_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/people");
  return { ok: true, message: "Login removed. They are signed out and can still use Telegram." };
}

/** Anyone signed in as themselves can change their own passphrase. */
export async function changeOwnPassphraseAction(_: LoginResult | undefined, form: FormData): Promise<LoginResult> {
  const v = await getViewer();
  if (!v?.person) return { ok: false, message: "Sign in as yourself to change your passphrase." };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "").trim();
  const { data } = await db().from("people").select("pass_hash").eq("id", v.person.id).single();
  if (!(await verifyPassphrase(current, data?.pass_hash as string))) return { ok: false, message: "Your current passphrase is not right." };
  if (next.length < MIN_OWN) return { ok: false, message: `Use at least ${MIN_OWN} characters. A few unrelated words work well.` };
  await db().from("people").update({ pass_hash: await hashPassphrase(next), pass_set_at: new Date().toISOString() }).eq("id", v.person.id);
  // Other devices are signed out; this one gets a fresh session so it stays signed in.
  const { value, maxAge } = await makeSessionValue(v.person.id);
  (await cookies()).set(SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return { ok: true, message: "Passphrase changed. Your other devices will need the new one." };
}
