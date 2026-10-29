import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionValue } from "./session";

/**
 * Server actions can be posted to any route, including public ones the middleware lets through,
 * so every office action checks the session itself.
 */
export async function requireOffice(): Promise<void> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionValue(value))) throw new Error("Not signed in");
}
