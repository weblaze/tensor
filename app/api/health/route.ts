import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { channel } from "@/lib/messaging";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, db: hasDb(), ai: aiConfigured(), messaging: channel().configured() });
}
