// Local Telegram long-polling: fetches updates from Telegram and forwards each one to the
// running app's webhook route, so the bot works on localhost without a public URL.
//   npm run dev            (in one terminal)
//   npm run poll           (in another)
// Stops any registered webhook first (Telegram allows either polling or a webhook, not both).

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const target = `${(process.env.POLL_TARGET || "http://localhost:3000").replace(/\/$/, "")}/api/telegram`;

if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local first.");
  process.exit(1);
}

const api = (method: string, body: object = {}) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>);

async function main() {
  const me = await api("getMe");
  if (!me.ok) throw new Error(`Bad bot token: ${me.description}`);
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log(`Polling @${(me.result as { username: string }).username} → ${target}`);

  let offset = 0;
  for (;;) {
    try {
      const res = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      if (!res.ok) throw new Error(res.description);
      for (const u of res.result as { update_id: number }[]) {
        offset = u.update_id + 1;
        const r = await fetch(target, {
          method: "POST",
          headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret! },
          body: JSON.stringify(u),
        });
        console.log(`${new Date().toLocaleTimeString()} update ${u.update_id} → ${r.status}`);
      }
    } catch (e) {
      console.error("poll error:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
