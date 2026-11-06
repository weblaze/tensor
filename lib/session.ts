// Signed login sessions and passphrase hashing. Web Crypto only, so it runs in middleware and on Workers.
export const SESSION_COOKIE = "tn_session";
const MAX_AGE_S = 60 * 60 * 24 * 14;

/** "office" is the shared admin login (OFFICE_PIN); anything else is a person's id. */
export const OFFICE_SUBJECT = "office";

/** Usernames are stored lowercase: letters, digits, dot, dash, underscore. */
export const USERNAME = /^[a-z0-9._-]{2,32}$/;

export interface SessionClaims {
  subject: string;
  /** Seconds since epoch when the session was issued; a newer passphrase invalidates older sessions. */
  issuedAt: number;
}

function secret(): string {
  return process.env.SESSION_SECRET || `${process.env.OFFICE_PIN ?? ""}:${process.env.CRON_SECRET ?? ""}:tensor`;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export async function makeSessionValue(subject: string): Promise<{ value: string; maxAge: number }> {
  const now = Math.floor(Date.now() / 1000);
  const body = `v2.${subject}.${now}.${now + MAX_AGE_S}`;
  return { value: `${body}.${await hmac(body)}`, maxAge: MAX_AGE_S };
}

/** Checks signature and expiry only. Whether the person still exists is checked in lib/auth. */
export async function readSessionValue(value: string | undefined): Promise<SessionClaims | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, subject, iat, exp, sig] = parts;
  if (!/^[\w-]{1,64}$/.test(subject)) return null;
  if (!(Number(exp) > Date.now() / 1000)) return null;
  const expected = await hmac(parts.slice(0, 4).join("."));
  return safeEqual(expected, sig) ? { subject, issuedAt: Number(iat) } : null;
}

/** Constant-time string compare for passphrases and shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Passphrases: PBKDF2-SHA256. Kept modest so a login stays within the Workers CPU budget;
// lockout after repeated failures (app/login) and long passphrases carry the rest.
const ITERATIONS = 20_000;

function b64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}

export async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(passphrase, salt, ITERATIONS))}`;
}

export async function verifyPassphrase(passphrase: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const got = b64(await derive(passphrase, unb64(salt), Number(iter)));
  return safeEqual(got, hash);
}

const WORDS = "amber anchor basil cedar cobalt delta ember falcon garnet harbor indigo juniper kestrel lantern meadow nickel orchid pepper quartz raven saffron timber violet willow yarrow copper marble river summit lotus monsoon banyan peacock tiger mango neem".split(" ");

/** Four words and a number, e.g. "cedar-monsoon-quartz-banyan-42": easy to read out, hard to guess. */
export function generatePassphrase(): string {
  const r = crypto.getRandomValues(new Uint32Array(5));
  return [0, 1, 2, 3].map((i) => WORDS[r[i] % WORDS.length]).join("-") + `-${10 + (r[4] % 90)}`;
}
