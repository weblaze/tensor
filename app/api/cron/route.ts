import { NextResponse, type NextRequest } from "next/server";
import { runDailyChecks } from "@/lib/cron";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

// Called hourly by Supabase pg_cron + pg_net with the CRON_SECRET bearer token.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const summary = await runDailyChecks({ force });
  return NextResponse.json({ ok: true, summary });
}

export const POST = handle;
export const GET = handle;
