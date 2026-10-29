// Register the Telegram webhook for the deployed app:
//   APP_URL=https://tensor.example.workers.dev npm run webhook
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const app = process.env.APP_URL?.replace(/\/$/, "");

if (!token || !secret || !app?.startsWith("https://")) {
  console.error("Need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and an https APP_URL.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: `${app}/api/telegram`, secret_token: secret, allowed_updates: ["message", "callback_query"] }),
}).then((r) => r.json());
console.log(res);
const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
console.log(info);
