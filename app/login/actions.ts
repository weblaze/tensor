"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { makeSessionValue, safeEqual, SESSION_COOKIE } from "@/lib/session";

export async function login(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const pin = String(form.get("pin") ?? "").trim();
  const expected = process.env.OFFICE_PIN;
  if (!expected) return { error: "OFFICE_PIN is not set on the server. Add it to .env.local." };
  if (!pin || !safeEqual(pin, expected)) return { error: "That PIN is not right. Ask Abhay for the office PIN." };
  const { value, maxAge } = await makeSessionValue();
  (await cookies()).set(SESSION_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
