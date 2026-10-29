// Messaging contract. Telegram is the prototype channel; WhatsApp Cloud API replaces it later
// by implementing the same interface. Features never call Telegram directly.
import { telegram } from "./telegram";

export interface Button {
  text: string;
  /** Opaque payload returned in the callback (≤ 64 bytes). */
  data?: string;
  url?: string;
}

export interface SendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

export interface DownloadedFile {
  bytes: ArrayBuffer;
  mime: string;
  ext: string;
}

export interface Channel {
  name: string;
  /** False when credentials are missing; sends then become logged no-ops. */
  configured(): boolean;
  sendText(chatId: number, text: string, buttons?: Button[][]): Promise<SendResult>;
  sendPhoto(chatId: number, photoUrl: string, caption?: string): Promise<SendResult>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  editButtons(chatId: number, messageId: number, buttons: Button[][] | null): Promise<void>;
  downloadFile(fileId: string): Promise<DownloadedFile>;
  /** Deep link a person opens to link their chat, e.g. t.me/bot?start=CODE. */
  linkUrl(code: string): string | null;
}

export function channel(): Channel {
  return telegram;
}
