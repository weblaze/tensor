"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, hasDb } from "@/lib/db";
import { makeSessionValue, OFFICE_SUBJECT, safeEqual, SESSION_COOKIE, USERNAME, verifyPassphrase } from "@/lib/session";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 50;
/** Production refuses short PINs: a 4-digit PIN can be guessed in minutes. */
const MIN_PROD_LENGTH = 10;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Failed attempts in the window, for this address and overall (a spread-out guessing run). */
async function recentFailures(ip: string): Promise<{ ip: number; all: number }> {
  if (!hasDb()) return { ip: 0, all: 0 };
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [mine, all] = await Promise.all([
    db().from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("at", since),
    db().from("login_attempts").select("id", { count: "exact", head: true }).eq("ok", false).gte("at", since),
  ]);
  return { ip: mine.count ?? 0, all: all.count ?? 0 };
}

async function record(ip: string, ok: boolean) {
  if (hasDb()) await db().from("login_attempts").insert({ ip, ok });
}

export async function login(_: { error?: string; username?: string } | undefined, form: FormData): Promise<{ error?: string; username?: string }> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const pin = String(form.get("pin") ?? "").trim();

  const ip = await clientIp();
  const fails = await recentFailures(ip);
  if (fails.ip >= MAX_PER_IP || fails.all >= MAX_GLOBAL) {
    return { username, error: "Too many wrong tries. Wait 15 minutes, then try again." };
  }

  // "office" is the shared admin login for setting the office up; everyone else signs in as themselves.
  let subject: string | null = null;
  if (username === OFFICE_SUBJECT) {
    const expected = process.env.OFFICE_PIN;
    if (!expected) return { username, error: "The office login is not set up on the server." };
    if (process.env.NODE_ENV === "production" && expected.length < MIN_PROD_LENGTH) {
      return { username, error: `The office passphrase on the server is too short. Set OFFICE_PIN to at least ${MIN_PROD_LENGTH} characters.` };
    }
    if (pin && safeEqual(pin, expected)) subject = OFFICE_SUBJECT;
  } else if (USERNAME.test(username) && hasDb()) {
    const { data } = await db().from("people").select("id, pass_hash").eq("username", username).maybeSingle();
    if (data?.pass_hash && (await verifyPassphrase(pin, data.pass_hash as string))) {
      subject = data.id as string;
      await db().from("people").update({ last_login_at: new Date().toISOString() }).eq("id", subject);
    }
  }

  if (!subject) {
    await record(ip, false);
    const left = MAX_PER_IP - fails.ip - 1;
    return { username, error: left > 0 ? `That username and passphrase do not match. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Wait 15 minutes, then try again." };
  }

  await record(ip, true);
  const { value, maxAge } = await makeSessionValue(subject);
  (await cookies()).set(SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
