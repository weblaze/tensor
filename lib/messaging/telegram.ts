import type { Button, Channel, DownloadedFile, SendResult } from "./index";

const API = "https://api.telegram.org";

function token(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || undefined;
}

function keyboard(buttons?: Button[][] | null) {
  if (!buttons) return undefined;
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data ?? b.text })),
    ),
  };
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const t = token();
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description || `Telegram ${method} failed (${res.status})`);
  return json.result as T;
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  oga: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  mp4: "video/mp4", mov: "video/quicktime",
};

export const telegram: Channel = {
  name: "telegram",
  configured: () => !!token(),

  async sendText(chatId, text, buttons): Promise<SendResult> {
    try {
      const r = await call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text,
        reply_markup: keyboard(buttons),
        link_preview_options: { is_disabled: true },
      });
      return { ok: true, messageId: r.message_id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  async sendPhoto(chatId, photoUrl, caption): Promise<SendResult> {
    try {
      const r = await call<{ message_id: number }>("sendPhoto", { chat_id: chatId, photo: photoUrl, caption });
      return { ok: true, messageId: r.message_id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  async answerCallback(callbackId, text) {
    await call("answerCallbackQuery", { callback_query_id: callbackId, text }).catch(() => undefined);
  },

  async editButtons(chatId, messageId, buttons) {
    await call("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard(buttons) ?? { inline_keyboard: [] },
    }).catch(() => undefined);
  },

  async downloadFile(fileId): Promise<DownloadedFile> {
    const file = await call<{ file_path: string }>("getFile", { file_id: fileId });
    const res = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
    if (!res.ok) throw new Error(`Telegram file download failed (${res.status})`);
    const ext = (file.file_path.split(".").pop() || "bin").toLowerCase();
    return { bytes: await res.arrayBuffer(), ext, mime: MIME[ext] ?? "application/octet-stream" };
  },

  linkUrl(code) {
    const bot = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
    return bot ? `https://t.me/${bot}?start=${code}` : null;
  },
};

/** Calls Telegram's raw API; used by the webhook setup and the local poller. */
export const telegramApi = call;
