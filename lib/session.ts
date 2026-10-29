// Shared-PIN office session (demo only). Web Crypto so it runs in middleware and on Workers.
export const SESSION_COOKIE = "tn_session";
const MAX_AGE_S = 60 * 60 * 24 * 14;

function secret(): string {
  return process.env.SESSION_SECRET || `${process.env.OFFICE_PIN ?? ""}:${process.env.CRON_SECRET ?? ""}:tensor`;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSessionValue(): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const body = `v1.${exp}`;
  return { value: `${body}.${await hmac(body)}`, maxAge: MAX_AGE_S };
}

export async function verifySessionValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  if (expected.length !== parts[2].length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  return diff === 0;
}

/** Constant-time string compare for PINs and shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
