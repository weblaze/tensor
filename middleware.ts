import { NextResponse, type NextRequest } from "next/server";
import { readSessionValue, SESSION_COOKIE } from "@/lib/session";

// Everything needs a signed-in person (or the office login) except login, the doctor report, and the machine endpoints (which check their own secrets).
const PUBLIC = [/^\/login/, /^\/r\//, /^\/api\/telegram/, /^\/api\/cron/, /^\/api\/health/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  // Signature and expiry only; who may see what is checked by each page and action (lib/auth).
  const ok = await readSessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|tensor-mark.*\\.svg).*)"],
};
