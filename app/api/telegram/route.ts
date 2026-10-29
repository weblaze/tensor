import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramUpdate, type TgUpdate } from "@/lib/intake";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

// Telegram webhook. Protected by the secret token set when the webhook was registered.
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as TgUpdate;
  try {
    await handleTelegramUpdate(update);
  } catch (e) {
    // Answer 200 anyway so Telegram does not retry a message that will fail the same way.
    console.error("[telegram] update failed:", e);
  }
  return NextResponse.json({ ok: true });
}
