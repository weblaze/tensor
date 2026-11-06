import "server-only";
import { db, isFixture } from "./db";

/**
 * Demo mode shows the demo badge and the "Reset demo data" tool. Off in production:
 * a reset there would wipe real projects. Set DEMO_MODE=1 only on a demo deployment.
 */
export function demoMode(): boolean {
  return process.env.DEMO_MODE === "1" || isFixture();
}

/** First name of the head (the owner) for labels and messages; "the head" if none is set up. */
export async function headName(): Promise<string> {
  const { data } = await db().from("people").select("name").eq("role", "head").order("created_at").limit(1);
  return (data?.[0]?.name as string | undefined) ?? "the head";
}

/** Six-character Telegram link code, e.g. "3FA9C1". */
export function newLinkCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
