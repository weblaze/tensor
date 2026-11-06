import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { OFFICE_SUBJECT, readSessionValue, SESSION_COOKIE } from "./session";
import type { Person, Role } from "./types";

/** "admin" is the shared office login; everyone else signs in as themselves with their role. */
export type AppRole = Role | "admin";

export interface Viewer {
  role: AppRole;
  name: string;
  /** Null for the shared office login. */
  person: Person | null;
}

/** Roles that run the office: every screen and every action. */
export const MANAGERS: AppRole[] = ["admin", "coordinator", "head"];

export function canManage(v: Viewer | null): boolean {
  return !!v && MANAGERS.includes(v.role);
}

/** The signed-in viewer, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const claims = await readSessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  if (claims.subject === OFFICE_SUBJECT) return { role: "admin", name: "Office", person: null };
  const { data } = await db().from("people").select("*").eq("id", claims.subject).maybeSingle();
  const person = data as (Person & { pass_hash: string | null; pass_set_at: string | null }) | null;
  // Removed people, and sessions issued before the passphrase was last changed, are signed out.
  if (!person || !person.pass_hash) return null;
  if (person.pass_set_at && Date.parse(person.pass_set_at) / 1000 > claims.issuedAt + 1) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pass_hash, ...safe } = person;
  return { role: person.role, name: person.name, person: safe };
});

/**
 * For server actions. Server actions can be posted to any route, including public ones the
 * middleware lets through, so every action checks who is calling.
 */
export async function requireRole(...roles: AppRole[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("Not signed in");
  if (!roles.includes(v.role)) throw new Error("You don't have access to this");
  return v;
}

/** Office actions: coordinator, head or the shared office login. */
export async function requireOffice(): Promise<Viewer> {
  return requireRole(...MANAGERS);
}

/** For pages: sign in if needed; people without access go to their own dashboard. */
export async function requirePage(...roles: AppRole[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (roles.length && !roles.includes(v.role)) redirect("/me");
  return v;
}
